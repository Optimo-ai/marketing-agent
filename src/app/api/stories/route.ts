// src/app/api/stories/route.ts
// Analiza imagen con Claude Vision y genera 5 copys para Instagram Story

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const BRAND_VOICE: Record<string, string> = {
  'KASA':          'KASA Living — viviendas multifamiliares asequibles, comunidad, confort moderno, familia',
  'Arko':          'Arko Golf & Residences — golf, resort lifestyle, exclusividad, naturaleza, segunda residencia premium',
  'Aria':          'Aria Suites — suite premium, hotelero, servicios de lujo, experiencias únicas, inversión',
  'Noriega Group': 'Noriega Group — desarrollo inmobiliario visionario, legado, calidad de vida, República Dominicana',
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, project } = await req.json()
    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 requerido' }, { status: 400 })
    }

    const brand    = BRAND_VOICE[project] ?? BRAND_VOICE['Noriega Group']
    const brandName = project ?? 'Noriega Group'

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: (mimeType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Eres el director creativo de ${brandName}, empresa inmobiliaria premium en República Dominicana.

Marca: ${brand}

Analiza esta imagen de propiedad inmobiliaria y crea 5 copys distintos para Instagram Story (formato vertical 9:16).

Reglas:
- Máximo 12 palabras por copy
- Tono aspiracional, cálido, en español latino
- Cada copy con un enfoque distinto: emocional, descriptivo, llamada a acción, pregunta retórica, urgencia/exclusividad
- Sin hashtags ni emojis
- Solo el texto del copy, sin explicaciones adicionales

Responde ÚNICAMENTE con un JSON array de 5 strings, sin markdown:
["copy 1", "copy 2", "copy 3", "copy 4", "copy 5"]`,
          },
        ],
      }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    // Extract JSON array (handles cases where Claude wraps with markdown)
    const match = raw.match(/\[[\s\S]*?\]/)
    if (!match) throw new Error('La respuesta no contiene un array JSON válido')

    const copies: string[] = JSON.parse(match[0])
    if (!Array.isArray(copies) || copies.length === 0) {
      throw new Error('Array de copys vacío o inválido')
    }

    return NextResponse.json({ copies })
  } catch (e: any) {
    console.error('[api/stories] Error:', e)
    return NextResponse.json({ error: e.message || 'Error generando copys' }, { status: 500 })
  }
}
