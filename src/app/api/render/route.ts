// src/app/api/render/route.ts
// Renderiza posts con brand overlay usando @napi-rs/canvas + sharp.
// Soporta imágenes subidas localmente (thumbnail base64) y generación de fondo de marca.
// GHL upload es opcional — si falla, devuelve data URL para que el pipeline no se bloquee.

import { NextRequest, NextResponse } from 'next/server'
import { detectBrand } from '@/lib/brandConfig'
import { renderImage } from '@/lib/imageRenderer'
import { markManyAsUsed } from '@/lib/usedImages'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface SlideSource {
  fileId: string
  thumbnail: string   // base64 data URL
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
  imageUrl?: string
  imageThumbnail?: string
  videoUrl?: string
  slideUrls?: string[]
  slideThumbnails?: string[]
  source: 'drive' | 'ai'
  isCarousel: boolean
}

// ─── GHL UPLOAD (OPCIONAL) ────────────────────────────────────────────────────

async function tryUploadToGHL(buf: Buffer, filename: string, mime: string): Promise<string | null> {
  const locationId = process.env.GHL_LOCATION_ID
  const apiKey     = process.env.GHL_API_KEY
  if (!locationId || !apiKey || apiKey.length < 20) return null

  try {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(buf)], { type: mime }), filename)
    form.append('name', filename)
    form.append('fileType', 'image')
    form.append('altId', locationId)
    form.append('altType', 'location')

    const res = await fetch('https://services.leadconnectorhq.com/medias/upload-file', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28' },
      body: form,
    })
    if (!res.ok) return null
    const data = await res.json()
    const url: string = data.url ?? data.fileUrl ?? data?.data?.url ?? ''
    return url || null
  } catch {
    return null
  }
}

// ─── Buffer → base64 data URL ─────────────────────────────────────────────────

function bufToDataUrl(buf: Buffer, mime: string): string {
  return `data:${mime};base64,${buf.toString('base64')}`
}

// ─── Thumbnail base64 → Buffer ────────────────────────────────────────────────

function thumbnailToBuffer(dataUrl: string): Buffer {
  const [, b64] = dataUrl.split(',')
  return Buffer.from(b64, 'base64')
}

// ─── Mapear formato ───────────────────────────────────────────────────────────

function mapFormat(postFormat: string): string {
  const f = (postFormat ?? '').toLowerCase()
  if (f.includes('story'))    return 'story'
  if (f.includes('landscape') || f.includes('banner')) return 'landscape'
  if (f.includes('reel') || f.includes('video')) return 'video'
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
          const isCarousel = (post.format ?? '').toLowerCase().includes('carrusel') ||
                             (post.format ?? '').toLowerCase().includes('carousel')

          // ── CARRUSEL ──────────────────────────────────────────────────────
          if (isCarousel && post.slides && post.slides.length > 1) {
            const slideUrls: string[] = []
            const slideThumbnails: string[] = []
            const usedFileIds: string[] = []

            for (let slideIdx = 0; slideIdx < post.slides.length; slideIdx++) {
              const slide = post.slides[slideIdx]
              const slideTitle = slideIdx === 0
                ? post.postName
                : `${post.postName} (${slideIdx + 1}/${post.slides.length})`

              const srcBuf = slide.thumbnail ? thumbnailToBuffer(slide.thumbnail) : undefined

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
              const ghlUrl = await tryUploadToGHL(rendered.buffer, filename, rendered.mimeType)
              const finalUrl = ghlUrl ?? bufToDataUrl(rendered.buffer, rendered.mimeType)

              slideUrls.push(finalUrl)
              slideThumbnails.push(slide.thumbnail ?? finalUrl)
              usedFileIds.push(slide.fileId)
            }

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
              source: post.needsAI ? 'ai' : 'drive',
              isCarousel: true,
            })

          // ── FOTO SIMPLE / STORY / REEL ────────────────────────────────────
          } else {
            // Si tiene imagen local, usarla; si no, renderImage lo hace con fondo de marca
            const srcBuf = (!post.needsAI && post.image?.thumbnail)
              ? thumbnailToBuffer(post.image.thumbnail)
              : undefined

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
            const ghlUrl = await tryUploadToGHL(rendered.buffer, filename, rendered.mimeType)
            const finalUrl = ghlUrl ?? bufToDataUrl(rendered.buffer, rendered.mimeType)

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
              imageUrl: finalUrl,
              imageThumbnail: post.image?.thumbnail,
              source: post.needsAI ? 'ai' : 'drive',
              isCarousel: false,
            })
          }

        } catch (err) {
          console.error(`[render] Error en "${post.postName}":`, err)
          errors.push({ postId: post.postId, error: String(err) })
        }
      }))

      if (i + BATCH < assignments.length) {
        await new Promise(r => setTimeout(r, 200))
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
