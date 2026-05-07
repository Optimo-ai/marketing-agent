// src/app/api/approve-media/route.ts
// Sube los medios aprobados a GHL y devuelve las URLs permanentes.
// Imágenes vienen como data URL (base64). Videos ya tienen GHL URL (se devuelven tal cual).

import { NextRequest, NextResponse } from 'next/server'

interface ApproveItem {
  postId:    string | number
  dataUrl:   string   // data:image/jpeg;base64,... ó https://... para videos
  mimeType:  string
  filename:  string
  isGhlUrl?: boolean  // true = ya es URL de GHL, no hay que subir
}

async function uploadDataUrlToGHL(dataUrl: string, filename: string, mimeType: string): Promise<string> {
  const locationId = process.env.GHL_LOCATION_ID
  const apiKey     = process.env.GHL_API_KEY

  if (!locationId || !apiKey || apiKey.length < 20) {
    throw new Error('GHL_LOCATION_ID o GHL_API_KEY no configurados')
  }

  const [, b64] = dataUrl.split(',')
  const buffer  = Buffer.from(b64, 'base64')

  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename)
  form.append('name', filename)
  form.append('fileType', mimeType.startsWith('video') ? 'video' : 'image')
  form.append('altId', locationId)
  form.append('altType', 'location')

  const res = await fetch('https://services.leadconnectorhq.com/medias/upload-file', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28' },
    body: form,
  })

  if (!res.ok) throw new Error(`GHL upload falló: ${res.status} — ${await res.text().catch(() => '')}`)

  const data = await res.json()
  const url: string = data.url ?? data.fileUrl ?? data?.data?.url ?? ''
  if (!url) throw new Error('GHL no devolvió URL')
  return url
}

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json() as { items: ApproveItem[] }

    if (!items?.length) {
      return NextResponse.json({ error: 'No hay items para subir' }, { status: 400 })
    }

    const results: { postId: string | number; ghlUrl?: string; error?: string }[] = []

    for (const item of items) {
      try {
        let ghlUrl: string

        if (item.isGhlUrl) {
          // Video ya subido a GHL durante la generación
          ghlUrl = item.dataUrl
        } else {
          // Imagen: subir data URL a GHL ahora
          ghlUrl = await uploadDataUrlToGHL(item.dataUrl, item.filename, item.mimeType)
        }

        results.push({ postId: item.postId, ghlUrl })
        await new Promise(r => setTimeout(r, 150))

      } catch (err) {
        console.error(`[approve-media] Upload falló para postId ${item.postId}:`, err)
        results.push({ postId: item.postId, error: String(err) })
      }
    }

    return NextResponse.json({
      results,
      uploaded: results.filter(r => r.ghlUrl).length,
      errors:   results.filter(r => r.error).length,
    })

  } catch (err: unknown) {
    console.error('[approve-media] Error general:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
