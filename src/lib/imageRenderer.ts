// src/lib/imageRenderer.ts
// Motor de renderizado — implementa el Noriega Group Brand Style del canvas-design-pro skill:
//   - 1080×1350 px (portrait 4:5) para posts y carruseles
//   - Helvetica Neue Thin, texto blanco, centrado
//   - Foto: imagen sharp sin blur + degradado negro suave (top 5%→bot 42%)
//   - Negro: fondo negro puro
//   - Logo solo en slide 01
//   - Divisores 1px blancos, opacidad ~43%
//   - NUNCA contador de slides

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import { BRAND_CONFIGS, BrandKey } from './brandConfig'

// ─── LOGO EN DISCO ───────────────────────────────────────────────────────────

const LOGOS_DIR   = path.join(process.cwd(), 'public', 'logos')
const BRAND_LOGOS: Record<string, string> = {
  noriega_group: path.join(LOGOS_DIR, 'noriega_group_logo.png'),
  arko:          path.join(LOGOS_DIR, 'arko_logo.png'),
  aria:          path.join(LOGOS_DIR, 'aria_logo.png'),
  kasa:          path.join(LOGOS_DIR, 'kasa_logo.png'),
}

// Carga el logo de disco (ya invertido: blanco sobre negro)
// Si no existe en disco, usa el buffer que viene del frontend
export async function loadBrandLogo(brand: string, fallback?: Buffer): Promise<Buffer | undefined> {
  const diskPath = BRAND_LOGOS[brand]
  if (diskPath && fs.existsSync(diskPath)) {
    return fs.readFileSync(diskPath)
  }
  return fallback
}

// ─── FUENTES ──────────────────────────────────────────────────────────────────

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')
const HN_THIN   = path.join(FONTS_DIR, 'helvetica-neue-thin.ttf')
const FONT_FAMILY = 'Helvetica Neue Thin'

;(function registerFonts() {
  if (!fs.existsSync(FONTS_DIR)) return
  try {
    const files = fs.readdirSync(FONTS_DIR)
    for (const file of files) {
      if (!file.endsWith('.ttf') && !file.endsWith('.otf')) continue
      const family = path.basename(file, path.extname(file))
        .replace(/[-_]/g, ' ')
        .replace(/Regular|Bold|Italic|Light|Medium|Thin|Black/gi, '')
        .trim()
      try { GlobalFonts.registerFromPath(path.join(FONTS_DIR, file), family) } catch {}
    }
    // Registrar Helvetica Neue Thin con su nombre específico
    if (fs.existsSync(HN_THIN)) {
      GlobalFonts.registerFromPath(HN_THIN, FONT_FAMILY)
    }
  } catch {}
})()

// ─── CONSTANTES DE DISEÑO ─────────────────────────────────────────────────────

const W = 1080
const H = 1350
const WHITE = '#ffffff'
const BLACK = '#000000'

// Degradado foto: opacidad top→bot (5%→42%)
const GRAD_TOP = 0.05
const GRAD_BOT = 0.42

// Logo: 218px ancho, centrado, y≈100
const LOGO_W = 218
const LOGO_Y = 100

// Divisores: 1px, ±42px del centro horizontal, opacidad ~43% (110/255)
const DIV_HALF = 42
const DIV_OPACITY = Math.round(110 / 255 * 255)  // 110

// Zona de texto: 45–65% del canvas (y 607–877)
const TEXT_ZONE_TOP    = Math.round(H * 0.45)   // 607
const TEXT_ZONE_BOTTOM = Math.round(H * 0.75)   // 1012
const TEXT_CENTER_Y    = Math.round(H * 0.58)   // 783 — punto de anclaje del contenido

// Tamaños de fuente
const SIZE_HEADLINE = 64   // título principal (ajustado según líneas)
const SIZE_BODY     = 30   // línea de apoyo
const SIZE_WEBSITE  = 24   // noriegagroup.com

// ─── TIPOS PÚBLICOS ───────────────────────────────────────────────────────────

export interface RenderInput {
  brand:              BrandKey
  format:             string           // 'post' | 'story' | 'landscape' — afecta dimensiones
  title:              string
  body?:              string
  sourceImageBuffer?: Buffer           // foto cruda; si no hay → fondo negro
  logoBuffer?:        Buffer
  outputFormat?:      'png' | 'jpg'
  // Carrusel
  slideIndex?:        number           // 0-based; logo solo en slide 0
  totalSlides?:       number
  showWebsite?:       boolean          // mostrar noriegagroup.com (último slide)
}

export interface RenderOutput {
  buffer:   Buffer
  width:    number
  height:   number
  mimeType: string
}

// Entrada para slides de carrusel (mantiene compat con generate-media/route.ts)
export interface CarouselSlideInput extends RenderInput {
  slideNumber: number    // 1-based
  totalSlides: number
}

// ─── HELPER: DIMENSIONES POR FORMATO ─────────────────────────────────────────

function getDimensions(format: string): { w: number; h: number } {
  const f = (format ?? '').toLowerCase()
  if (f === 'story')                              return { w: 1080, h: 1920 }
  if (f === 'landscape' || f.includes('banner')) return { w: 1200, h: 628  }
  return { w: W, h: H }  // post / carousel → 1080×1350
}

// ─── HELPER: TEXTO CENTRADO ───────────────────────────────────────────────────

function drawCentered(ctx: any, text: string, y: number, fontSize: number, canvasW: number): number {
  const font = `300 ${fontSize}px "${FONT_FAMILY}", "Helvetica Neue", Helvetica, Arial`
  ctx.font = font
  ctx.fillStyle = WHITE
  ctx.textBaseline = 'top'
  const w = ctx.measureText(text).width
  ctx.fillText(text, (canvasW - w) / 2, y)
  return fontSize + 8
}

function wrapCentered(ctx: any, text: string, y: number, fontSize: number, canvasW: number, maxW: number): number {
  ctx.font = `300 ${fontSize}px "${FONT_FAMILY}", "Helvetica Neue", Helvetica, Arial`
  ctx.fillStyle = WHITE
  ctx.textBaseline = 'top'
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word }
    else cur = test
  }
  if (cur) lines.push(cur)
  lines.slice(0, 3).forEach((line, i) => {
    const lw = ctx.measureText(line).width
    ctx.fillText(line, (canvasW - lw) / 2, y + i * (fontSize + 10))
  })
  return lines.length * (fontSize + 10)
}

// ─── HELPER: DIVISOR ──────────────────────────────────────────────────────────

function drawDivider(ctx: any, y: number, canvasW: number) {
  ctx.globalAlpha = DIV_OPACITY / 255
  ctx.strokeStyle = WHITE
  ctx.lineWidth = 1
  const cx = canvasW / 2
  ctx.beginPath()
  ctx.moveTo(cx - DIV_HALF, y)
  ctx.lineTo(cx + DIV_HALF, y)
  ctx.stroke()
  ctx.globalAlpha = 1
}

// ─── HELPER: LOGO ─────────────────────────────────────────────────────────────

async function drawLogo(ctx: any, logoBuffer: Buffer, canvasW: number) {
  try {
    // El logo ya está en blanco-sobre-negro (invertido en disco).
    // Modo 'screen': píxeles negros del logo se vuelven invisibles,
    // los blancos aparecen blancos sobre cualquier fondo oscuro.
    const resized = await sharp(logoBuffer)
      .resize(LOGO_W, null, { fit: 'inside' })
      .grayscale()
      .png()
      .toBuffer()
    const img = await loadImage(resized)
    const lw = img.width
    const lh = img.height
    const x = (canvasW - lw) / 2
    ctx.globalAlpha = 0.95
    ctx.globalCompositeOperation = 'screen'
    ctx.drawImage(img, x, LOGO_Y - lh / 2, lw, lh)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  } catch { /* logo no disponible */ }
}

// ─── HELPER: PREPARAR FOTO ────────────────────────────────────────────────────

async function preparePhoto(buffer: Buffer, w: number, h: number): Promise<Buffer> {
  // Resize cover (sin blur), ajustar sat/brillo/contraste
  return sharp(buffer)
    .rotate()                            // auto-rotate EXIF
    .resize(w, h, { fit: 'cover', position: 'centre' })
    .modulate({ saturation: 0.92, brightness: 1.05 })
    .linear(1.02, -(128 * 0.02))        // contraste sutil
    .jpeg({ quality: 95 })
    .toBuffer()
}

// ─── HELPER: DEGRADADO FOTO ───────────────────────────────────────────────────

function drawPhotoGradient(ctx: any, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0,   `rgba(0,0,0,${GRAD_TOP})`)
  grad.addColorStop(1,   `rgba(0,0,0,${GRAD_BOT})`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

// ─── RENDERIZADOR PRINCIPAL ───────────────────────────────────────────────────

export async function renderImage(input: RenderInput): Promise<RenderOutput> {
  const { w, h } = getDimensions(input.format)
  const outputFormat = input.outputFormat ?? 'jpg'
  const isPhotoSlide = !!input.sourceImageBuffer
  const showLogo = (input.slideIndex ?? 0) === 0   // logo solo en primer slide
  const showWebsite = input.showWebsite ?? false

  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')

  // 1. Fondo
  if (isPhotoSlide) {
    const photo = await preparePhoto(input.sourceImageBuffer!, w, h)
    const img = await loadImage(photo)
    ctx.drawImage(img, 0, 0, w, h)
    drawPhotoGradient(ctx, w, h)
  } else {
    ctx.fillStyle = BLACK
    ctx.fillRect(0, 0, w, h)
  }

  // 2. Logo (solo slide 01)
  if (showLogo && input.logoBuffer) {
    await drawLogo(ctx, input.logoBuffer, w)
  } else if (showLogo && !input.logoBuffer) {
    // Placeholder nombre de marca si no hay logo
    const config = BRAND_CONFIGS[input.brand]
    ctx.font = `300 22px "${FONT_FAMILY}", Helvetica, Arial`
    ctx.fillStyle = WHITE
    ctx.textBaseline = 'top'
    ctx.globalAlpha = 0.8
    const lw = ctx.measureText(config.displayName.toUpperCase()).width
    ctx.fillText(config.displayName.toUpperCase(), (w - lw) / 2, LOGO_Y - 11)
    ctx.globalAlpha = 1
  }

  // 3. Bloque de texto (zona inferior 45-75%)
  if (input.title || input.body) {
    const maxTextW = Math.round(w * 0.78)
    let anchorY = TEXT_CENTER_Y

    // Medir altura total del bloque para centrarlo en la zona
    const titleLines = input.title
      ? Math.min(3, Math.ceil(ctx.measureText(input.title).width / maxTextW) || 1)
      : 0
    const titleH = titleLines * (SIZE_HEADLINE + 10)
    const bodyH  = input.body ? SIZE_BODY + 10 : 0
    const divH   = 20  // espacio para divisores
    const totalH = divH + titleH + (input.body ? divH + bodyH : 0)

    anchorY = Math.max(TEXT_ZONE_TOP, Math.min(TEXT_CENTER_Y, TEXT_ZONE_BOTTOM - totalH))

    // Divisor superior
    drawDivider(ctx, anchorY, w)
    anchorY += 18

    // Título
    if (input.title) {
      const titleSize = input.title.length > 30 ? SIZE_HEADLINE - 8 : SIZE_HEADLINE
      anchorY += wrapCentered(ctx, input.title, anchorY, titleSize, w, maxTextW)
      anchorY += 10
    }

    // Línea de apoyo
    if (input.body) {
      anchorY += 6
      drawCentered(ctx, input.body.slice(0, 60), anchorY, SIZE_BODY, w)
      anchorY += SIZE_BODY + 12
    }

    // Divisor inferior
    drawDivider(ctx, anchorY, w)

    // Sitio web (último slide)
    if (showWebsite) {
      ctx.globalAlpha = 0.65
      drawCentered(ctx, 'noriegagroup.com', anchorY + 22, SIZE_WEBSITE, w)
      ctx.globalAlpha = 1
    }
  } else if (showWebsite) {
    drawCentered(ctx, 'noriegagroup.com', H - 80, SIZE_WEBSITE, w)
  }

  // 4. Export
  const rawBuf = canvas.toBuffer('image/png')
  let finalBuf: Buffer
  let mimeType: string

  if (outputFormat === 'jpg') {
    finalBuf = await sharp(rawBuf).jpeg({ quality: 94, mozjpeg: true }).toBuffer()
    mimeType = 'image/jpeg'
  } else {
    finalBuf = await sharp(rawBuf).png({ compressionLevel: 8 }).toBuffer()
    mimeType = 'image/png'
  }

  return { buffer: finalBuf, width: w, height: h, mimeType }
}

// ─── CAROUSEL SLIDE ───────────────────────────────────────────────────────────
// Wrapper que mapea slideNumber (1-based) a renderImage.
// slideIndex 0 = primer slide = recibe logo.
// Slide final (slideNumber === totalSlides) recibe noriegagroup.com.

export async function renderCarouselSlide(input: CarouselSlideInput): Promise<RenderOutput> {
  return renderImage({
    ...input,
    slideIndex:  input.slideNumber - 1,
    showWebsite: input.slideNumber === input.totalSlides,
  })
}

// ─── BATCH RENDER ─────────────────────────────────────────────────────────────

export async function renderAllFormats(
  input: Omit<RenderInput, 'format'>,
  formats: string[] = ['post', 'story', 'landscape']
): Promise<Record<string, RenderOutput>> {
  const results = await Promise.all(
    formats.map(fmt => renderImage({ ...input, format: fmt }).then(r => [fmt, r] as const))
  )
  return Object.fromEntries(results)
}
