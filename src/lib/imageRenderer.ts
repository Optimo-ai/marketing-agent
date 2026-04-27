// src/lib/imageRenderer.ts
// Motor de renderizado de imágenes — sharp + @napi-rs/canvas
// Aplica brand, copy, overlay y logo a cada imagen del calendario

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import { BRAND_CONFIGS, BrandKey, BrandConfig } from './brandConfig'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export interface RenderInput {
  brand: BrandKey
  format: string                // 'post' | 'story' | 'landscape' | 'portrait'
  title: string                 // Título del post (copy principal)
  body?: string                 // Subtítulo o descripción corta
  sourceImageBuffer?: Buffer    // Imagen cruda desde Drive (puede ser null)
  logoBuffer?: Buffer           // Logo de la marca (PNG transparente)
  outputFormat?: 'png' | 'jpg'
}

export interface RenderOutput {
  buffer: Buffer
  width: number
  height: number
  mimeType: string
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

// ─── MOTOR PRINCIPAL ──────────────────────────────────────────────────────────

export async function renderImage(input: RenderInput): Promise<RenderOutput> {
  const config = BRAND_CONFIGS[input.brand]
  const fmt = config.formats[input.format] ?? config.formats['post']
  const W = fmt.w
  const H = fmt.h
  const style = config.imageStyle
  const outputFormat = input.outputFormat ?? 'jpg'

  // 1. Canvas base
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  // 2. Fondo sólido de respaldo
  ctx.fillStyle = style.overlayColor
  ctx.fillRect(0, 0, W, H)

  // 3. Imagen de fondo (si existe)
  if (input.sourceImageBuffer) {
    // Normalizar con sharp: resize cover + orientación correcta
    const normalized = await sharp(input.sourceImageBuffer)
      .rotate()                          // auto-rotate por EXIF
      .resize(W, H, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 92 })
      .toBuffer()

    const img = await loadImage(normalized)
    ctx.drawImage(img, 0, 0, W, H)
  }

  // 4. Overlay degradado
  const gradient = ctx.createLinearGradient(0, H * 0.25, 0, H)
  gradient.addColorStop(0, hexToRgba('#000000', 0))
  gradient.addColorStop(0.45, hexToRgba(style.overlayColor, style.overlayOpacity * 0.5))
  gradient.addColorStop(1, hexToRgba(style.overlayColor, style.overlayOpacity))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)

  // 4b. Neon glow (Arko)
  if (style.neonGlow && style.neonGlowOpacity) {
    const neonGrad = ctx.createLinearGradient(0, H * 0.6, 0, H)
    neonGrad.addColorStop(0, hexToRgba(style.neonGlow, 0))
    neonGrad.addColorStop(1, hexToRgba(style.neonGlow, style.neonGlowOpacity))
    ctx.fillStyle = neonGrad
    ctx.fillRect(0, 0, W, H)
  }

  // 5. Barra de acento (línea de color de marca)
  const titleY = H * 0.58
  const barH = Math.max(3, Math.round(H * 0.005))
  const barW = Math.round(W * style.accentBarWidth)
  ctx.fillStyle = style.accentBar
  ctx.fillRect(Math.round(W * 0.07), titleY - Math.round(H * 0.055), barW, barH)

  // 6. Título
  if (input.title) {
    const titleSize = Math.round(H * style.titleSize)
    ctx.font = `${style.titleWeight} ${titleSize}px sans-serif`
    ctx.fillStyle = style.titleColor
    ctx.textBaseline = 'top'
    const displayTitle = style.titleTransform === 'uppercase'
      ? input.title.toUpperCase()
      : input.title
    const titleLines = wrapText(ctx, displayTitle, W * 0.86).slice(0, 3)
    titleLines.forEach((line, i) => {
      ctx.fillText(line, W * 0.07, titleY + i * (titleSize * 1.18))
    })
  }

  // 7. Cuerpo / subtítulo
  if (input.body) {
    const bodySize = Math.round(H * style.bodySize)
    ctx.font = `400 ${bodySize}px sans-serif`
    ctx.fillStyle = style.bodyColor
    ctx.textBaseline = 'top'
    const bodyY = H * 0.74
    const bodyLines = wrapText(ctx, input.body, W * 0.86).slice(0, 3)
    bodyLines.forEach((line, i) => {
      ctx.fillText(line, W * 0.07, bodyY + i * (bodySize * 1.5))
    })
  }

  // 8. Color-block accent esquina (Kasa)
  if (style.editorialStyle && style.overlayColors && style.overlayColors.length > 0) {
    const blockH = Math.round(H * 0.006)
    const blockW = Math.round(W / style.overlayColors.length)
    style.overlayColors.forEach((color, i) => {
      ctx.fillStyle = color
      ctx.fillRect(i * blockW, H - blockH, blockW, blockH)
    })
  }

  // 9. Logo
  if (input.logoBuffer) {
    try {
      const logoH = Math.round(H * style.logoSize)
      const logoResized = await sharp(input.logoBuffer)
        .resize(null, logoH, { fit: 'inside' })
        .png()
        .toBuffer()
      const logoImg = await loadImage(logoResized)
      const logoW = (logoImg.width / logoImg.height) * logoH
      const pad = Math.round(W * 0.055)
      ctx.globalAlpha = 0.92
      ctx.drawImage(logoImg, pad, pad, logoW, logoH)
      ctx.globalAlpha = 1.0
    } catch {
      // Logo no disponible — continuar sin él
    }
  } else {
    // Placeholder texto de marca
    const badgeSize = Math.round(H * 0.022)
    ctx.font = `700 ${badgeSize}px sans-serif`
    ctx.fillStyle = style.accentBar
    ctx.textBaseline = 'top'
    ctx.fillText(`● ${config.displayName.toUpperCase()}`, W * 0.055, H * 0.052)
  }

  // 10. Tagline pequeño
  const tagSize = Math.round(H * 0.018)
  ctx.font = `300 ${tagSize}px sans-serif`
  ctx.fillStyle = hexToRgba('#ffffff', 0.45)
  ctx.textBaseline = 'bottom'
  ctx.fillText(config.tagline, W * 0.07, H * 0.955)

  // 11. Export
  const rawBuffer = canvas.toBuffer('image/png')

  let finalBuffer: Buffer
  let mimeType: string

  if (outputFormat === 'jpg') {
    finalBuffer = await sharp(rawBuffer)
      .jpeg({ quality: 94, mozjpeg: true })
      .toBuffer()
    mimeType = 'image/jpeg'
  } else {
    finalBuffer = await sharp(rawBuffer)
      .png({ compressionLevel: 8 })
      .toBuffer()
    mimeType = 'image/png'
  }

  return { buffer: finalBuffer, width: W, height: H, mimeType }
}

// ─── BATCH RENDER ─────────────────────────────────────────────────────────────
// Renderiza múltiples formatos de un mismo post en paralelo

export async function renderAllFormats(
  input: Omit<RenderInput, 'format'>,
  formats: string[] = ['post', 'story', 'landscape']
): Promise<Record<string, RenderOutput>> {
  const results = await Promise.all(
    formats.map(fmt => renderImage({ ...input, format: fmt }).then(r => [fmt, r] as const))
  )
  return Object.fromEntries(results)
}
