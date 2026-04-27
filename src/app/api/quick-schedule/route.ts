import { NextResponse } from 'next/server'
import { getSocialAccounts, getLocationUsers, createScheduledPost } from '@/lib/ghl'

const PLATFORM_TYPE: Record<string, string> = {
  IG: 'instagram',
  FB: 'facebook',
  LI: 'linkedin',
  GMB: 'google',
}

const CAPTION_KEY: Record<string, string> = {
  IG: 'captionIG',
  FB: 'captionFB',
  LI: 'captionLI',
  GMB: 'captionGMB',
}

// Map our content types to GHL post types
const GHL_POST_TYPE: Record<string, 'post' | 'reel' | 'story'> = {
  post: 'post',
  carrusel: 'post',
  reel: 'reel',
  story: 'story',
}

interface CaptionsMap { captionIG: string; captionFB: string; captionLI: string; captionGMB: string }

interface QueueItem {
  id: string
  title: string
  contentType: string
  platforms: string[]
  scheduledDate: string
  scheduledTime: string
  mediaUrls: string[]
  captions: CaptionsMap
}

export async function POST(req: Request) {
  try {
    const { items } = await req.json() as { items: QueueItem[] }
    if (!items?.length) return NextResponse.json({ error: 'No hay items' }, { status: 400 })

    // Fetch accounts and first admin user in parallel
    const [accounts, users] = await Promise.all([
      getSocialAccounts().catch(() => [] as Record<string, unknown>[]),
      getLocationUsers().catch(() => [] as { id: string; name: string }[]),
    ])

    // Build platform → accountId map
    const typeToId: Record<string, string> = {}
    for (const acc of accounts) {
      const t = (acc.platform as string)?.toLowerCase()
      const id = (acc.id ?? acc._id) as string
      if (t && id && !typeToId[t]) typeToId[t] = id
    }

    // Use first user with socialplanner write scope, fallback to any first user
    const userId = (users.find((u: any) =>
      Array.isArray(u.scopes) && u.scopes.includes('socialplanner/post.write')
    ) ?? users[0])?.id ?? ''

    const results: { id: string; platform: string; status: string; error?: string }[] = []

    for (const item of items) {
      const scheduleDate = `${item.scheduledDate}T${item.scheduledTime}:00-04:00`
      const ghlPostType = GHL_POST_TYPE[item.contentType] ?? 'post'

      for (const plat of item.platforms) {
        const accountId = typeToId[PLATFORM_TYPE[plat]]
        if (!accountId) {
          results.push({ id: item.id, platform: plat, status: 'error',
            error: `${plat} no conectado en GHL. Disponibles: ${Object.keys(typeToId).join(', ') || 'ninguno'}` })
          continue
        }

        const captionKey = CAPTION_KEY[plat] as keyof CaptionsMap
        const caption = (item.captions[captionKey] || item.captions.captionIG || item.title || ' ').trim()

        try {
          await createScheduledPost({
            summary: caption,
            accountIds: [accountId],
            scheduleDate,
            mediaUrls: item.mediaUrls,
            postType: ghlPostType,
            userId,
          })
          results.push({ id: item.id, platform: plat, status: 'ok' })
        } catch (e) {
          results.push({ id: item.id, platform: plat, status: 'error', error: String(e) })
        }
      }
    }

    const okCount = results.filter(r => r.status === 'ok').length
    const errCount = results.filter(r => r.status === 'error').length
    return NextResponse.json({ results, okCount, errCount })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
