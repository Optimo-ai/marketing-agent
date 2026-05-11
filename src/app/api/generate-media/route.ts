// src/app/api/generate-media/route.ts
// Pipeline de generación de media:
//   Images: Higgsfield
//   Videos: Higgsfield exclusively (cinematic/lifestyle/avatar/creative)
//
// Devuelve data URLs para preview (no sube a GHL hasta que el usuario apruebe).

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300;

import { runSkill, parseJSON } from '@/lib/claude'
import { detectBrand, BRAND_CONFIGS } from '@/lib/brandConfig'
import {
  generateImageTracked,
  generateVideoTracked
} from '@/lib/higgsfield'
import { renderImage, renderCarouselSlide } from '@/lib/imageRenderer'
import { processVideo } from '@/lib/videoProcessor'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

// ─── IMÁGENES DE REFERENCIA FIJAS ─────────────────────────────────────────────

function normalizeRefBrand(project: string): string {
  const b = (project || '').toLowerCase()
  if (b.includes('kasa')) return 'kasa'
  if (b.includes('arko')) return 'arko'
  if (b.includes('aria')) return 'aria'
  return ''
}

// URL pública — para Higgsfield image_url (necesita HTTP URL real, no base64)
function getRefPublicUrl(project: string, appBaseUrl: string, rand: 1|2): string | undefined {
  const n = normalizeRefBrand(project)
  if (!n) return undefined
  return `${appBaseUrl}/references/${n}-${rand}.jpg`
}

// Base64 comprimido — para Claude Vision (max 5MB)
async function getRefImageBase64(project: string, rand: 1|2): Promise<string | undefined> {
  const n = normalizeRefBrand(project)
  if (!n) return undefined
  const filePath = path.join(process.cwd(), 'public', 'references', `${n}-${rand}.jpg`)
  try {
    if (!fs.existsSync(filePath)) return undefined
    const buf = await sharp(fs.readFileSync(filePath))
      .resize(1024, 1024, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer()
    return `data:image/jpeg;base64,${buf.toString('base64')}`
  } catch (err) {
    console.warn('[generate-media] getRefImageBase64 error:', String(err).slice(0, 80))
    return undefined
  }
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

// Genera imagen con cascada de fallbacks — NUNCA lanza error
// 1. Higgsfield AI con image-to-image (URL pública) si disponible
// 2. Imagen de referencia base64 como fondo directo (fallback Higgsfield)
// 3. Picsum Photos
// 4. undefined → renderImage usa fondo negro de marca
async function generateAnyImage(
  prompt: string,
  aspectRatio: '16:9'|'9:16'|'1:1',
  refImageB64?: string,   // base64 data URL — usado como fondo si Higgsfield falla
  refImageUrl?: string    // URL pública HTTP — pasada a Higgsfield para image-to-image real
): Promise<{ buffer: Buffer | undefined; jobId?: string }> {
  // ── 1. Higgsfield (con image-to-image si hay URL pública) ────────────────────
  try {
    const { buffer, jobId } = await generateImageTracked({
      prompt,
      aspectRatio,
      referenceImageUrl: refImageUrl,   // HTTP URL → medias image-to-image
    })
    return { buffer, jobId }
  } catch (err: any) {
    console.warn(`[generate-media] Higgsfield no disponible (${String(err?.message ?? err).slice(0, 80)}) — buscando foto alternativa`)
  }

  // ── 2. Imagen de referencia base64 como fondo ────────────────────────────────
  if (refImageB64) {
    try {
      const [, b64] = refImageB64.split(',')
      const buf = Buffer.from(b64, 'base64')
      if (buf.length > 5000) {
        console.log('[generate-media] Usando imagen de referencia de marca como foto de fondo')
        return { buffer: buf }
      }
    } catch {}
  }

  // ── 3. Picsum Photos — fotos pro de arquitectura, gratis, sin API key ────────
  try {
    const seed    = prompt.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 24)
    const dims    = aspectRatio === '16:9' ? '1280/720'
                  : aspectRatio === '9:16' ? '768/1344'
                  : '1080/1080'
    const picsumUrl = `https://picsum.photos/seed/${seed}/${dims}`
    const ctrl    = new AbortController()
    const timer   = setTimeout(() => ctrl.abort(), 8_000)
    const res     = await fetch(picsumUrl, { signal: ctrl.signal })
    clearTimeout(timer)
    if (res.ok) {
      console.log(`[generate-media] Picsum fallback OK para "${prompt.slice(0, 40)}"`)
      return { buffer: Buffer.from(await res.arrayBuffer()) }
    }
  } catch {
    console.warn('[generate-media] Picsum también falló — usando fondo negro de marca')
  }

  return { buffer: undefined }
}

// ─── CLAUDE VISION → VARIATION PROMPTS ───────────────────────────────────────
// Analiza una imagen de referencia con Claude Vision y genera prompts de variación
// específicos a esa imagen para pasar a Higgsfield (image-to-image).
async function generatePromptsFromReference(
  refImageDataUrl: string,
  brandName: string,
  contentDir: string,
  count: number = 1
): Promise<string[]> {
  const [header, b64] = refImageDataUrl.split(',')
  const mimeType = (header.match(/:(.*?);/)?.[1] ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

  const styleDesc = `You are a creative director for ${brandName} luxury real estate. Study this reference photo of our actual property and extract its visual DNA: architectural style, facade materials, color palette, lighting mood, landscaping, atmosphere. Use that visual DNA to write`
  const promptText = count === 1
    ? `${styleDesc} ONE cinematic AI image generation prompt for a FRESH CREATIVE SHOT of this same property — a different angle, composition, or time of day that feels like it belongs in the same luxury photoshoot but is visually distinct from this reference. Content context: ${contentDir}. Be specific about architecture details you see. Respond ONLY with the prompt string (max 100 words).`
    : `${styleDesc} ${count} cinematic AI image generation prompts, each a DISTINCT CREATIVE SHOT of this same property — different angles, compositions, and lighting moments that all feel like they belong in the same luxury photoshoot. Content context: ${contentDir}. Respond ONLY with a JSON array: ["prompt1", "prompt2"]. No explanations.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: count === 1 ? 300 : 600,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } },
        { type: 'text', text: promptText }
      ]
    }]
  })

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  const text = textBlock?.text ?? ''

  if (count === 1) {
    return [text.trim().replace(/^["']|["']$/g, '')]
  }

  try {
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[]
    }
  } catch {}

  // Fallback: líneas de texto si el JSON falla
  const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 10)
  return lines.length > 0 ? lines : [text.trim()]
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

    // URL pública del servidor — usada para que Higgsfield pueda fetchear las imágenes de referencia
    const appBaseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`

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
          const refRand      = (Math.random() < 0.5 ? 1 : 2) as 1|2
          const refImageB64  = await getRefImageBase64(post.project ?? '', refRand)
          const refImageUrl  = getRefPublicUrl(post.project ?? '', appBaseUrl, refRand)

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
                duration:    5,
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

            // Si video falló, generar thumbnail — Higgsfield o canvas (generateAnyImage nunca lanza)
            if (!videoBuffer) {
              const imgResult = await generateAnyImage(
                config.aiPromptBase + ', ' + contentDir.slice(0, 50) + ', cinematic still frame, no people, luxury real estate',
                videoAspect,
                refImageB64,
                refImageUrl
              )
              // imgResult.buffer es undefined si Higgsfield falló → canvas fallback
              if (imgResult.buffer) {
                videoBuffer     = imgResult.buffer
                higgsfieldJobId = imgResult.jobId
              } else {
                const canvasFallback = await renderImage({
                  brand,
                  format:      renderFormat,
                  title:       postName,
                  body:        contentDir.slice(0, 80),
                  logoBuffer,
                  outputFormat: 'jpg',
                })
                videoBuffer = canvasFallback.buffer
              }
              isRealVideo = false
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
            // Step 1: Generar prompts — Claude Vision si hay referencia, texto si no
            let photoPrompts: string[] = []
            if (refImageB64) {
              try {
                photoPrompts = await generatePromptsFromReference(refImageB64, config.displayName, contentDir, CAROUSEL_PHOTO_SLIDES)
                console.log(`[generate-media] Vision prompts para carousel "${postName}":`, photoPrompts)
              } catch (visionErr) {
                console.warn('[generate-media] Claude Vision falló, usando texto:', String(visionErr).slice(0, 80))
              }
            }
            if (photoPrompts.length === 0) {
              const claudeInput = `Brand: ${config.displayName}
Brand visual DNA: ${config.aiPromptBase}
Project: ${post.project ?? ''}
Format: portrait 1080x1350px
Content direction: ${contentDir}
Number of slides: ${CAROUSEL_PHOTO_SLIDES}
IMPORTANT: Show building architecture, interiors, or amenities. NO ocean, NO beach, NO sea.`
              const rawSlidePrompts = await runSkill('carouselPrompts', claudeInput)
              try {
                photoPrompts = parseJSON<string[]>(rawSlidePrompts)
                if (!Array.isArray(photoPrompts) || photoPrompts.length === 0) throw new Error('not array')
              } catch {
                const single = await runSkill('imagePrompt', `Brand: ${config.displayName}\nBrand visual DNA: ${config.aiPromptBase}\nContent direction: ${contentDir}`)
                photoPrompts = [single.trim().replace(/^["']|["']$/g, '')]
              }
            }
            while (photoPrompts.length < CAROUSEL_PHOTO_SLIDES) photoPrompts.push(photoPrompts[0])
            photoPrompts = photoPrompts.slice(0, CAROUSEL_PHOTO_SLIDES)

            // Step 2: Claude genera el texto para los slides
            const textInput = `Content Direction: ${contentDir}\nBrand: ${config.displayName}\nWebsite: noriegagroup.com`
            const rawTextData = await runSkill('carouselText', textInput)
            const slideCopy = parseJSON<{
              slide1_title: string;
              slide2_body: string;
              slide3_title: string;
              slide4_body: string;
            }> (rawTextData, {
              slide1_title: postName.split(' ').slice(0, 4).join(' '),
              slide2_body: 'Discover exclusivity.',
              slide3_title: config.displayName,
              slide4_body: 'Visit our website.'
            })

            // Step 3: Higgsfield genera las imágenes — con fallback canvas por slide si el servidor no responde
            const { aspectRatio } = mapAspectRatio(fmt.w, fmt.h)
            // generateAnyImage nunca lanza — buffer=undefined significa canvas fallback por slide
            const photoResults = await Promise.all(
              photoPrompts.map(p => generateAnyImage(p, aspectRatio, refImageB64, refImageUrl))
            )
            const photoBuffers = photoResults.map(r => r.buffer)   // Buffer | undefined por slide
            const carouselJobIds = photoResults.flatMap(r => r.jobId ? [r.jobId] : [])

            // Step 4: Renderizar los 4 slides con el texto generado
            // Slides negros usan title (64px) no body (30px) para que el texto se vea grande
            const slideTexts = [
              { title: slideCopy.slide1_title, body: '' },
              { title: slideCopy.slide2_body,  body: '' },
              { title: slideCopy.slide3_title, body: '' },
              { title: slideCopy.slide4_body,  body: '' },
            ]

            let photoIdx = 0
            const slides = await Promise.all(
              CAROUSEL_PATTERN.map(async (type, idx) => {
                const imgBuf = type === 'photo' ? photoBuffers[photoIdx++] : undefined
                return renderCarouselSlide({
                  brand,
                  format: renderFormat,
                  title:  slideTexts[idx].title,
                  body:   slideTexts[idx].body,
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
            // Step 1: Generar prompt — Claude Vision si hay referencia, texto si no
            let cleanPrompt = ''
            if (refImageB64) {
              try {
                const visionPrompts = await generatePromptsFromReference(refImageB64, config.displayName, contentDir, 1)
                cleanPrompt = visionPrompts[0] ?? ''
                console.log(`[generate-media] Vision prompt para "${postName}": ${cleanPrompt.slice(0, 80)}`)
              } catch (visionErr) {
                console.warn('[generate-media] Claude Vision falló, usando texto:', String(visionErr).slice(0, 80))
              }
            }
            if (!cleanPrompt) {
              const claudeInput = `Brand: ${config.displayName}
Brand visual DNA: ${config.aiPromptBase}
Project: ${post.project ?? ''}
Format: ${postFormat || 'post'} (${fmt.w}x${fmt.h}px)
Content direction: ${contentDir}
Media type needed: image
IMPORTANT: Show building architecture, interiors, or amenities. NO ocean, NO beach, NO sea.`
              const rawPrompt = await runSkill('imagePrompt', claudeInput)
              cleanPrompt = rawPrompt.trim().replace(/^["']|["']$/g, '')
            }

            // Step 2: Higgsfield genera la imagen — con fallback canvas si el servidor no responde
            const { aspectRatio } = mapAspectRatio(fmt.w, fmt.h)
            // generateAnyImage nunca lanza — si Higgsfield falla devuelve buffer=undefined
            const imgResult     = await generateAnyImage(cleanPrompt, aspectRatio, refImageB64, refImageUrl)
            const imgBuffer     = imgResult.buffer   // undefined = canvas fallback
            const higgsfieldJobId = imgResult.jobId

            // Step 3: Brand overlay (con o sin foto de Higgsfield)
            const rendered = await renderImage({
              brand,
              format:            renderFormat,
              title:             postName,
              body:              contentDir.slice(0, 100),
              sourceImageBuffer: imgBuffer,
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
              isFallback:       !imgBuffer,
              platforms:        post.platforms ?? [],
              week:             post.week ?? 1,
              suggestedDay:     post.suggestedDay ?? '',
              contentDirection: contentDir,
              project:          post.project ?? '',
              higgsfieldJobIds: higgsfieldJobId ? [higgsfieldJobId] : [],
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
