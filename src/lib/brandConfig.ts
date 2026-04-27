// src/lib/brandConfig.ts
// Configuración visual de marca — extraída de brandbooks oficiales Noriega Group
// Versión: 1.0 | Marcas: Noriega Group · Arko · Aria · Kasa Living

export type BrandKey = 'noriega_group' | 'arko' | 'aria' | 'kasa'

export interface ImageStyle {
  overlayColor: string
  overlayOpacity: number
  overlayDirection: 'bottom' | 'top'
  titleColor: string
  titleSize: number
  titleWeight: string
  titleTransform: 'uppercase' | 'none'
  bodyColor: string
  bodySize: number
  accentBar: string
  accentBarWidth: number
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  logoSize: number
  overlayType?: 'gradient' | 'color-block'
  overlayColors?: string[]
  neonGlow?: string
  neonGlowOpacity?: number
  watercolorOverlay?: boolean
  watercolorOpacity?: number
  editorialStyle?: boolean
}

export interface BrandConfig {
  displayName: string
  tagline: string
  logo: string
  colors: Record<string, string>
  typography: {
    display: string
    displayWeight: number
    body: string
    bodyWeight: number
    accent?: string
  }
  imageStyle: ImageStyle
  aiPromptBase: string
  formats: Record<string, { w: number; h: number }>
}

// ─── NORIEGA GROUP ────────────────────────────────────────────────────────────
const noriegaGroup: BrandConfig = {
  displayName: 'Noriega Group',
  tagline: 'WE BUILD FUTURE',
  logo: 'noriega_group_logo.png',
  colors: {
    primary:   '#441e44',
    secondary: '#64fbea',
    accent:    '#952a95',
    dark:      '#211e1f',
    lightGray: '#b8b4b8',
    midGray:   '#5d5a5d',
    white:     '#ffffff',
  },
  typography: {
    display: 'Helvetica Neue', displayWeight: 300,
    body: 'Century Gothic',    bodyWeight: 400,
    accent: 'Mistral',
  },
  imageStyle: {
    overlayColor: '#211e1f', overlayOpacity: 0.60, overlayDirection: 'bottom',
    titleColor: '#ffffff',   titleSize: 0.065, titleWeight: '300', titleTransform: 'uppercase',
    bodyColor: '#b8b4b8',    bodySize: 0.028,
    accentBar: '#952a95',    accentBarWidth: 0.08,
    logoPosition: 'top-left', logoSize: 0.055,
  },
  aiPromptBase: 'luxury real estate Dominican Republic, architectural photography, dark dramatic lighting, premium corporate aesthetic, purple and black tones, modern minimalist composition, cinematic quality',
  formats: {
    post:      { w: 1080, h: 1080 },
    story:     { w: 1080, h: 1920 },
    landscape: { w: 1200, h: 628  },
    portrait:  { w: 1080, h: 1350 },
  },
}

// ─── ARKO ─────────────────────────────────────────────────────────────────────
const arko: BrandConfig = {
  displayName: 'Arko Golf & Residences',
  tagline: 'Vibrant Lifestyle',
  logo: 'arko_logo.png',
  colors: {
    primary:    '#000000',
    secondary:  '#60a909',
    accent:     '#b51a7d',
    electric:   '#0028b9',
    neonPurple: '#5d00b8',
    lightBg:    '#dfdfe1',
  },
  typography: {
    display: 'Cítrica',  displayWeight: 400,
    body: 'Myriad Pro',  bodyWeight: 300,
  },
  imageStyle: {
    overlayColor: '#000000', overlayOpacity: 0.65, overlayDirection: 'bottom',
    titleColor: '#ffffff',   titleSize: 0.070, titleWeight: '400', titleTransform: 'uppercase',
    bodyColor: '#dfdfe1',    bodySize: 0.030,
    accentBar: '#b51a7d',    accentBarWidth: 0.10,
    logoPosition: 'top-left', logoSize: 0.052,
    neonGlow: '#5d00b8',     neonGlowOpacity: 0.15,
  },
  aiPromptBase: 'luxury golf residence Caribbean nighttime architecture, neon accent lighting purple pink electric blue, BOHO chic tropical aesthetic, pool rooftop jacuzzi Vista Cana Dominican Republic, dramatic dark background, cinematic architectural photography',
  formats: {
    post:      { w: 1080, h: 1080 },
    story:     { w: 1080, h: 1920 },
    landscape: { w: 1200, h: 628  },
    small:     { w: 470,  h: 246  },
  },
}

// ─── ARIA ─────────────────────────────────────────────────────────────────────
const aria: BrandConfig = {
  displayName: 'Aria Suites & Residences',
  tagline: 'Simple Living',
  logo: 'aria_logo.png',
  colors: {
    primary:     '#369d9a',
    secondary:   '#a0cac7',
    dark:        '#000000',
    artPavilion: '#06376b',
    tealDeep:    '#16788d',
    magenta:     '#c13271',
  },
  typography: {
    display: 'Black Diamond', displayWeight: 400,
    body: 'Abhaya Libre',     bodyWeight: 400,
  },
  imageStyle: {
    overlayColor: '#369d9a', overlayOpacity: 0.40, overlayDirection: 'bottom',
    titleColor: '#ffffff',   titleSize: 0.058, titleWeight: '400', titleTransform: 'none',
    bodyColor: '#ffffff',    bodySize: 0.026,
    accentBar: '#369d9a',    accentBarWidth: 0.06,
    logoPosition: 'top-left', logoSize: 0.060,
    watercolorOverlay: true, watercolorOpacity: 0.12,
  },
  aiPromptBase: 'Caribbean resort lifestyle photography, turquoise water tones, artistic watercolor aesthetic, simple modern tropical living Punta Cana, soft natural light, relaxed sophisticated atmosphere, bold free spirited contrasts',
  formats: {
    post:      { w: 1080, h: 1080 },
    story:     { w: 1080, h: 1920 },
    landscape: { w: 1200, h: 628  },
    portrait:  { w: 1080, h: 1350 },
  },
}

// ─── KASA LIVING ──────────────────────────────────────────────────────────────
const kasa: BrandConfig = {
  displayName: 'Kasa Living',
  tagline: 'Lifestyle',
  logo: 'kasa_logo.png',
  colors: {
    orange: '#dd9560',
    pink:   '#a34b75',
    purple: '#68438a',
    olive:  '#969a55',
    gray:   '#6b6b6b',
    dark:   '#1a1a1a',
    white:  '#ffffff',
  },
  typography: {
    display: 'Anton',      displayWeight: 400,
    body: 'Avenir LT Std', bodyWeight: 400,
  },
  imageStyle: {
    overlayType: 'color-block',
    overlayColors: ['#dd9560', '#a34b75', '#68438a', '#969a55'],
    overlayColor: '#a34b75', overlayOpacity: 0.55, overlayDirection: 'bottom',
    titleColor: '#ffffff',   titleSize: 0.072, titleWeight: '400', titleTransform: 'uppercase',
    bodyColor: '#ffffff',    bodySize: 0.030,
    accentBar: '#a34b75',    accentBarWidth: 0.09,
    logoPosition: 'top-left', logoSize: 0.058,
    editorialStyle: true,
  },
  aiPromptBase: 'vibrant urban tropical lifestyle photography Punta Cana, fashion editorial aesthetic, color-block composition, orange pink purple olive palette, young sophisticated Caribbean real estate, dynamic energetic atmosphere, luxury modern apartment amenities pool',
  formats: {
    post:      { w: 1080, h: 1080 },
    story:     { w: 1080, h: 1920 },
    landscape: { w: 1200, h: 628  },
    portrait:  { w: 1080, h: 1350 },
  },
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────

export const BRAND_CONFIGS: Record<BrandKey, BrandConfig> = {
  noriega_group: noriegaGroup,
  arko,
  aria,
  kasa,
}

/**
 * Detecta la marca a partir del nombre del post y el campo project
 * que ya genera el calendario de la Fase 2.
 */
export function detectBrand(postName: string, project?: string): BrandKey {
  const text = `${postName} ${project ?? ''}`.toLowerCase()
  if (text.includes('arko'))  return 'arko'
  if (text.includes('aria'))  return 'aria'
  if (text.includes('kasa'))  return 'kasa'
  return 'noriega_group'
}

/**
 * Construye el prompt completo para fal.ai combinando:
 * - prompt base de la marca (estilo visual, paleta, atmósfera)
 * - contentDirection del post (qué debe mostrar esta imagen específica)
 * - composición correcta según el formato (cuadrado, vertical, horizontal)
 */
export function buildImagePrompt(
  brand: BrandKey,
  contentDirection: string,
  format: string = 'post'
): string {
  const config = BRAND_CONFIGS[brand]
  const fmt = config.formats[format] ?? config.formats['post']
  const ratio = fmt.w / fmt.h
  const composition = ratio > 1.1
    ? 'wide landscape composition'
    : ratio < 0.9
    ? 'vertical portrait composition'
    : 'square composition'

  return [
    config.aiPromptBase,
    contentDirection,
    composition,
    'photorealistic, ultra-high quality, 4K, professional photography',
    'no text overlays, no watermarks, no logos, no UI elements',
  ].filter(Boolean).join(', ')
}
