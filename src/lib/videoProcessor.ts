// src/lib/videoProcessor.ts
// Post-procesamiento de video generado por Higgsfield:
//   1. Quema subtítulos con drawtext (Helvetica Neue Thin, blanco, centrado abajo)
//   2. Genera end card de 2s: fondo negro + logo Noriega Group + noriegagroup.com
//   3. Concatena: [video principal] + [end card]
// Resultado: MP4 listo para publicar con branding completo

import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { renderImage, loadBrandLogo } from './imageRenderer'
import { BrandKey } from './brandConfig'

// Apuntar fluent-ffmpeg al binario estático
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic as string)
}

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export interface VideoProcessOptions {
  videoBuffer:  Buffer         // video MP4 crudo de Higgsfield
  subtitle:     string         // texto del subtítulo (contentDirection truncado)
  brand:        BrandKey
  logoBuffer?:  Buffer         // PNG/JPG del logo
  outputFormat?: 'mp4'         // siempre mp4 por ahora
}

export interface VideoProcessResult {
  buffer:   Buffer
  mimeType: string
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function tmpFile(ext: string): string {
  return path.join(os.tmpdir(), `ng_video_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`)
}

function runFfmpeg(cmd: ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    cmd
      .on('error', (err: Error) => reject(err))
      .on('end', () => resolve())
      .run()
  })
}

// Escapa texto para el filtro drawtext de ffmpeg
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "’")   // apóstrofe tipográfico, evita romper la comilla
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
}

// ─── PIPELINE PRINCIPAL ───────────────────────────────────────────────────────

export async function processVideo(opts: VideoProcessOptions): Promise<VideoProcessResult> {
  const { videoBuffer, subtitle, brand } = opts
  // Carga logo desde disco (blanco/negro invertido) o usa el que viene del frontend
  const logoBuffer = await loadBrandLogo(brand, opts.logoBuffer)

  // Archivos temporales
  const rawVideoPath    = tmpFile('mp4')
  const subtitledPath   = tmpFile('mp4')
  const endCardPngPath  = tmpFile('png')
  const endCardVidPath  = tmpFile('mp4')
  const finalPath       = tmpFile('mp4')
  const concatListPath  = tmpFile('txt')

  try {
    // ── PASO 1: escribir video crudo en disco ────────────────────────────────
    fs.writeFileSync(rawVideoPath, videoBuffer)

    // ── PASO 2: quemar subtítulos ────────────────────────────────────────────
    // Fuente: buscar helvetica-neue-thin.ttf en public/fonts, si no existe usar
    // la fuente sans-serif que tenga ffmpeg disponible
    const fontsDir  = path.join(process.cwd(), 'public', 'fonts')
    const hnThinPath = path.join(fontsDir, 'helvetica-neue-thin.ttf')
    const fontFile   = fs.existsSync(hnThinPath) ? hnThinPath : ''

    const text = escapeDrawtext(subtitle.slice(0, 72))

    // Construir filtro drawtext
    // - Fondo semi-transparente (shadowcolor negro, shadowx/y = 0 con box=1)
    // - Texto blanco, centrado horizontalmente, 8% desde abajo
    const fontPath = fontFile ? `fontfile='${fontFile.replace(/\\/g, '/').replace(/:/g, '\\:')}':` : ''
    const drawtextFilter = [
      `drawtext=`,
      `${fontPath}`,
      `text='${text}':`,
      `fontcolor=white:`,
      `fontsize=36:`,
      `font=Helvetica:`,
      `x=(w-text_w)/2:`,
      `y=h-th-60:`,
      `box=1:`,
      `boxcolor=black@0.45:`,
      `boxborderw=12`,
    ].join('')

    await runFfmpeg(
      ffmpeg(rawVideoPath)
        .videoFilters(drawtextFilter)
        .videoCodec('libx264')
        .outputOptions(['-crf 22', '-preset fast', '-pix_fmt yuv420p', '-an'])
        .output(subtitledPath)
    )

    // ── PASO 3: generar end card con renderImage ─────────────────────────────
    // Fondo negro, logo centrado, noriegagroup.com — sin foto de fondo
    const endCard = await renderImage({
      brand,
      format:      'landscape',   // 1200×628 para video 16:9
      title:       '',
      body:        undefined,
      logoBuffer,
      outputFormat: 'png',
      slideIndex:  0,
      showWebsite: true,
    })
    fs.writeFileSync(endCardPngPath, endCard.buffer)

    // ── PASO 4: convertir end card PNG → clip de 2 segundos ──────────────────
    // Obtener resolución del video subtitulado para hacer match
    const videoInfo = await getVideoSize(subtitledPath)
    const endW = videoInfo.width  ?? 1280
    const endH = videoInfo.height ?? 720

    await runFfmpeg(
      ffmpeg()
        .input(endCardPngPath)
        .inputOptions(['-loop 1'])
        .videoFilters(`scale=${endW}:${endH}:force_original_aspect_ratio=decrease,pad=${endW}:${endH}:(ow-iw)/2:(oh-ih)/2:black`)
        .videoCodec('libx264')
        .outputOptions(['-t 2', '-crf 22', '-preset fast', '-pix_fmt yuv420p', '-an'])
        .output(endCardVidPath)
    )

    // ── PASO 5: concatenar video + end card ───────────────────────────────────
    const concatContent = `file '${subtitledPath.replace(/\\/g, '/')}'\nfile '${endCardVidPath.replace(/\\/g, '/')}'\n`
    fs.writeFileSync(concatListPath, concatContent)

    await runFfmpeg(
      ffmpeg()
        .input(concatListPath)
        .inputOptions(['-f concat', '-safe 0'])
        .videoCodec('copy')
        .outputOptions(['-movflags +faststart'])
        .output(finalPath)
    )

    // ── PASO 6: leer resultado ────────────────────────────────────────────────
    const finalBuffer = fs.readFileSync(finalPath)
    return { buffer: finalBuffer, mimeType: 'video/mp4' }

  } finally {
    // Limpiar archivos temporales
    for (const f of [rawVideoPath, subtitledPath, endCardPngPath, endCardVidPath, finalPath, concatListPath]) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch {}
    }
  }
}

// ─── HELPER: obtener dimensiones del video ────────────────────────────────────

function getVideoSize(filePath: string): Promise<{ width?: number; height?: number }> {
  return new Promise(resolve => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err || !meta) return resolve({})
      const stream = meta.streams?.find(s => s.codec_type === 'video')
      resolve({ width: stream?.width, height: stream?.height })
    })
  })
}
