// src/app/api/stories/route.ts
// Analiza imagen con Claude Vision y genera 5 copys para Instagram Story

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const BRAND_VOICE: Record<string, string> = {
  'KASA':          'KASA Living — luxury investment apartments Downtown Punta Cana, short-term rental income, CONFOTUR tax benefits, smart home, Italian kitchen, rooftop jacuzzi & BBQ, walkable to Dolphin Discovery / Hard Rock / IKEA',
  'Arko':          'Arko Golf & Residences — golf, resort lifestyle, exclusivity, nature, premium second home',
  'Aria':          'Aria Suites — premium suite, hospitality, luxury services, unique experiences, investment',
  'Noriega Group': 'Noriega Group — visionary real estate development, legacy, quality of life, Dominican Republic',
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
            text: `You are the creative director of ${brandName}, a premium real estate company in the Dominican Republic.

Brand: ${brand}

Analyze this real estate image and create 5 distinct copy options for an Instagram Story (vertical 9:16 format).

Rules:
- Maximum 12 words per copy
- Aspirational, warm, premium tone — in English
- Each copy with a distinct angle: emotional, descriptive, call-to-action, rhetorical question, urgency/exclusivity
- No hashtags or emojis
- Only the copy text, no explanations

Respond ONLY with a JSON array of 5 strings, no markdown:
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
