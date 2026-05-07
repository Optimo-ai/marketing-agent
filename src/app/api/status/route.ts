import { NextResponse } from 'next/server'
import { getLocationInfo } from '@/lib/ghl'
import { getMarketingBoards } from '@/lib/monday'

export async function GET() {
  const status = {
    anthropic: false,
    monday: false,
    ghl: false,
    errors: {} as Record<string, string>,
  }

  // Check Anthropic
  if (!process.env.ANTHROPIC_API_KEY) {
    status.errors.anthropic = 'ANTHROPIC_API_KEY not set in environment variables'
  } else {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      })
      status.anthropic = true
    } catch (e: unknown) {
      const msg = String(e)
      if (msg.includes('401') || msg.includes('authentication')) {
        status.errors.anthropic = '401 — API key invalid or revoked. Generate a new one at console.anthropic.com'
      } else {
        status.errors.anthropic = msg.slice(0, 120)
      }
    }
  }

  // Check Monday.com
  if (!process.env.MONDAY_API_KEY) {
    status.errors.monday = 'MONDAY_API_KEY not set in environment variables'
  } else {
    try {
      await getMarketingBoards()
      status.monday = true
    } catch (e: unknown) {
      const msg = String(e)
      if (msg.includes('unauthorized') || msg.includes('not authenticated') || msg.includes('Unauthorized')) {
        status.errors.monday = 'Token revoked or invalid. Regenerate at Monday → Profile → Administration → API'
      } else {
        status.errors.monday = msg.slice(0, 120)
      }
    }
  }

  // Check GHL
  try {
    await getLocationInfo()
    status.ghl = true
  } catch (e: unknown) {
    status.errors.ghl = String(e)
  }

  return NextResponse.json(status)
}
