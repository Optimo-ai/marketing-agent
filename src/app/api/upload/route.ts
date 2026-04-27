import { NextResponse } from 'next/server'

const GHL_BASE = 'https://services.leadconnectorhq.com'
const GHL_VERSION = '2021-07-28'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    const ghlForm = new FormData()
    ghlForm.append('file', file, file.name)
    ghlForm.append('name', file.name)
    ghlForm.append('fileType', file.type.startsWith('video/') ? 'video' : 'image')
    ghlForm.append('altId', process.env.GHL_LOCATION_ID!)
    ghlForm.append('altType', 'location')

    const res = await fetch(`${GHL_BASE}/medias/upload-file`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Version': GHL_VERSION,
      },
      body: ghlForm,
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json(
        { error: `GHL media upload falló (${res.status}): ${errText.slice(0, 300)}` },
        { status: 500 }
      )
    }

    const data = await res.json()
    console.log('[upload] GHL media response:', JSON.stringify(data).slice(0, 500))

    const url: string =
      data.url ??
      data.fileUrl ??
      data?.data?.url ??
      data?.file?.url ??
      data?.mediaFile?.url ??
      data?.media?.url ??
      ''
    const fileId: string =
      data.id ??
      data.fileId ??
      data?.data?.id ??
      data?.file?.id ??
      ''

    if (!url) {
      console.error('[upload] Could not extract URL from GHL response:', data)
      return NextResponse.json(
        { error: `GHL no devolvió URL. Respuesta: ${JSON.stringify(data).slice(0, 200)}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ url, fileId })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
