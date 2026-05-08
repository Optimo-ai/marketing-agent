// src/lib/falai.ts
// Generación de imágenes y video usando fal.ai como motor principal.
// Implementación 100% nativa con fetch (sin dependencias externas) para evitar errores de compilación.

import { Buffer } from 'buffer';
const apiKey = process.env.FAL_KEY || process.env.FAL_API_KEY || '';

export interface GenerateImageOptions {
  prompt: string
  width: number
  height: number
  numInferenceSteps?: number
  guidanceScale?: number
}

// ─── IMÁGENES (Flux Schnell) ────────────────────────────────────────────────
export async function generateImage(opts: GenerateImageOptions): Promise<Buffer> {
  if (!apiKey) {
      console.warn("FAL_KEY no encontrada en .env.local");
      throw new Error("FAL_KEY_MISSING");
  }

  const { prompt, width, height } = opts
  console.log(`[falai] Generando imagen (${width}x${height}):`, prompt.slice(0, 50) + "...")

  let imageSizeParam: string | { width: number; height: number } = { width, height };
  if (width === 1280 && height === 720) imageSizeParam = "landscape_16_9";
  else if (width === 768 && height === 1344) imageSizeParam = "portrait_16_9";
  else if (width === 1024 && height === 1024) imageSizeParam = "square_hd";

  try {
    const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
        method: "POST",
        headers: {
            "Authorization": `Key ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: prompt,
            image_size: imageSizeParam,
            num_inference_steps: Math.min(opts.numInferenceSteps ?? 4, 4),
            num_images: 1,
            enable_safety_checker: false,
            output_format: 'jpeg',
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`fal.ai API error (${res.status}): ${errText}`);
    }

    const result = (await res.json()) as any;
    const imageUrl = result.images?.[0]?.url || result.data?.images?.[0]?.url;
    
    if (!imageUrl) {
        throw new Error(`fal.ai no devolvió URL de imagen. Payload: ${JSON.stringify(result).slice(0, 200)}`);
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error('No se pudo descargar la imagen generada de fal.ai');
    
    return Buffer.from(await imgRes.arrayBuffer());

  } catch (error) {
      console.error("[falai] Error generando imagen:", error);
      throw error;
  }
}

export interface GenerateVideoOptions {
    prompt: string
    aspectRatio?: '16:9' | '9:16' | '1:1'
    duration?: string
}

async function pollFalQueue(statusUrl: string, responseUrl: string): Promise<any> {
    while (true) {
        const res = await fetch(statusUrl, {
            headers: {
                "Authorization": `Key ${apiKey}`,
                "Content-Type": "application/json"
            }
        });
        
        if (!res.ok) {
            throw new Error(`Error en polling (${res.status}): ${await res.text()}`);
        }
        
        const data = (await res.json()) as any;
        
        if (data.status === 'COMPLETED') {
            const finalRes = await fetch(responseUrl, {
                headers: { "Authorization": `Key ${apiKey}` }
            });
            if (!finalRes.ok) throw new Error("Error obteniendo resultado final");
            return (await finalRes.json()) as any;
        }
        
        if (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS') {
            await new Promise(r => setTimeout(r, 3000));
            continue;
        }
        
        throw new Error(`Estado inesperado de fal.ai: ${data.status} - Info: ${JSON.stringify(data).slice(0, 200)}`);
    }
}

export async function generateVideo(opts: GenerateVideoOptions): Promise<{ buffer: Buffer; jobId: string }> {
  if (!apiKey) throw new Error("FAL_KEY_MISSING");

  console.log(`[falai] Generando video (aspect: ${opts.aspectRatio || '16:9'}):`, opts.prompt.slice(0, 50) + "...");


  try {
    let result: any;
    let selectedModel = "fal-ai/kling-video/v1/standard/text-to-video";
    let submitRes = await fetch(`https://queue.fal.run/${selectedModel}`, {
        method: "POST",
        headers: {
            "Authorization": `Key ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: opts.prompt,
            aspect_ratio: opts.aspectRatio ?? "16:9",
            duration: opts.duration ?? "5"
        })
    });

    if (!submitRes.ok) {
        console.warn(`[falai] ${selectedModel} falló:`, await submitRes.text());
        selectedModel = "fal-ai/luma-dream-machine/ray-2";
        submitRes = await fetch(`https://queue.fal.run/${selectedModel}`, {
            method: "POST",
            headers: {
                "Authorization": `Key ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: opts.prompt,
                aspect_ratio: opts.aspectRatio ?? "16:9"
            })
        });

        if (!submitRes.ok) {
            throw new Error(`Video generation no disponible. fal.ai error: ${await submitRes.text()}`);
        }
    }

    const submitData = (await submitRes.json()) as any;
    const statusUrl = submitData.status_url;
    const responseUrl = submitData.response_url;
    
    if (!statusUrl || !responseUrl) {
        throw new Error("fal.ai no devolvió status_url/response_url en la cola.");
    }

    result = await pollFalQueue(statusUrl, responseUrl);

    const videoUrl = result.video?.url || result.data?.video?.url || result.url;
    if (!videoUrl) throw new Error(`FAL video no devolvió URL (modelo: ${selectedModel}). Payload: ${JSON.stringify(result).slice(0, 200)}`);

    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`No se pudo descargar el video (status: ${videoRes.status})`);
    
    return {
        buffer: Buffer.from(await videoRes.arrayBuffer()),
        jobId: submitData.request_id || "fal-job-" + Date.now()
    };

  } catch (error) {
      console.error("[falai] Error generando video:", error);
      throw error;
  }
}

// Wrapper para mantener compatibilidad
export async function generateVideoTracked(opts: GenerateVideoOptions): Promise<{ buffer: Buffer; jobId: string }> {
    return generateVideo(opts);
}
