// src/app/api/ads-generator/route.ts
// Generador de ads — analiza imagen con Claude Vision, genera copy,
// renderiza texto sobre la imagen, sube a GHL opcionalmente.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createScheduledPost, getSocialAccounts, getLocationUsers } from '@/lib/ghl'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── ANALIZAR IMAGEN + GENERAR COPY ──────────────────────────────────────────

async function analyzeAndGenerateCopy(
  imageBase64: string,
  mimeType: string,
  idea: string,
  brand: string,
  platforms: string[]
): Promise<{
  headline: string
  subheadline: string
  cta: string
  copyIG: string
  copyFB: string
  copyLI: string | null
  recommendations: string[]
  overlayPosition: 'bottom' | 'top' | 'center'
  overlayStyle: 'dark' | 'light' | 'gradient'
}> {
  const platformList = platforms.join(', ')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType as any, data: imageBase64 },
        },
        {
          type: 'text',
          text: `Eres el director creativo de Noriega Group, empresa inmobiliaria premium en República Dominicana.

Analiza esta imagen y genera copy para un anuncio de ${brand}.
Idea del cliente: "${idea}"
Plataformas: ${platformList}

Brand voice: aspiracional, cálido, profesional. Español dominicano/latino.

Analiza la imagen (composición, colores dominantes, punto focal) para recomendar dónde colocar el texto.

Responde SOLO con este JSON, sin markdown:
{
  "headline": "título del ad — máx 6 palabras, impacto inmediato",
  "subheadline": "subtítulo — máx 12 palabras, beneficio clave",
  "cta": "llamada a acción — máx 4 palabras",
  "copyIG": "copy completo para Instagram — hook + cuerpo + CTA + hashtags",
  "copyFB": "copy completo para Facebook — conversacional, WhatsApp CTA",
  "copyLI": "copy para LinkedIn si aplica, null si no es relevante para esta imagen",
  "recommendations": ["3 recomendaciones específicas para mejorar este ad"],
  "overlayPosition": "bottom|top|center — dónde poner el overlay de texto según la imagen",
  "overlayStyle": "dark|light|gradient — según los colores de la imagen"
}`,
        },
      ],
    }],
  })

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')

  const clean = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  return JSON.parse(clean)
}

// ─── RENDERIZAR AD CON CANVAS API ────────────────────────────────────────────
// Usa el canvas nativo del navegador desde el servidor via @napi-rs/canvas

async function renderAd(
  imageBase64: string,
  headline: string,
  subheadline: string,
  cta: string,
  overlayPosition: string,
  overlayStyle: string,
  accentColor: string = '#441e44'
): Promise<string> {
  // Importación dinámica para evitar problemas en edge runtime
  const { createCanvas, loadImage } = await import('@napi-rs/canvas')
  const sharp = (await import('sharp')).default

  const W = 1080, H = 1080
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  // Fondo
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)

  // Imagen de fondo
  const imgBuf = Buffer.from(imageBase64, 'base64')
  const normalized = await sharp(imgBuf).resize(W, H, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer()
  const img = await loadImage(normalized)
  ctx.drawImage(img, 0, 0, W, H)

  // Overlay según posición y estilo
  const overlayH = H * 0.45
  let overlayY = overlayPosition === 'top' ? 0 : overlayPosition === 'center' ? H * 0.275 : H - overlayH

  const grad = ctx.createLinearGradient(
    0, overlayPosition === 'top' ? 0 : overlayY,
    0, overlayPosition === 'top' ? overlayH : H
  )

  if (overlayStyle === 'dark') {
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.4, 'rgba(0,0,0,0.6)')
    grad.addColorStop(1, 'rgba(0,0,0,0.88)')
  } else if (overlayStyle === 'light') {
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.4, 'rgba(255,255,255,0.7)')
    grad.addColorStop(1, 'rgba(255,255,255,0.92)')
  } else {
    // gradient con color de marca
    const r = parseInt(accentColor.slice(1, 3), 16)
    const g = parseInt(accentColor.slice(3, 5), 16)
    const b = parseInt(accentColor.slice(5, 7), 16)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.5, `rgba(${r},${g},${b},0.6)`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0.9)`)
  }

  ctx.fillStyle = grad
  ctx.fillRect(0, overlayPosition === 'top' ? 0 : H - overlayH, W, overlayH)

  // Colores de texto según estilo
  const textColor = overlayStyle === 'light' ? '#111111' : '#ffffff'
  const subColor  = overlayStyle === 'light' ? '#444444' : 'rgba(255,255,255,0.82)'

  // Posición Y del texto
  const textBaseY = overlayPosition === 'top'
    ? H * 0.1
    : overlayPosition === 'center'
    ? H * 0.42
    : H * 0.60

  // Barra de acento
  ctx.fillStyle = accentColor
  ctx.fillRect(W * 0.07, textBaseY - H * 0.025, W * 0.08, Math.max(3, H * 0.004))

  // Headline
  const headlineSize = Math.round(H * 0.072)
  ctx.font = `800 ${headlineSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`
  ctx.fillStyle = textColor
  ctx.textBaseline = 'top'
  ctx.fillText(headline.toUpperCase().slice(0, 40), W * 0.07, textBaseY)

  // Subheadline
  const subSize = Math.round(H * 0.032)
  ctx.font = `400 ${subSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`
  ctx.fillStyle = subColor
  ctx.fillText(subheadline.slice(0, 60), W * 0.07, textBaseY + headlineSize * 1.2)

  // CTA pill
  const ctaY = textBaseY + headlineSize * 1.2 + subSize * 1.8
  const ctaText = cta.toUpperCase()
  ctx.font = `700 ${Math.round(H * 0.022)}px 'Helvetica Neue', Helvetica, Arial, sans-serif`
  const ctaW = ctx.measureText(ctaText).width + W * 0.06
  const ctaH = H * 0.05
  ctx.fillStyle = accentColor
  ctx.beginPath()
  ctx.roundRect(W * 0.07, ctaY, ctaW, ctaH, ctaH / 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(ctaText, W * 0.07 + W * 0.03, ctaY + ctaH / 2)

  // Export como base64
  const rawBuf = canvas.toBuffer('image/png')
  const finalBuf = await sharp(rawBuf).jpeg({ quality: 92, mozjpeg: true }).toBuffer()
  return finalBuf.toString('base64')
}

// ─── SUBIR A GHL ──────────────────────────────────────────────────────────────

async function uploadToGHL(base64: string, filename: string): Promise<string> {
  const locationId = process.env.GHL_LOCATION_ID!
  const apiKey     = process.env.GHL_API_KEY!
  const buf  = Buffer.from(base64, 'base64')
  const form = new FormData()
  form.append('file', new Blob([buf], { type: 'image/jpeg' }), filename)
  form.append('name', filename)
  form.append('fileType', 'image')
  form.append('altId', locationId)
  form.append('altType', 'location')

  const res = await fetch('https://services.leadconnectorhq.com/medias/upload-file', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28' },
    body: form,
  })
  if (!res.ok) throw new Error(`GHL upload falló: ${res.status}`)
  const data = await res.json()
  return data.url ?? data.fileUrl ?? data?.data?.url ?? ''
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      action,
      imageBase64,
      mimeType = 'image/jpeg',
      idea,
      brand = 'Noriega Group',
      platforms = ['IG', 'FB'],
      // Para render:
      headline, subheadline, cta,
      overlayPosition = 'bottom',
      overlayStyle = 'dark',
      accentColor,
      // Para send_to_ghl:
      renderedBase64,
      copyIG, copyFB,
      scheduledDate, scheduledTime,
    } = body

    // ── ANALIZAR + GENERAR COPY ──
    if (action === 'analyze') {
      if (!imageBase64 || !idea) {
        return NextResponse.json({ error: 'Faltan imageBase64 e idea' }, { status: 400 })
      }
      const result = await analyzeAndGenerateCopy(imageBase64, mimeType, idea, brand, platforms)
      return NextResponse.json(result)
    }

    // ── RENDERIZAR AD ──
    if (action === 'render') {
      if (!imageBase64 || !headline) {
        return NextResponse.json({ error: 'Faltan imageBase64 y headline' }, { status: 400 })
      }
      const rendered = await renderAd(imageBase64, headline, subheadline ?? '', cta ?? '', overlayPosition, overlayStyle, accentColor)
      return NextResponse.json({ renderedBase64: rendered })
    }

    // ── ENVIAR A GHL ──
    if (action === 'send_to_ghl') {
      if (!renderedBase64) {
        return NextResponse.json({ error: 'Falta la imagen renderizada' }, { status: 400 })
      }

      const filename = `ad_${brand.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.jpg`
      const imageUrl = await uploadToGHL(renderedBase64, filename)

      // Programar en Social Planner
      let ghlResult = null
      try {
        const accounts  = await getSocialAccounts()
        const users     = await getLocationUsers()
        const userId    = users[0]?.id ?? ''
        const accountIds = accounts
          .filter((a: any) => ['instagram','facebook'].includes((a.type ?? a.platform ?? '').toLowerCase()))
          .map((a: any) => a.id)
          .slice(0, 2)

        const scheduledAt = scheduledDate && scheduledTime
          ? `${scheduledDate}T${scheduledTime}:00-04:00`
          : new Date(Date.now() + 86400000).toISOString()

        ghlResult = await createScheduledPost({
          summary: copyIG ?? copyFB ?? `Ad — ${brand}`,
          accountIds,
          scheduleDate: scheduledAt,
          mediaUrls: [imageUrl],
          postType: 'post',
          userId,
        })
      } catch (e) {
        console.warn('[ads-generator] GHL schedule error:', e)
      }

      return NextResponse.json({ imageUrl, ghlScheduled: !!ghlResult, ghlId: ghlResult?.id })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (err: unknown) {
    console.error('[ads-generator]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
