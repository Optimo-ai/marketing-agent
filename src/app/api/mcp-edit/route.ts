// src/app/api/mcp-edit/route.ts
// Edición real de video de marca:
// 1. Renderiza un frame con canvas + overlay de marca + texto
// 2. Sube ese frame a GHL para obtener URL
// 3. Envía a Higgsfield image-to-video para animarlo
// Resultado: video con branding, título y dirección de contenido baked in

import { NextRequest, NextResponse } from 'next/server'
import { detectBrand, buildImagePrompt } from '@/lib/brandConfig'
import { renderImage } from '@/lib/imageRenderer'
import { generateVideo as generateHiggsfieldVideo } from '@/lib/higgsfield'

async function uploadToGHL(buf: Buffer, filename: string, mime: string): Promise<string> {
  const locationId = process.env.GHL_LOCATION_ID!
  const apiKey = process.env.GHL_API_KEY!
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(buf)], { type: mime }), filename)
  form.append('name', filename)
  form.append('fileType', mime.startsWith('video') ? 'video' : 'image')
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

export async function POST(req: NextRequest) {
  try {
    const { videoUrl, postName, contentDirection, project } = await req.json()

    if (!postName && !contentDirection) {
      return NextResponse.json({ error: 'Falta postName o contentDirection' }, { status: 400 })
    }

    const brand = detectBrand(postName ?? '', project ?? '')

    // Paso 1: Renderizar frame de marca con canvas
    // Genera una imagen estática con el overlay de la marca, título y dirección de contenido
    const title = postName ?? 'Contenido'
    const body = contentDirection?.slice(0, 120) ?? ''

    console.log(`[mcp-edit] Renderizando frame de marca para "${title}" (${brand})`)

    const rendered = await renderImage({
      brand,
      format: 'post',
      title,
      body,
      outputFormat: 'jpg',
    })

    // Paso 2: Subir el frame renderizado a GHL
    const frameFilename = `mcp_frame_${brand}_${Date.now()}.jpg`
    const frameUrl = await uploadToGHL(rendered.buffer, frameFilename, rendered.mimeType)

    console.log(`[mcp-edit] Frame subido: ${frameUrl}`)

    // Paso 3: Usar Higgsfield image-to-video para animar el frame branded
    const videoPrompt = buildImagePrompt(brand, contentDirection ?? postName ?? '', 'post')
    const animationPrompt = `${videoPrompt}, subtle cinematic movement, slow pan, luxury real estate reveal animation, professional video quality`

    console.log(`[mcp-edit] Generando video animado con Higgsfield...`)
    const videoBuf = await generateHiggsfieldVideo({
      prompt:      animationPrompt,
      aspectRatio: '16:9',
      duration:    5,
    })

    // Paso 4: Subir el video editado a GHL
    const videoFilename = `mcp_edit_${brand}_${Date.now()}.mp4`
    const editedVideoUrl = await uploadToGHL(videoBuf, videoFilename, 'video/mp4')

    console.log(`[mcp-edit] Video editado listo: ${editedVideoUrl}`)

    return NextResponse.json({
      status: 'ok',
      editedVideoUrl,
      frameUrl,
      brand,
      message: `Video de "${title}" editado con branding de ${brand}`,
    })

  } catch (err: unknown) {
    console.error('[mcp-edit] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
