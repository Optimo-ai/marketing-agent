// src/lib/falai.ts
// Cliente fal.ai — genera imágenes cuando no hay foto en Drive
// Modelo: flux/dev (mejor calidad/velocidad para fotorrealismo)

export interface GenerateImageOptions {
  prompt: string
  width: number
  height: number
  numInferenceSteps?: number   // 28 = balance calidad/velocidad
  guidanceScale?: number       // 3.5 = recomendado para flux
}

export interface GeneratedImage {
  url: string
  width: number
  height: number
}

// ─── GENERAR IMAGEN ───────────────────────────────────────────────────────────

export async function generateImage(opts: GenerateImageOptions): Promise<Buffer> {
  const apiKey = process.env.FAL_API_KEY
  if (!apiKey) throw new Error('Falta FAL_API_KEY en .env.local')

  const { prompt, width, height } = opts

  // fal.ai queue API — submit + poll
  const submitRes = await fetch('https://queue.fal.run/fal-ai/flux/dev', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: { width, height },
      num_inference_steps: opts.numInferenceSteps ?? 28,
      guidance_scale: opts.guidanceScale ?? 3.5,
      num_images: 1,
      enable_safety_checker: false,
      output_format: 'jpeg',
    }),
  })

  if (!submitRes.ok) {
    const err = await submitRes.text()
    throw new Error(`fal.ai submit falló (${submitRes.status}): ${err.slice(0, 300)}`)
  }

  const { request_id } = await submitRes.json()

  // Poll hasta completar (máx 120 segundos)
  const maxWait = 120_000
  const pollInterval = 2_000
  const started = Date.now()

  while (Date.now() - started < maxWait) {
    await new Promise(r => setTimeout(r, pollInterval))

    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/flux/dev/requests/${request_id}/status`,
      { headers: { Authorization: `Key ${apiKey}` } }
    )

    if (!statusRes.ok) continue
    const status = await statusRes.json()

    if (status.status === 'COMPLETED') {
      // Obtener resultado
      const resultRes = await fetch(
        `https://queue.fal.run/fal-ai/flux/dev/requests/${request_id}`,
        { headers: { Authorization: `Key ${apiKey}` } }
      )
      const result = await resultRes.json()
      const imageUrl: string = result?.images?.[0]?.url ?? result?.image?.url

      if (!imageUrl) throw new Error('fal.ai no devolvió URL de imagen')

      // Descargar imagen como Buffer
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) throw new Error(`No se pudo descargar la imagen generada`)
      const arrayBuffer = await imgRes.arrayBuffer()
      return Buffer.from(arrayBuffer)
    }

    if (status.status === 'FAILED') {
      throw new Error(`fal.ai generación falló: ${JSON.stringify(status).slice(0, 200)}`)
    }
    // IN_QUEUE | IN_PROGRESS → seguir esperando
  }

  throw new Error('fal.ai timeout — generación tardó más de 120 segundos')
}
