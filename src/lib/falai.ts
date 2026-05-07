// src/lib/falai.ts
// Generación de imágenes con fallback automático:
//   1. fal.ai flux/schnell  (requiere FAL_API_KEY — más rápido y económico)
//   2. Pollinations.ai      (gratuito, sin API key, máx 1 req a la vez)

export interface GenerateImageOptions {
  prompt: string
  width: number
  height: number
  numInferenceSteps?: number
  guidanceScale?: number
}

// ─── POLLINATIONS.AI (fallback gratuito) ──────────────────────────────────────
// Límite: 1 request por IP en simultáneo. Se llama siempre de forma secuencial.

async function generateWithPollinations(opts: GenerateImageOptions, attempt = 0): Promise<Buffer> {
  const { prompt, width, height } = opts
  const w = Math.min(width, 1280)
  const h = Math.min(height, 1280)
  const seed = Math.floor(Math.random() * 99999)
  const encoded = encodeURIComponent(prompt.slice(0, 800))
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=${w}&height=${h}&nologo=true&seed=${seed}&model=flux`

  console.log(`[falai] Pollinations.ai (intento ${attempt + 1})...`)
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })

  if (res.status === 429 && attempt < 3) {
    // Rate limited — esperar y reintentar (máx 3 intentos)
    const delay = (attempt + 1) * 8000
    console.warn(`[falai] Pollinations 429 — esperando ${delay / 1000}s antes de reintentar`)
    await new Promise(r => setTimeout(r, delay))
    return generateWithPollinations(opts, attempt + 1)
  }

  if (!res.ok) {
    throw new Error(`Pollinations.ai error (${res.status}): ${await res.text().then(t => t.slice(0, 200))}`)
  }

  const buf = await res.arrayBuffer()
  return Buffer.from(buf)
}

// ─── FAL.AI flux/schnell (primario) ──────────────────────────────────────────
// flux/schnell es el modelo gratuito/económico de fal.ai — rápido y confiable.

async function generateWithFal(opts: GenerateImageOptions): Promise<Buffer> {
  const apiKey = process.env.FAL_API_KEY
  if (!apiKey) throw new Error('FAL_KEY_MISSING')

  const { prompt, width, height } = opts

  // Submit to queue
  const submitRes = await fetch('https://queue.fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: { width, height },
      num_inference_steps: Math.min(opts.numInferenceSteps ?? 4, 4),  // schnell max 4 steps
      num_images: 1,
      enable_safety_checker: false,
      output_format: 'jpeg',
    }),
  })

  if (!submitRes.ok) {
    const err = await submitRes.text()
    if (submitRes.status === 401 || submitRes.status === 403 || submitRes.status === 402) {
      throw new Error(`FAL_AUTH_ERROR: ${err.slice(0, 200)}`)
    }
    throw new Error(`fal.ai submit falló (${submitRes.status}): ${err.slice(0, 300)}`)
  }

  const { request_id } = await submitRes.json()

  // Poll for result
  const maxWait = 90_000
  const pollInterval = 2_000
  const started = Date.now()

  while (Date.now() - started < maxWait) {
    await new Promise(r => setTimeout(r, pollInterval))

    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/flux/schnell/requests/${request_id}/status`,
      { headers: { Authorization: `Key ${apiKey}` } }
    )
    if (!statusRes.ok) continue
    const status = await statusRes.json()

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/fal-ai/flux/schnell/requests/${request_id}`,
        { headers: { Authorization: `Key ${apiKey}` } }
      )
      const result = await resultRes.json()
      const imageUrl: string = result?.images?.[0]?.url ?? result?.image?.url
      if (!imageUrl) throw new Error('fal.ai no devolvió URL de imagen')

      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) throw new Error('No se pudo descargar la imagen de fal.ai')
      return Buffer.from(await imgRes.arrayBuffer())
    }

    if (status.status === 'FAILED') {
      throw new Error(`fal.ai generación falló: ${JSON.stringify(status).slice(0, 200)}`)
    }
  }

  throw new Error('fal.ai timeout')
}

// ─── ENTRY POINT: fal.ai → Pollinations (fallback final) ────────────────────
export async function generateImage(opts: GenerateImageOptions): Promise<Buffer> {
  try {
    return await generateWithFal(opts)
  } catch (err: any) {
    const msg = String(err?.message ?? err)
    // Use Pollinations when fal.ai is unavailable (no key, locked, or exhausted)
    if (msg.includes('FAL_KEY_MISSING') || msg.includes('FAL_AUTH_ERROR') || msg.includes('Exhausted')) {
      console.warn('[falai] fal.ai no disponible, usando Pollinations.ai:', msg.slice(0, 80))
      return generateWithPollinations(opts)
    }
    throw err
  }
}
