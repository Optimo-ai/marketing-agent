// src/app/api/drive-scan/route.ts
// Escanea la carpeta raíz de Drive y devuelve las últimas 10 imágenes
// de cada subcarpeta de marca, excluyendo las ya usadas.
//
// Estructura esperada en Drive:
//   /noriega_group_root/
//     kasa/
//     arko/
//     aria/
//     noriega_group/
//
// Devuelve: { brand → [{ fileId, name, thumbnailBase64 }] }

import { NextRequest, NextResponse } from 'next/server'
import { filterUnused } from '@/lib/usedImages'

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'
const MAX_PER_BRAND = 10

// ─── AUTH ─────────────────────────────────────────────────────────────────────

let _token: { value: string; exp: number } | null = null

async function getToken(): Promise<string> {
  if (_token && Date.now() < _token.exp - 60_000) return _token.value

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_JSON en .env.local')
  const sa = JSON.parse(raw)
  const now = Math.floor(Date.now() / 1000)

  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  })).toString('base64url')

  const unsigned = `${header}.${payload}`
  const keyPem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----\n?/, '')
    .replace(/\n?-----END PRIVATE KEY-----\n?/, '')
    .replace(/\n/g, '')

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', Buffer.from(keyPem, 'base64'),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, Buffer.from(unsigned))
  const jwt = `${unsigned}.${Buffer.from(sig).toString('base64url')}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  if (!res.ok) throw new Error(`Google auth falló: ${await res.text()}`)
  const data = await res.json()
  _token = { value: data.access_token, exp: Date.now() + data.expires_in * 1000 }
  return _token.value
}

// ─── HELPERS DRIVE ────────────────────────────────────────────────────────────

async function listSubfolders(parentId: string, token: string): Promise<{ id: string; name: string }[]> {
  const params = new URLSearchParams({
    q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
  })
  const res = await fetch(`${DRIVE_BASE}/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`listSubfolders ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.files ?? []
}

async function listImages(
  folderId: string,
  token: string,
  limit: number
): Promise<{ id: string; name: string }[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`,
    fields: 'files(id,name,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: String(limit),
  })
  const res = await fetch(`${DRIVE_BASE}/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`listImages ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.files ?? []
}

async function downloadThumbnail(fileId: string, token: string): Promise<string> {
  // Intenta thumbnail de Drive primero (más rápido, ~220px)
  const thumbParams = new URLSearchParams({
    fileId,
    fields: 'thumbnailLink',
  })
  const metaRes = await fetch(`${DRIVE_BASE}/files/${fileId}?fields=thumbnailLink`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const meta = await metaRes.json()

  if (meta.thumbnailLink) {
    // Drive thumbnail — descargar como base64
    const imgRes = await fetch(meta.thumbnailLink.replace('=s220', '=s400'))
    if (imgRes.ok) {
      const buf = await imgRes.arrayBuffer()
      const mime = imgRes.headers.get('content-type') ?? 'image/jpeg'
      return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
    }
  }

  // Fallback: descargar el archivo completo (más lento)
  const dlRes = await fetch(`${DRIVE_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!dlRes.ok) throw new Error(`download ${fileId} falló: ${dlRes.status}`)
  const buf = await dlRes.arrayBuffer()
  const mime = dlRes.headers.get('content-type') ?? 'image/jpeg'
  return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { rootFolderId } = await req.json() as { rootFolderId: string }
    if (!rootFolderId) {
      return NextResponse.json({ error: 'Falta rootFolderId' }, { status: 400 })
    }

    const token = await getToken()

    // 1. Listar subcarpetas (kasa, arko, aria, noriega_group, etc.)
    const subfolders = await listSubfolders(rootFolderId, token)
    if (!subfolders.length) {
      return NextResponse.json({ error: 'No se encontraron subcarpetas en el Drive raíz' }, { status: 404 })
    }

    // 2. Por cada subcarpeta → últimas 10 imágenes → filtrar usadas → descargar thumbnail
    const result: Record<string, { fileId: string; name: string; thumbnail: string }[]> = {}

    await Promise.all(subfolders.map(async (folder) => {
      const brand = folder.name.toLowerCase().replace(/\s+/g, '_')
      try {
        // Trae más de MAX_PER_BRAND para compensar las ya usadas
        const allImages = await listImages(folder.id, token, MAX_PER_BRAND * 3)
        const unusedIds = filterUnused(allImages.map(f => f.id))
        const unusedImages = allImages
          .filter(f => unusedIds.includes(f.id))
          .slice(0, MAX_PER_BRAND)

        // Descargar thumbnails en paralelo
        const withThumbs = await Promise.all(
          unusedImages.map(async (img) => {
            try {
              const thumbnail = await downloadThumbnail(img.id, token)
              return { fileId: img.id, name: img.name, thumbnail }
            } catch {
              return null
            }
          })
        )

        result[brand] = withThumbs.filter(Boolean) as typeof result[string]
      } catch (e) {
        console.warn(`[drive-scan] Error en carpeta ${folder.name}:`, e)
        result[brand] = []
      }
    }))

    const totalImages = Object.values(result).reduce((sum, imgs) => sum + imgs.length, 0)

    return NextResponse.json({
      brands: result,
      totalImages,
      scannedFolders: subfolders.map(f => f.name),
    })

  } catch (err: unknown) {
    console.error('[drive-scan] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
