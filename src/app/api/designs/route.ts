// src/app/api/designs/route.ts
// Genera imágenes de diseño reales con Higgsfield AI para los posts del calendario
// Sustituye al mock anterior basado en Unsplash

import { NextRequest, NextResponse } from 'next/server'
import { detectBrand, buildImagePrompt, BRAND_CONFIGS } from '@/lib/brandConfig'
import { generateImageTracked } from '@/lib/higgsfield'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { posts } = body

    if (!posts || posts.length === 0) {
      return NextResponse.json({ error: 'No hay posts para generar imágenes' }, { status: 400 })
    }

    const designs: { postId: string | number; postName: string; imageUrl: string; brand: string; higgsfieldJobId?: string }[] = []
    const errors: { postId: string | number; error: string }[] = []

    // Procesar en lotes de 2 para no saturar la API
    const BATCH = 2
    for (let i = 0; i < posts.length; i += BATCH) {
      const batch = posts.slice(i, i + BATCH)

      await Promise.all(batch.map(async (post: any) => {
        try {
          const brand = detectBrand(post.name ?? '', post.project ?? '')
          const config = BRAND_CONFIGS[brand]
          const fmt = config.formats['post']

          // Construir prompt de imagen basado en la marca y la dirección de contenido
          const prompt = buildImagePrompt(brand, post.contentDirection ?? post.name ?? '', 'post')

          // Generar imagen real con Higgsfield — con tracking de jobId
          const ratio = fmt.w / fmt.h
          const aspectRatio = ratio > 1.4 ? '16:9' as const : ratio < 0.8 ? '9:16' as const : '1:1' as const
          const imgResult = await generateImageTracked({ prompt, aspectRatio })
          const imgBuffer = imgResult.buffer
          const jobId = imgResult.jobId

          // Subir a GHL para obtener URL permanente
          const locationId = process.env.GHL_LOCATION_ID!
          const apiKey = process.env.GHL_API_KEY!
          const filename = `design_${brand}_${Date.now()}.jpg`
          const form = new FormData()
          form.append('file', new Blob([new Uint8Array(imgBuffer)], { type: 'image/jpeg' }), filename)
          form.append('name', filename)
          form.append('fileType', 'image')
          form.append('altId', locationId)
          form.append('altType', 'location')

          const uploadRes = await fetch('https://services.leadconnectorhq.com/medias/upload-file', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28' },
            body: form,
          })

          if (!uploadRes.ok) {
            throw new Error(`GHL upload falló: ${uploadRes.status}`)
          }

          const uploadData = await uploadRes.json()
          const imageUrl: string = uploadData.url ?? uploadData.fileUrl ?? uploadData?.data?.url ?? ''

          if (!imageUrl) throw new Error('GHL no devolvió URL de imagen')

          designs.push({
            postId: post.id ?? i,
            postName: post.name ?? `Post ${i + 1}`,
            imageUrl,
            brand,
            higgsfieldJobId: jobId,
          })
        } catch (err) {
          console.error(`[designs] Error generando imagen para "${post.name}":`, err)
          errors.push({ postId: post.id ?? i, error: String(err) })
        }
      }))

      // Pausa entre lotes para respetar rate limits
      if (i + BATCH < posts.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    return NextResponse.json({ designs, errors, total: posts.length, generated: designs.length })
  } catch (err: unknown) {
    console.error('[designs] Error general:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
