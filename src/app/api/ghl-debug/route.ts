import { NextResponse } from 'next/server'

const GHL_BASE = 'https://services.leadconnectorhq.com'
const GHL_VERSION = '2021-07-28'
const loc = () => process.env.GHL_LOCATION_ID!

async function ghlFetch(method: string, path: string, body?: unknown) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
      'Version': GHL_VERSION,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } }
  catch { return { status: res.status, body: text.slice(0, 500) } }
}

// 1×1 transparent PNG — minimal valid image for testing
const TEST_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const IG_ID = '69cac90a1a5a568a2df23156_61SJ07b3I1IFjvlP5TE3_17841404374677680'

export async function GET() {
  // 1. Get userId
  const usersRes = await ghlFetch('GET', `/users/?locationId=${loc()}`)
  const userId: string = usersRes.body?.users?.[0]?.id ?? ''

  // 2. Upload test image to GHL media library
  const buf = Buffer.from(TEST_PNG_B64, 'base64')
  const blob = new Blob([buf], { type: 'image/png' })
  const form = new FormData()
  form.append('file', blob, 'test.png')
  form.append('name', 'test.png')
  form.append('fileType', 'image')
  form.append('altId', loc())
  form.append('altType', 'location')

  const uploadRes = await fetch(`${GHL_BASE}/medias/upload-file`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
      'Version': GHL_VERSION,
    },
    body: form,
  })
  const uploadText = await uploadRes.text()
  let uploadData: Record<string, unknown>
  try { uploadData = JSON.parse(uploadText) } catch { uploadData = { raw: uploadText.slice(0, 300) } }

  const mediaUrl: string =
    (uploadData.url as string) ??
    (uploadData.fileUrl as string) ??
    (uploadData as any)?.data?.url ??
    (uploadData as any)?.file?.url ??
    ''

  const uploadResult = { status: uploadRes.status, body: uploadData, extractedUrl: mediaUrl }

  if (!mediaUrl) {
    return NextResponse.json({ userId, uploadResult, note: 'Upload falló — no URL obtenida' })
  }

  // 3. Test every possible media type value
  const typeVariants = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'image', 'IMAGE', 'photo']
  const scheduleDate = '2026-12-31T14:00:00-04:00'

  const variantResults: Record<string, unknown> = {}
  for (const t of typeVariants) {
    const r = await ghlFetch('POST', `/social-media-posting/${loc()}/posts`, {
      type: 'post',
      status: 'scheduled',
      scheduleDate,
      accountIds: [IG_ID],
      summary: `Test tipo: ${t}`,
      media: [{ url: mediaUrl, type: t }],
      userId,
    })
    variantResults[t] = { status: r.status, body: r.body }
    // If one succeeds (2xx), no need to keep testing — but continue so we see all results
  }

  // 4. Also test with NO type field
  const noTypeResult = await ghlFetch('POST', `/social-media-posting/${loc()}/posts`, {
    type: 'post',
    status: 'scheduled',
    scheduleDate,
    accountIds: [IG_ID],
    summary: 'Test sin campo type',
    media: [{ url: mediaUrl }],
    userId,
  })

  return NextResponse.json({
    userId,
    uploadResult,
    variantResults,
    noTypeResult,
  })
}
