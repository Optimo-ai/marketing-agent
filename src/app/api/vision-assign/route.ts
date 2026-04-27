// src/app/api/vision-assign/route.ts
// Claude Vision analiza el pool de imágenes y las asigna a los posts del calendario.
//
// Por cada imagen: etiqueta semántica (interior/exterior/amenidad/lifestyle/aéreo/render)
// Por cada post Carousel: agrupa 3-5 imágenes semánticamente similares
// Por cada post Foto/Story: asigna la imagen más relevante según contentDirection
// Posts sin imagen disponible: los marca como "needs_ai" para fal.ai

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface DriveImage {
  fileId: string
  name: string
  thumbnail: string   // data:image/jpeg;base64,...
  brand: string
}

interface CalendarPost {
  id: number | string
  name: string
  format: 'Carousel' | 'Foto' | 'Story' | 'Lead Magnet'
  project: string
  contentDirection: string
  platforms: string[]
  week: number
  suggestedDay: string
}

interface AssignedPost {
  postId: number | string
  postName: string
  format: string
  project: string
  contentDirection: string
  platforms: string[]
  week: number
  suggestedDay: string
  // Para foto simple o story:
  image?: { fileId: string; thumbnail: string; label: string }
  // Para carrusel:
  slides?: { fileId: string; thumbnail: string; label: string }[]
  // Cuando no hay imagen disponible:
  needsAI: boolean
  aiPromptHint?: string
}

// ─── PROMPT DE ANÁLISIS ───────────────────────────────────────────────────────

function buildAnalysisPrompt(
  images: { index: number; brand: string }[],
  posts: CalendarPost[]
): string {
  return `Eres el director de arte del agente de marketing de Noriega Group.

Tienes ${images.length} imágenes de las carpetas de Drive (referenciadas por índice 0..${images.length - 1}).
Tienes ${posts.length} posts del calendario que necesitan imagen.

PASO 1 — Etiqueta cada imagen con una de estas categorías:
interior | exterior | amenidad | lifestyle | aerea | render | construccion | evento | otro

PASO 2 — Asigna imágenes a posts según estas reglas:
- Post formato "Carousel": agrupa 3-5 imágenes con la misma categoría o categorías complementarias (ej: amenidad+lifestyle, exterior+aerea). Elige el grupo más coherente visualmente.
- Post formato "Foto" o "Story": asigna la imagen individual más relevante para el contentDirection del post.
- Post formato "Lead Magnet": no necesita imagen real, marcarlo como needsAI=true.
- Si no quedan imágenes para un post: marcarlo como needsAI=true con un aiPromptHint describiendo qué generar.
- Cada imagen solo puede usarse UNA VEZ.
- Prioriza que las imágenes de /kasa vayan a posts de proyecto KASA, y /arko a posts de Arko.

Posts del calendario:
${posts.map(p => `[${p.id}] ${p.format} | ${p.project} | "${p.name}" | "${p.contentDirection}"`).join('\n')}

Imágenes disponibles:
${images.map(i => `[img${i.index}] brand:${i.brand}`).join('\n')}

Responde SOLO con un JSON array, sin markdown, sin texto extra:
[{
  "postId": number|string,
  "imageIndices": number[] | null,   // índices de las imágenes asignadas (null si needsAI)
  "needsAI": boolean,
  "aiPromptHint": string | null      // solo si needsAI=true — qué debe generar la IA
}]`
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      images: DriveImage[]         // pool completo de imágenes escaneadas
      posts: CalendarPost[]        // calendario aprobado de Fase 2
    }

    const { images, posts } = body

    if (!images?.length && !posts?.length) {
      return NextResponse.json({ error: 'Faltan images o posts' }, { status: 400 })
    }

    const availableImages = images ?? []
    const calendarPosts = posts ?? []

    // ── Claude Vision: analizar imágenes y asignar ──────────────────────────
    // Construir content blocks: texto + imágenes intercaladas

    const imageBlocks: Anthropic.MessageParam['content'] = []

    // Texto inicial con el prompt
    imageBlocks.push({
      type: 'text',
      text: buildAnalysisPrompt(
        availableImages.map((img, i) => ({ index: i, brand: img.brand })),
        calendarPosts
      ),
    })

    // Agregar imágenes como bloques de visión
    for (let i = 0; i < availableImages.length; i++) {
      const img = availableImages[i]
      const [header, b64] = img.thumbnail.split(',')
      const mediaType = (header.match(/data:([^;]+)/) ?? [])[1] ?? 'image/jpeg'

      imageBlocks.push({
        type: 'text',
        text: `Imagen [img${i}] — brand: ${img.brand}:`,
      })
      imageBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: b64,
        },
      })
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-5',        // Opus para mejor razonamiento visual
      max_tokens: 4096,
      messages: [{ role: 'user', content: imageBlocks }],
    })

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')

    // Parsear JSON
    const clean = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const assignments: {
      postId: number | string
      imageIndices: number[] | null
      needsAI: boolean
      aiPromptHint: string | null
    }[] = JSON.parse(clean)

    // ── Construir respuesta enriquecida ────────────────────────────────────

    const assignedPosts: AssignedPost[] = []

    for (const assignment of assignments) {
      const post = calendarPosts.find(p => String(p.id) === String(assignment.postId))
      if (!post) continue

      const base: AssignedPost = {
        postId: post.id,
        postName: post.name,
        format: post.format,
        project: post.project,
        contentDirection: post.contentDirection,
        platforms: post.platforms,
        week: post.week,
        suggestedDay: post.suggestedDay,
        needsAI: assignment.needsAI,
        aiPromptHint: assignment.aiPromptHint ?? undefined,
      }

      if (!assignment.needsAI && assignment.imageIndices?.length) {
        const imgs = assignment.imageIndices.map(idx => availableImages[idx]).filter(Boolean)

        if (post.format === 'Carousel' && imgs.length > 1) {
          base.slides = imgs.map(img => ({
            fileId: img.fileId,
            thumbnail: img.thumbnail,
            label: img.brand,
          }))
        } else {
          base.image = {
            fileId: imgs[0].fileId,
            thumbnail: imgs[0].thumbnail,
            label: imgs[0].brand,
          }
        }
      }

      assignedPosts.push(base)
    }

    return NextResponse.json({
      assignments: assignedPosts,
      totalPosts: calendarPosts.length,
      withDriveImages: assignedPosts.filter(p => !p.needsAI).length,
      needsAI: assignedPosts.filter(p => p.needsAI).length,
    })

  } catch (err: unknown) {
    console.error('[vision-assign] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
