// src/app/api/generate-media/route.ts
// Pipeline de generación de media:
//   Images: Higgsfield flux_2 → fal.ai flux/schnell (fallback si Higgsfield 5xx/timeout)
//   Videos: Higgsfield exclusively (cinematic/lifestyle/avatar/creative)
//
// Devuelve data URLs para preview (no sube a GHL hasta que el usuario apruebe).

import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300;

import { runSkill, parseJSON } from '@/lib/claude'
import { detectBrand, BRAND_CONFIGS } from '@/lib/brandConfig'
import {
  generateImage,
  generateVideoTracked
} from '@/lib/falai'
import { renderImage, renderCarouselSlide } from '@/lib/imageRenderer'
import { processVideo } from '@/lib/videoProcessor'

// ─── DETECTOR DE ESTILO DE VIDEO ─────────────────────────────────────────────
// Analiza la dirección de contenido para elegir el tipo de video apropiado.
// Cicla entre estilos según la semana para garantizar variedad mensual.

const AVATAR_KEYWORDS    = ['speaking', 'talking', 'advisor', 'testimonial', 'interview', 'tip', 'tips', 'advice', 'presenting', 'presents', 'explains', 'message', 'presentar', 'habla', 'asesora']
const CINEMATIC_KEYWORDS = ['aerial', 'drone', 'building', 'facade', 'architecture', 'panorama', 'skyline', 'render', 'exterior', 'overview', 'reveal', 'cinematic', 'aereo', 'construcción']
const LIFESTYLE_KEYWORDS  = ['family', 'couple', 'people', 'lifestyle', 'amenity', 'pool', 'terrace', 'rooftop', 'tour', 'walk', 'interior', 'resident', 'living', 'experience', 'enjoying']

// Avatar → Lifestyle → Cinematic por semana → Creative
export type VideoStyle = 'cinematic' | 'lifestyle' | 'avatar' | 'creative';
const WEEK_STYLE_ROTATION: VideoStyle[] = ['cinematic', 'lifestyle', 'avatar', 'creative']

function detectVideoStyle(contentDir: string, week: number): VideoStyle {
  const text = contentDir.toLowerCase()
  if (AVATAR_KEYWORDS.some(k => text.includes(k)))    return 'avatar'
  if (CINEMATIC_KEYWORDS.some(k => text.includes(k))) return 'cinematic'
  if (LIFESTYLE_KEYWORDS.some(k => text.includes(k))) return 'lifestyle'
  return WEEK_STYLE_ROTATION[(week - 1) % 4] ?? 'cinematic'
}

// ─── HELPERS DE FORMATO ───────────────────────────────────────────────────────

function isVideoFormat(format: string): boolean {
  const f = (format ?? '').toLowerCase()
  return f.includes('reel') || f.includes('video')
}

function isCarouselFormat(format: string): boolean {
  return (format ?? '').toLowerCase().includes('carousel')
}

function mapRenderFormat(postFormat: string): string {
  const f = (postFormat ?? '').toLowerCase()
  if (f.includes('story'))                              return 'story'
  if (f.includes('landscape') || f.includes('banner')) return 'landscape'
  return 'post'
}

// aspect_ratio para Higgsfield; dimensiones para fal.ai
function mapAspectRatio(w: number, h: number): {
  aspectRatio: '16:9' | '9:16' | '1:1'
  width: number
  height: number
} {
  const ratio = w / h
  if (ratio > 1.4) return { aspectRatio: '16:9', width: 1280, height: 720  }
  if (ratio < 0.8) return { aspectRatio: '9:16', width: 768,  height: 1344 }
  return                   { aspectRatio: '1:1',  width: 1024, height: 1024 }
}

// Genera imagen — usando fal.ai
async function generateAnyImage(
  prompt: string,
  aspectRatio: '16:9'|'9:16'|'1:1',
): Promise<{ buffer: Buffer; jobId?: string }> {
  try {
    const { width, height } = aspectRatio === '16:9' ? { width: 1280, height: 720 } : aspectRatio === '9:16' ? { width: 768, height: 1344 } : { width: 1024, height: 1024 }
    const buffer = await generateImage({ prompt, width, height })
    return { buffer, jobId: "fal-flux-" + Date.now() }
  } catch (err: any) {
    const msg = String(err?.message ?? err)
    throw err
  }
}

// Patrón de carrusel según canvas-design-pro SKILL:
// 4 slides: Foto(logo) → Negro → Foto → Negro(website)
// 'photo' | 'black'
const CAROUSEL_PATTERN: Array<'photo'|'black'> = ['photo', 'black', 'photo', 'black']
const CAROUSEL_PHOTO_SLIDES = 2   // cuántas imágenes reales hay que generar

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { posts, logoBase64 } = await req.json()
    if (!posts?.length) {
      return NextResponse.json({ error: 'No hay posts' }, { status: 400 })
    }

    const logoBuffer = logoBase64 ? Buffer.from(logoBase64, 'base64') : undefined
    const items: any[]  = []
    const errors: any[] = []

    const BATCH = 1  // sequential — evita rate-limit en Higgsfield y Pollinations
    for (let i = 0; i < posts.length; i += BATCH) {
      const batch = posts.slice(i, i + BATCH)

      await Promise.all(batch.map(async (post: any) => {
        try {
          const brand        = detectBrand(post.name ?? post.postName ?? '', post.project ?? '')
          const config       = BRAND_CONFIGS[brand]
          const postFormat   = post.format ?? ''
          const isVideo      = isVideoFormat(postFormat)
          const isCarousel   = isCarouselFormat(postFormat)
          const renderFormat = mapRenderFormat(postFormat)
          const fmt          = config.formats[renderFormat] ?? config.formats['post']
          const postId       = post.id ?? post.postId
          const postName     = post.name ?? post.postName ?? ''
          const contentDir   = post.contentDirection ?? postName

          // ── REEL / VIDEO ────────────────────────────────────────────────────
          if (isVideo) {
            // Step 1: Detectar estilo según contenido y semana
            const videoStyle = detectVideoStyle(contentDir, post.week ?? 1)
            console.log(`[generate-media] Estilo de video para "${postName}": ${videoStyle} (semana ${post.week ?? 1})`)

            let videoBuffer:  Buffer | null = null
            let isRealVideo   = false
            let higgsfieldJobId: string | undefined
            let subtitleLines: string[] = []

            // ── CINEMATIC / LIFESTYLE / CREATIVE ──
            // Reels → portrait 9:16; other video → landscape 16:9
            const isReel = (postFormat ?? '').toLowerCase().includes('reel')
            const videoAspect: '9:16' | '16:9' = isReel ? '9:16' : '16:9'

            // Intentar generar video
            try {
              const claudeInput = `Brand: ${config.displayName}
Brand visual DNA: ${config.aiPromptBase}
Project: ${post.project ?? ''}
Format: ${isReel ? 'portrait 9:16 vertical Reel' : 'landscape 16:9'} — 15 seconds
Content direction: ${contentDir}
Video style: ${videoStyle === 'avatar' ? 'lifestyle' : videoStyle}`

              const rawPrompt   = await runSkill('videoPrompt', claudeInput)
              const cleanPrompt = rawPrompt.trim().replace(/^["']|["']$/g, '')

              const result = await generateVideoTracked({
                prompt:      cleanPrompt,
                aspectRatio: videoAspect,
                duration:    '5',
              })
              videoBuffer     = result.buffer
              higgsfieldJobId = result.jobId
              isRealVideo     = true
              console.log(`[generate-media] Video 5s (${videoStyle} ${videoAspect}) listo para "${postName}"`)
            } catch (videoErr) {
              console.warn(`[generate-media] Video generation falló para "${postName}":`, String(videoErr).slice(0, 150))
              // Fallback: generar imagen estática
              videoBuffer = null
              isRealVideo = false
            }

            // Si video falló, generar thumbnail estático
            if (!videoBuffer) {
              console.warn(`[generate-media] Generando thumbnail estático para "${postName}"`)
              try {
                const imgResult = await generateAnyImage(
                  config.aiPromptBase + ', ' + contentDir.slice(0, 50) + ', cinematic still frame, no people, luxury real estate',
                  videoAspect,
                )
                videoBuffer     = imgResult.buffer
                higgsfieldJobId = imgResult.jobId
                isRealVideo     = false
              } catch (imgErr) {
                console.error(`[generate-media] Image thumbnail falló para "${postName}":`, String(imgErr).slice(0, 150))
                errors.push({ postId, postName, error: `Imagen estática fallida: ${String(imgErr).slice(0, 100)}` })
                return
              }
            }

            // Step post: procesar video o usar thumbnail estático
            let finalVideoBuffer = videoBuffer!
            let finalMimeType:     string
            let finalDataUrlPrefix: string

            if (isRealVideo) {
              const subtitleText = subtitleLines.length > 0
                ? subtitleLines.join(' • ')
                : postName.slice(0, 72)

              try {
                const processed = await processVideo({
                  videoBuffer:  videoBuffer!,
                  subtitle:     subtitleText,
                  brand,
                  logoBuffer,
                })
                finalVideoBuffer   = processed.buffer
                finalMimeType      = processed.mimeType
                finalDataUrlPrefix = 'data:video/mp4;base64,'
                console.log(`[generate-media] Video procesado (subtítulos + endcard) para "${postName}"`)
              } catch (procErr) {
                console.warn(`[generate-media] FFmpeg falló, video crudo:`, String(procErr).slice(0, 120))
                finalVideoBuffer   = videoBuffer!
                finalMimeType      = 'video/mp4'
                finalDataUrlPrefix = 'data:video/mp4;base64,'
              }
            } else {
              // Thumbnail estático → brand overlay
              const rendered = await renderImage({
                brand,
                format:            'landscape',
                title:             postName,
                body:              contentDir.slice(0, 80),
                sourceImageBuffer: videoBuffer!,
                logoBuffer,
                outputFormat:      'jpg',
              })
              finalVideoBuffer   = rendered.buffer
              finalMimeType      = 'image/jpeg'
              finalDataUrlPrefix = 'data:image/jpeg;base64,'
            }

            items.push({
              postId,
              postName,
              brand,
              format:            postFormat || 'Reel',
              mediaType:         isRealVideo ? 'video' : 'video_static',
              videoStyle,
              dataUrl:           `${finalDataUrlPrefix}${finalVideoBuffer.toString('base64')}`,
              isGhlUrl:          false,
              subtitlesEs:       subtitleLines,
              platforms:         post.platforms ?? [],
              week:              post.week ?? 1,
              suggestedDay:      post.suggestedDay ?? '',
              contentDirection:  contentDir,
              project:           post.project ?? '',
              higgsfieldJobIds:  higgsfieldJobId ? [higgsfieldJobId] : [],
            })

          // ── CAROUSEL ────────────────────────────────────────────────────────
          } else if (isCarousel) {
            // Step 1: Claude genera 2 prompts — uno por cada slide de FOTO
            const claudeInput = `Brand: ${config.displayName}
Brand visual DNA: ${config.aiPromptBase}
Project: ${post.project ?? ''}
Format: portrait 1080x1350px
Content direction: ${contentDir}
Number of slides: ${CAROUSEL_PHOTO_SLIDES}`

            const rawSlidePrompts = await runSkill('carouselPrompts', claudeInput)
            let photoPrompts: string[] = []
            try {
              photoPrompts = parseJSON<string[]>(rawSlidePrompts)
              if (!Array.isArray(photoPrompts) || photoPrompts.length === 0) throw new Error('not array')
            } catch {
              const single = await runSkill('imagePrompt', `Brand: ${config.displayName}\nBrand visual DNA: ${config.aiPromptBase}\nContent direction: ${contentDir}`)
              photoPrompts = [single.trim().replace(/^["']|["']$/g, '')]
            }
            while (photoPrompts.length < CAROUSEL_PHOTO_SLIDES) photoPrompts.push(photoPrompts[0])
            photoPrompts = photoPrompts.slice(0, CAROUSEL_PHOTO_SLIDES)

            // Step 2: Higgsfield genera solo las 2 imágenes de foto
            const { aspectRatio } = mapAspectRatio(fmt.w, fmt.h)
            const photoResults = await Promise.all(
              photoPrompts.map(p => generateAnyImage(p, aspectRatio))
            )
            const photoBuffers = photoResults.map(r => r.buffer)
            const carouselJobIds = photoResults.map(r => r.jobId).filter(Boolean) as string[]

            // Step 3: Renderizar los 4 slides según patrón Foto→Negro→Foto→Negro
            // Copies de texto por slide:
            //   slide 0 (Foto+logo): postName como título
            //   slide 1 (Negro): brand name
            //   slide 2 (Foto): visual limpio, sin título
            //   slide 3 (Negro+website): CTA breve
            const slideTexts = [
              { title: postName,                            body: '' },
              { title: config.displayName,                  body: '' },
              { title: '',                                  body: '' },
              { title: config.displayName.toUpperCase(),    body: '' },
            ]

            let photoIdx = 0
            const slides = await Promise.all(
              CAROUSEL_PATTERN.map(async (type, idx) => {
                const imgBuf = type === 'photo' ? photoBuffers[photoIdx++] : undefined
                return renderCarouselSlide({
                  brand,
                  format: renderFormat,
                  title:  slideTexts[idx].title,
                  body:   slideTexts[idx].body || undefined,
                  sourceImageBuffer: imgBuf,
                  logoBuffer,
                  outputFormat: 'jpg',
                  slideNumber:  idx + 1,
                  totalSlides:  CAROUSEL_PATTERN.length,
                })
              })
            )

            const slideDataUrls = slides.map(
              s => `data:image/jpeg;base64,${s.buffer.toString('base64')}`
            )

            items.push({
              postId,
              postName,
              brand,
              format:           postFormat || 'Carousel',
              mediaType:        'carousel',
              dataUrl:          slideDataUrls[0],
              slides:           slideDataUrls,
              isCarousel:       true,
              isGhlUrl:         false,
              prompt:           photoPrompts[0],
              prompts:          photoPrompts,
              higgsfieldJobIds: carouselJobIds,
              platforms:        post.platforms ?? [],
              week:             post.week ?? 1,
              suggestedDay:     post.suggestedDay ?? '',
              contentDirection: contentDir,
              project:          post.project ?? '',
            })

          // ── FOTO / STORY / LEAD MAGNET ───────────────────────────────────────
          } else {
            // Step 1: Claude genera el prompt
            const claudeInput = `Brand: ${config.displayName}
Brand visual DNA: ${config.aiPromptBase}
Project: ${post.project ?? ''}
Format: ${postFormat || 'post'} (${fmt.w}x${fmt.h}px)
Content direction: ${contentDir}
Media type needed: image`

            const rawPrompt   = await runSkill('imagePrompt', claudeInput)
            const cleanPrompt = rawPrompt.trim().replace(/^["']|["']$/g, '')

            // Step 2: Higgsfield genera la imagen
            const { aspectRatio } = mapAspectRatio(fmt.w, fmt.h)
            const imgResult = await generateAnyImage(cleanPrompt, aspectRatio)

            // Step 3: Brand overlay
            const rendered = await renderImage({
              brand,
              format:            renderFormat,
              title:             postName,
              body:              contentDir.slice(0, 100),
              sourceImageBuffer: imgResult.buffer,
              logoBuffer,
              outputFormat:      'jpg',
            })

            items.push({
              postId,
              postName,
              brand,
              format:           postFormat || 'Foto',
              mediaType:        'image',
              dataUrl:          `data:image/jpeg;base64,${rendered.buffer.toString('base64')}`,
              isGhlUrl:         false,
              prompt:           cleanPrompt,
              platforms:        post.platforms ?? [],
              week:             post.week ?? 1,
              suggestedDay:     post.suggestedDay ?? '',
              contentDirection: contentDir,
              project:          post.project ?? '',
              higgsfieldJobIds: imgResult.jobId ? [imgResult.jobId] : [],
            })
          }

        } catch (err) {
          console.error(`[generate-media] Error en "${post.name ?? post.postName}":`, err)
          errors.push({
            postId:   post.id ?? post.postId,
            postName: post.name ?? post.postName,
            error:    String(err),
          })
        }
      }))

      if (i + BATCH < posts.length) {
        await new Promise(r => setTimeout(r, 300))
      }
    }

    return NextResponse.json({
      items,
      errors,
      total:     posts.length,
      generated: items.length,
    })

  } catch (err: unknown) {
    console.error('[generate-media] Error general:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
