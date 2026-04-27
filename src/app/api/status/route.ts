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
    status.errors.anthropic = String(e)
  }

  // Check Monday.com
  try {
    await getMarketingBoards()
    status.monday = true
  } catch (e: unknown) {
    status.errors.monday = String(e)
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
