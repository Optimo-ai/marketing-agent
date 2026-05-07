// src/lib/higgsfield.ts
// Higgsfield AI — text-to-video y text-to-image via REST API
// Auth: Bearer {API_KEY_ID}:{API_KEY_SECRET}  →  HIGGSFIELD_API_KEY en .env.local
//
// Modelos verificados (mayo 2026):
//   Video:  cinematic_studio_3_0  — cinema-grade, mejor calidad (15s max)
//           kling3_0              — multi-shot, lifestyle, personas (15s max)
//           wan2_6                — creativo/editorial (15s)
//   Imagen: nano_banana_2         — ultimate quality, 4K
//           flux_2                — Flux 2.0 pro, precise prompt adherence

const BASE_URL = 'https://api.higgsfield.ai/v1'

function getKey(): string {
  const key = process.env.HIGGSFIELD_API_KEY
  if (!key) throw new Error('HIGGSFIELD_KEY_MISSING')
  return key
}

// ─── TIPOS PÚBLICOS ───────────────────────────────────────────────────────────

export type VideoStyle = 'cinematic' | 'lifestyle' | 'creative' | 'avatar'

// Mapa de estilos a modelos Higgsfield
const STYLE_MODEL: Record<VideoStyle, string> = {
  cinematic: 'cinematic_studio_3_0',   // arquitectura, aéreos, dramático
  lifestyle:  'kling3_0',              // personas, amenidades, multi-shot
  creative:   'wan2_6',                // editorial, texturas, color bold
  avatar:     'marketing_studio_video', // Sofia hablando a cámara
}

export interface HiggsfieldVideoOptions {
  prompt:        string
  aspectRatio?:  '16:9' | '9:16' | '1:1' | '4:3'   // default 16:9
  duration?:     number                               // segundos, default 15
  resolution?:   '720p' | '1080p'                    // default 720p
  model?:        string                               // override manual del modelo
  videoStyle?:   VideoStyle                           // determina modelo automáticamente
}

export interface HiggsfieldImageOptions {
  prompt:       string
  aspectRatio?: '1:1' | '4:3' | '3:4' | '16:9' | '9:16'  // default 1:1
  resolution?:  '1k' | '2k' | '4k'                         // default 1k
  model?:       string                                       // default nano_banana_2
}

// ─── GENERACIÓN DE VIDEO ──────────────────────────────────────────────────────
export async function generateVideo(opts: HiggsfieldVideoOptions): Promise<Buffer> {
  const key = getKey()

  // Modelo: override manual > estilo automático > cinematic por defecto
  const model = opts.model
    ?? (opts.videoStyle ? STYLE_MODEL[opts.videoStyle] : undefined)
    ?? 'cinematic_studio_3_0'

  const submitRes = await fetch(`${BASE_URL}/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt:       opts.prompt,
      aspect_ratio: opts.aspectRatio ?? '16:9',
      duration:     opts.duration    ?? 15,
      resolution:   opts.resolution  ?? '720p',
    }),
  })

  if (!submitRes.ok) {
    const err = await submitRes.text()
    throw new Error(`Higgsfield video submit falló (${submitRes.status}): ${err.slice(0, 300)}`)
  }

  const submission = await submitRes.json()
  const jobId: string = submission.job_id ?? submission.id ?? submission.generation_id
  if (!jobId) throw new Error(`Higgsfield: sin job_id en respuesta: ${JSON.stringify(submission).slice(0, 200)}`)

  return pollJob(jobId, key, 300_000)
}

// ─── GENERACIÓN DE IMAGEN ─────────────────────────────────────────────────────
export async function generateImage(opts: HiggsfieldImageOptions): Promise<Buffer> {
  const key   = getKey()
  const model = opts.model ?? 'nano_banana_flash'

  console.log(`[higgsfield] Submitting image — model: ${model}, aspect: ${opts.aspectRatio ?? '1:1'}`)
  const submitRes = await fetch(`${BASE_URL}/generations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: opts.prompt, aspect_ratio: opts.aspectRatio ?? '1:1', resolution: opts.resolution ?? '1k' }),
  })

  if (!submitRes.ok) {
    const err = await submitRes.text()
    throw new Error(`Higgsfield image submit falló (${submitRes.status}): ${err.slice(0, 400)}`)
  }

  const submission = await submitRes.json()
  console.log(`[higgsfield] Submit response:`, JSON.stringify(submission).slice(0, 400))
  // API returns: { results: [{ id, status, ... }] }  OR  { job_id, id, generation_id }
  const jobId: string = submission.results?.[0]?.id ?? submission.job_id ?? submission.id ?? submission.generation_id
  if (!jobId) throw new Error(`Higgsfield: sin job_id: ${JSON.stringify(submission).slice(0, 300)}`)

  return pollJob(jobId, key, 120_000)
}

// ─── AVATAR VIDEO (Marketing Studio — Sofia) ─────────────────────────────────
export interface HiggsfieldAvatarVideoOptions {
  script:      string    // guión en inglés
  avatarId?:   string    // default: HIGGSFIELD_AVATAR_ID del .env
  aspectRatio?: '16:9' | '9:16'   // default 9:16 (vertical para Reels)
  duration?:   number    // default 15
  resolution?: '720p' | '1080p'
  mode?:       string    // preset: ugc | tv_spot | tutorial | wild_card
}

export async function generateAvatarVideo(opts: HiggsfieldAvatarVideoOptions): Promise<{ buffer: Buffer; jobId: string }> {
  const key      = getKey()
  const avatarId = opts.avatarId ?? process.env.HIGGSFIELD_AVATAR_ID
  if (!avatarId) throw new Error('HIGGSFIELD_AVATAR_ID no configurado en .env.local')

  const body: Record<string, unknown> = {
    model:        'marketing_studio_video',
    prompt:       opts.script,
    aspect_ratio: opts.aspectRatio ?? '9:16',
    duration:     opts.duration    ?? 15,
    resolution:   opts.resolution  ?? '720p',
    avatars:      [{ media_id: avatarId }],
    setting_id:   opts.mode ?? 'ugc',
  }

  const submitRes = await fetch(`${BASE_URL}/generations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!submitRes.ok) {
    const err = await submitRes.text()
    throw new Error(`Higgsfield avatar submit falló (${submitRes.status}): ${err.slice(0, 300)}`)
  }

  const submission = await submitRes.json()
  const jobId: string = submission.job_id ?? submission.id ?? submission.generation_id
  if (!jobId) throw new Error(`Higgsfield avatar: sin job_id: ${JSON.stringify(submission).slice(0, 200)}`)

  const buffer = await pollJob(jobId, key, 360_000)
  return { buffer, jobId }
}

// ─── GENERACIÓN CON JOB ID TRACKEADO ─────────────────────────────────────────
// Igual que generateVideo pero devuelve también el jobId para cleanup posterior

export async function generateVideoTracked(opts: HiggsfieldVideoOptions): Promise<{ buffer: Buffer; jobId: string }> {
  const key   = getKey()
  const model = opts.model
    ?? (opts.videoStyle ? STYLE_MODEL[opts.videoStyle] : undefined)
    ?? 'cinematic_studio_3_0'

  console.log(`[higgsfield] Submitting video (tracked) — model: ${model}, aspect: ${opts.aspectRatio ?? '16:9'}`)
  const submitRes = await fetch(`${BASE_URL}/generations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: opts.prompt, aspect_ratio: opts.aspectRatio ?? '16:9', duration: opts.duration ?? 15, resolution: opts.resolution ?? '720p' }),
  })

  if (!submitRes.ok) {
    const err = await submitRes.text()
    throw new Error(`Higgsfield video submit falló (${submitRes.status}): ${err.slice(0, 400)}`)
  }

  const submission = await submitRes.json()
  console.log(`[higgsfield] Submit response:`, JSON.stringify(submission).slice(0, 400))
  const jobId: string = submission.results?.[0]?.id ?? submission.job_id ?? submission.id ?? submission.generation_id
  if (!jobId) throw new Error(`Higgsfield: sin job_id: ${JSON.stringify(submission).slice(0, 300)}`)

  const buffer = await pollJob(jobId, key, 360_000)
  return { buffer, jobId }
}

// ─── IMAGEN CON JOB ID TRACKEADO ──────────────────────────────────────────────

export async function generateImageTracked(opts: HiggsfieldImageOptions): Promise<{ buffer: Buffer; jobId: string }> {
  const key   = getKey()
  const model = opts.model ?? 'nano_banana_flash'

  console.log(`[higgsfield] Submitting image (tracked) — model: ${model}, aspect: ${opts.aspectRatio ?? '1:1'}`)
  const submitRes = await fetch(`${BASE_URL}/generations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: opts.prompt, aspect_ratio: opts.aspectRatio ?? '1:1', resolution: opts.resolution ?? '1k' }),
  })

  if (!submitRes.ok) {
    const err = await submitRes.text()
    throw new Error(`Higgsfield image submit falló (${submitRes.status}): ${err.slice(0, 400)}`)
  }

  const submission = await submitRes.json()
  console.log(`[higgsfield] Submit response:`, JSON.stringify(submission).slice(0, 400))
  const jobId: string = submission.results?.[0]?.id ?? submission.job_id ?? submission.id ?? submission.generation_id
  if (!jobId) throw new Error(`Higgsfield: sin job_id: ${JSON.stringify(submission).slice(0, 300)}`)

  const buffer = await pollJob(jobId, key, 120_000)
  return { buffer, jobId }
}

// ─── BORRADO DE GENERACIONES (solo las de esta sesión API) ────────────────────

export async function deleteGenerations(jobIds: string[]): Promise<{ deleted: string[]; failed: string[] }> {
  const key     = getKey()
  const deleted: string[] = []
  const failed:  string[] = []

  await Promise.all(jobIds.map(async jobId => {
    try {
      const res = await fetch(`${BASE_URL}/generations/${jobId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${key}` },
      })
      if (res.ok || res.status === 404) {
        deleted.push(jobId)
      } else {
        console.warn(`[higgsfield] DELETE ${jobId} → ${res.status}`)
        failed.push(jobId)
      }
    } catch (err) {
      console.warn(`[higgsfield] DELETE ${jobId} error:`, err)
      failed.push(jobId)
    }
  }))

  return { deleted, failed }
}

// ─── POLLING ──────────────────────────────────────────────────────────────────
// Real API response format (verified via MCP):
//   GET /generations/{id}  →  { generation: { id, status, results: { rawUrl, minUrl } } }
async function pollJob(jobId: string, key: string, maxWait: number): Promise<Buffer> {
  const started = Date.now()
  let pollInterval = 5000

  while (Date.now() - started < maxWait) {
    await new Promise(r => setTimeout(r, pollInterval))

    const statusRes = await fetch(`${BASE_URL}/generations/${jobId}`, {
      headers: { 'Authorization': `Bearer ${key}` },
    })

    if (!statusRes.ok) {
      console.warn(`[higgsfield] poll ${jobId} → HTTP ${statusRes.status}`)
      continue
    }

    const body = await statusRes.json()
    // Unwrap: API wraps result in { generation: { ... } }
    const gen = body.generation ?? body.results?.[0] ?? body

    const statusStr: string = gen.status ?? gen.state ?? ''
    const isDone   = statusStr === 'completed' || statusStr === 'success' || statusStr === 'done'
    const isFailed = statusStr === 'failed'    || statusStr === 'error'

    if (isDone) {
      console.log(`[higgsfield] job ${jobId} completed (${Math.round((Date.now()-started)/1000)}s)`)
      // URL lives in gen.results.rawUrl  (confirmed via MCP live test)
      const url: string =
        gen.results?.rawUrl    ??
        gen.results?.url       ??
        gen.results?.minUrl    ??
        gen.results?.video_url ??
        gen.url                ??
        gen.video_url          ??
        gen.image_url

      if (!url || typeof url !== 'string') {
        throw new Error(`Higgsfield completado pero sin URL. gen: ${JSON.stringify(gen).slice(0, 400)}`)
      }

      const dlRes = await fetch(url)
      if (!dlRes.ok) throw new Error(`No se pudo descargar resultado Higgsfield (${dlRes.status}): ${url}`)
      return Buffer.from(await dlRes.arrayBuffer())
    }

    if (isFailed) {
      throw new Error(`Higgsfield job ${jobId} falló: ${JSON.stringify(gen).slice(0, 300)}`)
    }

    // Use poll_after_seconds hint if present
    if (typeof gen.poll_after_seconds === 'number') {
      pollInterval = Math.min(gen.poll_after_seconds * 1000, 10_000)
    }
    console.log(`[higgsfield] job ${jobId} → ${statusStr || 'pending'} (${Math.round((Date.now()-started)/1000)}s)`)
  }

  throw new Error(`Higgsfield timeout — job ${jobId} took more than ${maxWait / 1000}s`)
}
