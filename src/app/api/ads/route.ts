// src/app/api/ads/route.ts
// Generador de anuncios — Claude Vision analiza la imagen y genera
// 3 variaciones de copy para paid social. Opcionalmente sube a GHL.

import { NextRequest, NextResponse } from 'next/server'
import { runSkill, parseJSON } from '@/lib/claude'
import { createScheduledPost, getSocialAccounts, getLocationUsers } from '@/lib/ghl'

export interface AdVariation {
  id: number
  hook: string
  headline: string
  body: string
  cta: string
  overlay: 'bottom' | 'top' | 'center' | 'bottom-left' | 'bottom-right'
  rationale: string
}

// ── GENERATE ──────────────────────────────────────────────────────────────────

async function handleGenerate(req: NextRequest) {
  const { imageBase64, mimeType, idea, project } = await req.json() as {
    imageBase64: string
    mimeType: string
    idea: string
    project?: string
  }

  if (!imageBase64 || !idea) {
    return NextResponse.json({ error: 'Faltan imageBase64 e idea' }, { status: 400 })
  }

  const prompt = `Creative idea to transmit: "${idea}"
Project: ${project ?? 'Noriega Group'}

Analyze this image and generate 3 ad copy variations for this exact image and message.`

  const raw = await runSkill('ads', prompt, false, imageBase64, mimeType)
  const variations = parseJSON<AdVariation[]>(raw)

  return NextResponse.json({ variations })
}

// ── SEND TO GHL ───────────────────────────────────────────────────────────────

async function handleSendToGHL(req: NextRequest) {
  const {
    imageUrl,
    variation,
    platforms,
    scheduledDate,
    scheduledTime,
  } = await req.json() as {
    imageUrl: string
    variation: AdVariation
    platforms: string[]
    scheduledDate: string
    scheduledTime: string
  }

  if (!imageUrl || !variation) {
    return NextResponse.json({ error: 'Faltan imageUrl y variation' }, { status: 400 })
  }

  const PLATFORM_MAP: Record<string, string[]> = {
    IG:  ['instagram'],
    FB:  ['facebook'],
    LI:  ['linkedin'],
    GMB: ['google_my_business', 'gmb'],
  }

  let accounts: any[] = []
  let userId = ''
  try {
    accounts = await getSocialAccounts()
    const users = await getLocationUsers()
    userId = users[0]?.id ?? ''
  } catch (e) {
    console.warn('[ads] No se pudieron obtener cuentas GHL:', e)
  }

  const accountIds: string[] = []
  for (const plat of platforms) {
    const targets = PLATFORM_MAP[plat] ?? [plat.toLowerCase()]
    const found = accounts.find((a: any) => {
      const t = (a.type ?? a.platform ?? a.name ?? '').toLowerCase()
      return targets.some(p => t.includes(p))
    })
    if (found?.id) accountIds.push(found.id)
  }

  const summary = `${variation.hook}\n\n${variation.headline}\n\n${variation.body}\n\n${variation.cta}`
  const scheduledAt = `${scheduledDate}T${scheduledTime}:00-04:00`

  const ghlRes = await createScheduledPost({
    summary,
    accountIds,
    scheduleDate: scheduledAt,
    mediaUrls: [imageUrl],
    postType: 'post',
    userId,
  })

  return NextResponse.json({ success: true, ghlId: ghlRes?.id })
}

// ── ROUTER ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') ?? 'generate'

    if (action === 'send_to_ghl') return handleSendToGHL(req)
    return handleGenerate(req)
  } catch (err: unknown) {
    console.error('[ads] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
