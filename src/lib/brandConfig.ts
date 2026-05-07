// src/lib/brandConfig.ts
// Configuración visual de marca — extraída de blueprints oficiales Noriega Group
// Actualizado con datos reales de los Business Blueprints de cada proyecto

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
// Desarrolladora verticalmente integrada · 35 años · Venezuela + República Dominicana
// Filosofía: ubicación primero, producto después · Tagline: WE BUILD FUTURE
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
    overlayColor: '#211e1f', overlayOpacity: 0.65, overlayDirection: 'bottom',
    titleColor: '#ffffff',   titleSize: 0.065, titleWeight: '300', titleTransform: 'uppercase',
    bodyColor: '#b8b4b8',    bodySize: 0.028,
    accentBar: '#952a95',    accentBarWidth: 0.08,
    logoPosition: 'top-left', logoSize: 0.055,
  },
  // 35 años de trayectoria, integración vertical completa (terreno→desarrollo→construcción→venta)
  aiPromptBase: 'vertically integrated luxury real estate developer Dominican Republic with 35 years of experience, premium corporate architectural photography, cinematic dark dramatic lighting, deep plum purple #441e44 and near-black #211e1f color palette with teal #64fbea accents, sophisticated modern minimalist architectural composition, Punta Cana development skyline, authoritative and trustworthy corporate brand presence, strategic location development, high-end investment real estate',
  formats: {
    post:      { w: 1080, h: 1350 },
    story:     { w: 1080, h: 1920 },
    landscape: { w: 1200, h: 628  },
    portrait:  { w: 1080, h: 1350 },
  },
}

// ─── ARKO GOLF & RESIDENCES ───────────────────────────────────────────────────
// Vista Cana · 154 unidades (128 aptos + 26 rooftops) · 24 swim-up apartments
// Arquitectura mediterránea blanca · Arcos como elemento central
// Colores reales: NAVY #1B2E3D | GOLD #B8973A | CREAM #F7F3EE
// Slogan: "La armonía de vivir en el Caribe" / "Armonía & Pureza en cada detalle"
const arko: BrandConfig = {
  displayName: 'Arko Golf & Residences',
  tagline: 'La armonía de vivir en el Caribe',
  logo: 'arko_logo.png',
  colors: {
    navy:      '#1B2E3D',
    gold:      '#B8973A',
    cream:     '#F7F3EE',
    white:     '#FFFFFF',
    deepGreen: '#2D4A3E',
    dustyRose: '#C4A49A',
    warmBeige: '#E8DDD0',
  },
  typography: {
    display: 'Cítrica',  displayWeight: 400,
    body: 'Myriad Pro',  bodyWeight: 300,
  },
  imageStyle: {
    overlayColor: '#1B2E3D', overlayOpacity: 0.55, overlayDirection: 'bottom',
    titleColor: '#F7F3EE',   titleSize: 0.065, titleWeight: '300', titleTransform: 'none',
    bodyColor: '#B8973A',    bodySize: 0.028,
    accentBar: '#B8973A',    accentBarWidth: 0.09,
    logoPosition: 'top-left', logoSize: 0.055,
  },
  // Arquitectura mediterránea blanca · Arcos arquitectónicos · Campo de golf iluminado
  // 3 bloques en chevron · Biofílico · Tranquilidad · Vista Cana (comunidad planificada)
  // Interior: verdes profundos, beige cálido, rosa polvoriento, terrazzo, madera clara
  aiPromptBase: 'Mediterranean white contemporary residential architecture Vista Cana Dominican Republic, pure white stepped arched facades with black metal window frames, illuminated golf course fairway views at golden hour and twilight, lush tropical native landscaping with deep green palms, biophilic design with warm beige and dusty rose and terrazzo textures, light wood floors and cream linen textiles, turquoise blue swim-up pool reflecting white arches, 3 building blocks in chevron V-formation, peaceful serene Caribbean lifestyle community atmosphere, soft warm natural light, architectural arches framing nature as living paintings, navy and gold accents, luxury calm tranquil residential resort',
  formats: {
    post:      { w: 1080, h: 1350 },
    story:     { w: 1080, h: 1920 },
    landscape: { w: 1200, h: 628  },
    small:     { w: 470,  h: 246  },
  },
}

// ─── ARIA SUITES & RESIDENCES ─────────────────────────────────────────────────
// Downtown Punta Cana · ÚNICO proyecto mixto (residencial + comercial)
// 174 apartamentos + 50 locales + 63 kioscos · 4 sub-marcas
// Colores reales: NAVY #1B2E3D | GOLD #B8973A | CREAM #F7F3EE
// Interior: blanco marfil · verde jade suave · gris cálido · madera clara
// Slogan: "Un Oasis... de Exclusividad" / "We are in MOTION"
const aria: BrandConfig = {
  displayName: 'Aria Suites & Residences',
  tagline: 'Un Oasis de Exclusividad',
  logo: 'aria_logo.png',
  colors: {
    navy:      '#1B2E3D',
    gold:      '#B8973A',
    cream:     '#F7F3EE',
    ivory:     '#FAFAF7',
    jade:      '#4A8C6B',
    warmGrey:  '#8C8C8A',
    lightWood: '#C8A97E',
  },
  typography: {
    display: 'Black Diamond', displayWeight: 400,
    body: 'Abhaya Libre',     bodyWeight: 400,
  },
  imageStyle: {
    overlayColor: '#1B2E3D', overlayOpacity: 0.50, overlayDirection: 'bottom',
    titleColor: '#F7F3EE',   titleSize: 0.060, titleWeight: '300', titleTransform: 'none',
    bodyColor: '#B8973A',    bodySize: 0.026,
    accentBar: '#B8973A',    accentBarWidth: 0.08,
    logoPosition: 'top-left', logoSize: 0.058,
  },
  // Único mixto de Downtown PC · Art Pavilion + City Center + City Walk + Residencias
  // IKEA a 500m · 15 min del aeropuerto · Smart home · Cocina italiana
  // Rooftop: gym interior/exterior, jacuzzis, solarium, pista running, lounge
  // Estructura en fideicomiso · 9,973m² terreno · 26,047m² construcción
  aiPromptBase: 'unique mixed-use luxury urban development Downtown Punta Cana Dominican Republic, navy #1B2E3D and gold #B8973A and cream #F7F3EE color palette, ivory white and soft jade green and warm grey and light wood interiors, Italian modular kitchen with brushed stainless steel appliances, smart home technology with automated blinds and lighting, dramatic central atrium with natural light flooding multiple floors, art pavilion cultural spaces with gallery aesthetics, rooftop with infinity-edge jacuzzis and solarium and running track, modern urban oasis design, sophisticated lifestyle with Caribbean warmth, mixed commercial and residential architecture, pedestrian promenade with kiosks and gardens, "Un Oasis de Exclusividad"',
  formats: {
    post:      { w: 1080, h: 1350 },
    story:     { w: 1080, h: 1920 },
    landscape: { w: 1200, h: 628  },
    portrait:  { w: 1080, h: 1350 },
  },
}

// ─── KASA LIVING (+ KASA PUNTA CANA RESIDENCES) ──────────────────────────────
// Downtown Punta Cana · 109 aptos · Inversión + renta turística + gestión hotelera
// Kasa Residences (entregado) + Kasa Living (en construcción, Q1 2025)
// CONFOTUR · Cocina italiana modular · Smart home · Todo incluido desde día 1
// 24 terrazas privadas con jacuzzi y BBQ · Acceso peatonal a Aria (80+ locales)
// Ecosistema: Dolphin Discovery, Coco Bongo, Hard Rock, Mall, IKEA, Hilton GI
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
    overlayColor: '#1a1a1a', overlayOpacity: 0.55, overlayDirection: 'bottom',
    titleColor: '#ffffff',   titleSize: 0.072, titleWeight: '400', titleTransform: 'uppercase',
    bodyColor: '#ffffff',    bodySize: 0.030,
    accentBar: '#a34b75',    accentBarWidth: 0.09,
    logoPosition: 'top-left', logoSize: 0.058,
    editorialStyle: true,
  },
  // Inversión activa · Renta vacacional · Gestión hotelera integrada · CONFOTUR
  // Pisos porcelanato importado español · Cocina italiana modular · Smart home
  // Walkable: Dolphin Discovery, Coco Bongo, Hard Rock, IKEA, Hilton Garden Inn
  // 24 terrazas privadas con jacuzzi y BBQ · Acceso a Aria (80+ comercios)
  aiPromptBase: 'vibrant urban tropical investment apartment photography Downtown Punta Cana Dominican Republic, walkable city lifestyle steps from Dolphin Discovery Coco Bongo Hard Rock Café IKEA Hilton Garden Inn, luxury turnkey apartments with imported Spanish porcelain floors Italian modular kitchen smart home automation smart blinds and locks, rooftop private terrace with jacuzzi and BBQ overlooking urban Punta Cana, orange #dd9560 and pink #a34b75 and purple #68438a and olive #969a55 color-block editorial palette, fashion-forward urban real estate photography, active energetic ambitious Caribbean urban atmosphere, young sophisticated investors and professionals, CONFOTUR tax benefit investment property',
  formats: {
    post:      { w: 1080, h: 1350 },
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
 * que genera el calendario de la Fase 2.
 */
export function detectBrand(postName: string, project?: string): BrandKey {
  const text = `${postName} ${project ?? ''}`.toLowerCase()
  if (text.includes('arko'))  return 'arko'
  if (text.includes('aria'))  return 'aria'
  if (text.includes('kasa'))  return 'kasa'
  return 'noriega_group'
}

/**
 * Construye el prompt base para Higgsfield combinando:
 * - prompt base de la marca (estilo visual, paleta, atmósfera — extraído del blueprint)
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
    'no text overlays, no watermarks, no logos, no UI elements',
  ].filter(Boolean).join(', ')
}
