import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CAPTION_SKILL = `Eres el agente de redes sociales del Grupo Noriega — empresa inmobiliaria en República Dominicana.
Proyectos activos: KASA Punta Cana Residences y Arko Golf & Residences (Vista Cana, Higüey).
Voz de marca: Profesional pero cálida. Aspiracional. Confiable. Idioma principal: español.

Analiza el contenido visual o la descripción provista y genera captions listos para publicar.
CTAs naturales: "Escríbenos", "Solicita información", "Agenda una visita", "Link en bio".
Hashtags relevantes: inmobiliaria, PuntaCana, inversión, RepúblicaDominicana, bienesraíces, KASA, Arko.

Reglas por plataforma:
- Instagram: 100-250 palabras, primera línea = hook potente, historia→detalles→CTA, 10-15 hashtags al final
- Facebook: 60-130 palabras, tono conversacional y cercano, 3-5 hashtags, CTA a WhatsApp
- LinkedIn: 100-200 palabras, ángulo inversión/ROI/valor patrimonial, puede incluir cifras o datos
- GMB: 80-150 palabras, SEO local, mencionar el proyecto + Punta Cana/Vista Cana + teléfono/contacto

Responde ÚNICAMENTE con el JSON, sin markdown ni texto extra:
{
  "captionIG": "string",
  "captionFB": "string",
  "captionLI": "string",
  "captionGMB": "string"
}`

type ValidMime = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
const VALID_MIMES: ValidMime[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, contentType, title, description } = await req.json() as {
      imageBase64?: string
      mimeType?: string
      contentType: 'carrusel' | 'post' | 'reel'
      title?: string
      description?: string
    }

    const typeLabel =
      contentType === 'carrusel' ? 'Carrusel (múltiples imágenes / slideshow)' :
      contentType === 'reel' ? 'Reel (video corto)' :
      'Post (imagen única)'

    const contextLines = [
      `Tipo de contenido: ${typeLabel}`,
      title ? `Título: ${title}` : null,
      description ? `Contexto / descripción del creador: ${description}` : null,
    ].filter(Boolean).join('\n')

    const content: (Anthropic.ImageBlockParam | Anthropic.TextBlockParam)[] = []

    if (imageBase64 && mimeType && mimeType.startsWith('image/')) {
      const safeMime: ValidMime = VALID_MIMES.includes(mimeType as ValidMime)
        ? (mimeType as ValidMime)
        : 'image/jpeg'

      content.push({
        type: 'image',
        source: { type: 'base64', media_type: safeMime, data: imageBase64 },
      })
    }

    content.push({ type: 'text', text: contextLines })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: CAPTION_SKILL,
      messages: [{ role: 'user', content }],
    })

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')

    const clean = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const captions = JSON.parse(clean)

    return NextResponse.json({ captions })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
