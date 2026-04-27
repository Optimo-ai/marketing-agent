// src/lib/googleDrive.ts
// Cliente Google Drive — descarga imágenes de la carpeta del cliente
// Autentica con Service Account (JSON en env) o API Key pública

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  webContentLink?: string
}

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_DOWNLOAD = 'https://www.googleapis.com/drive/v3/files'

// ─── AUTH ─────────────────────────────────────────────────────────────────────
// Usa OAuth2 con Service Account. El token se cachea en memoria durante la ejecución.

let _cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  // Si hay token válido, reutilizarlo
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60_000) {
    return _cachedToken.token
  }

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) {
    throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_JSON en .env.local')
  }

  const sa = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)

  // Construir JWT
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const unsigned = `${header}.${payload}`

  // Firmar con RSA-SHA256 usando Web Crypto API (disponible en Node 18+)
  const keyData = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----\n?/, '')
    .replace(/\n?-----END PRIVATE KEY-----\n?/, '')
    .replace(/\n/g, '')

  const keyBuffer = Buffer.from(keyData, 'base64')
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await globalThis.crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(unsigned)
  )
  const signature = Buffer.from(signatureBuffer).toString('base64url')
  const jwt = `${unsigned}.${signature}`

  // Intercambiar JWT por access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google OAuth falló: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  _cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
  return _cachedToken.token
}

// ─── LISTAR ARCHIVOS ──────────────────────────────────────────────────────────

export async function listDriveImages(folderId: string): Promise<DriveFile[]> {
  const token = await getAccessToken()

  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`,
    fields: 'files(id,name,mimeType,modifiedTime,webContentLink)',
    orderBy: 'modifiedTime desc',
    pageSize: '200',
  })

  const res = await fetch(`${DRIVE_BASE}/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error(`Drive listFiles falló: ${res.status}`)
  const data = await res.json()
  return data.files ?? []
}

// ─── DESCARGAR ARCHIVO ────────────────────────────────────────────────────────

export async function downloadDriveFile(fileId: string): Promise<Buffer> {
  const token = await getAccessToken()

  const res = await fetch(`${DRIVE_DOWNLOAD}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error(`Drive download falló: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ─── MATCH IMAGEN ↔ POST ──────────────────────────────────────────────────────
// Busca en la lista de archivos de Drive cuál corresponde al post
// Estrategia: normaliza nombres y busca coincidencias parciales

export function matchImageToPost(
  postName: string,
  files: DriveFile[]
): DriveFile | null {
  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // quitar acentos
      .replace(/[^a-z0-9\s]/g, '')        // solo alfanumérico
      .trim()

  const postNorm = normalize(postName)
  const postWords = postNorm.split(/\s+/).filter(w => w.length > 3)

  // Coincidencia exacta primero
  const exact = files.find(f => normalize(f.name.replace(/\.[^.]+$/, '')) === postNorm)
  if (exact) return exact

  // Coincidencia por palabras clave (mínimo 2 palabras en común)
  const byWords = files.find(f => {
    const fileNorm = normalize(f.name.replace(/\.[^.]+$/, ''))
    const matches = postWords.filter(w => fileNorm.includes(w))
    return matches.length >= Math.min(2, postWords.length)
  })
  if (byWords) return byWords

  return null
}
