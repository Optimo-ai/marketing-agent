// src/app/api/render/route.ts
// Renderiza posts asignados: descarga imágenes reales de Drive,
// genera con fal.ai las que falten, aplica brand y devuelve URLs de GHL.
// Soporta carruseles (múltiples slides renderizados) y posts simples.

import { NextRequest, NextResponse } from 'next/server'
import { detectBrand, buildImagePrompt, BRAND_CONFIGS } from '@/lib/brandConfig'
import { renderImage } from '@/lib/imageRenderer'
import { markManyAsUsed } from '@/lib/usedImages'
import { generateImage } from '@/lib/falai'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface SlideSource {
  fileId: string
  thumbnail: string   // base64 thumbnail — usamos este para renderizar
}

interface AssignedPost {
  postId: number | string
  postName: string
  format: string
  project: string
  contentDirection: string
  platforms: string[]
  week: number
  suggestedDay: string
  image?: SlideSource
  slides?: SlideSource[]
  needsAI: boolean
  aiPromptHint?: string
}

interface RenderedPost {
  postId: number | string
  postName: string
  format: string
  project: string
  brand: string
  platforms: string[]
  week: number
  suggestedDay: string
  contentDirection: string
  // Foto simple o story:
  imageUrl?: string
  imageThumbnail?: string
  // Carrusel:
  slideUrls?: string[]
  slideThumbnails?: string[]
  source: 'drive' | 'ai'
  isCarousel: boolean
}

// ─── SUBIR IMAGEN A GHL ───────────────────────────────────────────────────────

async function uploadToGHL(buf: Buffer, filename: string, mime: string): Promise<string> {
  const locationId = process.env.GHL_LOCATION_ID!
  const apiKey     = process.env.GHL_API_KEY!
  const form       = new FormData()
  form.append('file', new Blob([buf], { type: mime }), filename)
  form.append('name', filename)
  form.append('fileType', 'image')
  form.append('altId', locationId)
  form.append('altType', 'location')

  const res = await fetch('https://services.leadconnectorhq.com/medias/upload-file', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28' },
    body: form,
  })
  if (!res.ok) throw new Error(`GHL upload falló (${res.status}): ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const url: string = data.url ?? data.fileUrl ?? data?.data?.url ?? ''
  if (!url) throw new Error(`GHL no devolvió URL: ${JSON.stringify(data).slice(0, 150)}`)
  return url
}

// ─── THUMBNAIL BASE64 → BUFFER ────────────────────────────────────────────────

function thumbnailToBuffer(dataUrl: string): Buffer {
  const [, b64] = dataUrl.split(',')
  return Buffer.from(b64, 'base64')
}

// ─── MAPEAR FORMATO ───────────────────────────────────────────────────────────

function mapFormat(postFormat: string): string {
  const f = postFormat.toLowerCase()
  if (f.includes('story'))    return 'story'
  if (f.includes('landscape') || f.includes('banner')) return 'landscape'
  return 'post'
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { assignments, logoBase64 } = await req.json() as {
      assignments: AssignedPost[]
      logoBase64?: string
    }

    if (!assignments?.length) {
      return NextResponse.json({ error: 'No hay posts para renderizar' }, { status: 400 })
    }

    const logoBuffer = logoBase64 ? Buffer.from(logoBase64, 'base64') : undefined
    const results: RenderedPost[] = []
    const errors: { postId: number | string; error: string }[] = []

    // Procesar en lotes de 3
    const BATCH = 3
    for (let i = 0; i < assignments.length; i += BATCH) {
      const batch = assignments.slice(i, i + BATCH)

      await Promise.all(batch.map(async (post) => {
        try {
          const brand = detectBrand(post.postName, post.project)
          const renderFormat = mapFormat(post.format)
          const config = BRAND_CONFIGS[brand]
          const fmt = config.formats[renderFormat] ?? config.formats['post']
          const isCarousel = post.format === 'Carousel' && (post.slides?.length ?? 0) > 1
          const source: 'drive' | 'ai' = post.needsAI ? 'ai' : 'drive'

          // ── CARRUSEL ──────────────────────────────────────────────────────
          if (isCarousel && post.slides) {
            const slideUrls: string[] = []
            const slideThumbnails: string[] = []
            const usedFileIds: string[] = []

            for (let slideIdx = 0; slideIdx < post.slides.length; slideIdx++) {
              const slide = post.slides[slideIdx]
              const slideTitle = slideIdx === 0
                ? post.postName
                : `${post.postName} (${slideIdx + 1}/${post.slides.length})`

              // Usar thumbnail como fuente de imagen
              const srcBuf = thumbnailToBuffer(slide.thumbnail)

              const rendered = await renderImage({
                brand,
                format: renderFormat,
                title: slideTitle,
                body: slideIdx === 0 ? post.contentDirection?.slice(0, 100) : undefined,
                sourceImageBuffer: srcBuf,
                logoBuffer,
                outputFormat: 'jpg',
              })

              const filename = `${brand}_${String(post.postId)}_slide${slideIdx + 1}_${Date.now()}.jpg`
              const ghlUrl = await uploadToGHL(rendered.buffer, filename, rendered.mimeType)
              slideUrls.push(ghlUrl)
              slideThumbnails.push(slide.thumbnail)
              usedFileIds.push(slide.fileId)
            }

            // Marcar todas las imágenes del carrusel como usadas
            markManyAsUsed(usedFileIds, brand, post.postName)

            results.push({
              postId: post.postId,
              postName: post.postName,
              format: post.format,
              project: post.project,
              brand,
              platforms: post.platforms,
              week: post.week,
              suggestedDay: post.suggestedDay,
              contentDirection: post.contentDirection,
              slideUrls,
              slideThumbnails,
              source,
              isCarousel: true,
            })

          // ── FOTO SIMPLE / STORY ───────────────────────────────────────────
          } else {
            let srcBuf: Buffer | undefined

            if (!post.needsAI && post.image) {
              srcBuf = thumbnailToBuffer(post.image.thumbnail)
            } else {
              // Generar con IA
              const prompt = buildImagePrompt(
                brand,
                post.aiPromptHint ?? post.contentDirection ?? post.postName,
                renderFormat
              )
              srcBuf = await generateImage({ prompt, width: fmt.w, height: fmt.h })
            }

            const rendered = await renderImage({
              brand,
              format: renderFormat,
              title: post.postName,
              body: post.contentDirection?.slice(0, 100),
              sourceImageBuffer: srcBuf,
              logoBuffer,
              outputFormat: 'jpg',
            })

            const filename = `${brand}_${String(post.postId)}_${renderFormat}_${Date.now()}.jpg`
            const ghlUrl = await uploadToGHL(rendered.buffer, filename, rendered.mimeType)

            // Marcar como usada si vino de Drive
            if (!post.needsAI && post.image) {
              markManyAsUsed([post.image.fileId], brand, post.postName)
            }

            results.push({
              postId: post.postId,
              postName: post.postName,
              format: post.format,
              project: post.project,
              brand,
              platforms: post.platforms,
              week: post.week,
              suggestedDay: post.suggestedDay,
              contentDirection: post.contentDirection,
              imageUrl: ghlUrl,
              imageThumbnail: post.image?.thumbnail,
              source,
              isCarousel: false,
            })
          }

        } catch (err) {
          console.error(`[render] Error en "${post.postName}":`, err)
          errors.push({ postId: post.postId, error: String(err) })
        }
      }))

      if (i + BATCH < assignments.length) {
        await new Promise(r => setTimeout(r, 400))
      }
    }

    return NextResponse.json({
      posts: results,
      errors,
      total: assignments.length,
      rendered: results.length,
      fromDrive: results.filter(r => r.source === 'drive').length,
      fromAI: results.filter(r => r.source === 'ai').length,
      carousels: results.filter(r => r.isCarousel).length,
    })

  } catch (err: unknown) {
    console.error('[render] Error general:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: '/api/render' })
}
