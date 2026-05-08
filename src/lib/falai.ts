// src/lib/falai.ts
// Generación de imágenes y video usando fal.ai como motor principal.
import { fal } from "@fal-ai/client";

// Asegurarnos de que las variables de entorno están cargadas (útil en dev)
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Fal.ai SDK intentará leer FAL_KEY del entorno automáticamente, pero lo aseguramos:
const apiKey = process.env.FAL_KEY || process.env.FAL_API_KEY;
if (apiKey) {
    fal.config({ credentials: apiKey });
}

export interface GenerateImageOptions {
  prompt: string
  width: number
  height: number
  numInferenceSteps?: number
  guidanceScale?: number
}

// ─── IMÁGENES (Flux) ────────────────────────────────────────────────────────
export async function generateImage(opts: GenerateImageOptions): Promise<Buffer> {
  if (!apiKey) {
      console.warn("FAL_KEY no encontrada. Por favor revisa .env.local");
      throw new Error("FAL_KEY_MISSING");
  }

  const { prompt, width, height } = opts
  console.log(`[falai] Generando imagen (${width}x${height}):`, prompt.slice(0, 50) + "...")

  try {
    const result: any = await fal.subscribe("fal-ai/flux/schnell", {
        input: {
            prompt: prompt,
            image_size: { width, height },
            num_inference_steps: Math.min(opts.numInferenceSteps ?? 4, 4),
            num_images: 1,
            enable_safety_checker: false,
            output_format: 'jpeg',
        },
        logs: true,
        onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
                update.logs.map((log) => log.message).forEach(console.log);
            }
        },
    });

    const imageUrl = result.data?.images?.[0]?.url;
    if (!imageUrl) throw new Error('fal.ai no devolvió URL de imagen');

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error('No se pudo descargar la imagen de fal.ai');
    
    return Buffer.from(await imgRes.arrayBuffer());

  } catch (error) {
      console.error("[falai] Error generando imagen:", error);
      throw error;
  }
}

// ─── VIDEOS (Kling) ──────────────────────────────────────────────────────────
export interface GenerateVideoOptions {
    prompt: string
    aspectRatio?: '16:9' | '9:16' | '1:1'
    duration?: string // '5', '10' (Kling usa 5s por defecto, Luma 5s)
}

export async function generateVideo(opts: GenerateVideoOptions): Promise<{ buffer: Buffer; jobId: string }> {
  if (!apiKey) throw new Error("FAL_KEY_MISSING");

  console.log(`[falai] Generando video (aspect: ${opts.aspectRatio || '16:9'}):`, opts.prompt.slice(0, 50) + "...");

  try {
    // Usamos Kling V1.5 para video de alta calidad
    const result: any = await fal.subscribe("fal-ai/kling-video/v1.5/standard/text-to-video", {
        input: {
            prompt: opts.prompt,
            aspect_ratio: opts.aspectRatio ?? "16:9",
            duration: opts.duration ?? "5", 
        },
        logs: true,
        onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
                update.logs.map((log) => log.message).forEach(console.log);
            }
        },
    });

    const videoUrl = result.data?.video?.url;
    if (!videoUrl) throw new Error('fal.ai no devolvió URL de video');

    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error('No se pudo descargar el video de fal.ai');
    
    return {
        buffer: Buffer.from(await videoRes.arrayBuffer()),
        jobId: result.requestId || "fal-job-" + Date.now()
    };

  } catch (error) {
      console.error("[falai] Error generando video:", error);
      throw error;
  }
}

// Wrapper para mantener compatibilidad con donde se usaba HiggsfieldTracked
export async function generateVideoTracked(opts: GenerateVideoOptions): Promise<{ buffer: Buffer; jobId: string }> {
    return generateVideo(opts);
}
