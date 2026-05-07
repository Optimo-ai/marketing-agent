// GoHighLevel API client

const GHL_BASE = 'https://services.leadconnectorhq.com'
const GHL_VERSION = '2021-07-28'

async function ghlRequest(method: string, path: string, body?: unknown) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
      'Content-Type': 'application/json',
      'Version': GHL_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GHL ${method} ${path} → ${res.status}: ${err}`)
  }
  return res.json()
}

const locationId = () => process.env.GHL_LOCATION_ID!

// ---- SOCIAL PLANNER ----

// Create a scheduled social post
export async function createSocialPost(post: {
  content: string
  platforms: string[]        // ['instagram', 'facebook', 'linkedin', 'gmb']
  scheduledAt: string        // ISO string
  mediaUrls?: string[]
  title?: string
}) {
  return ghlRequest('POST', `/locations/${locationId()}/posts`, {
    locationId: locationId(),
    title: post.title || post.content.slice(0, 60),
    body: post.content,
    status: 'scheduled',
    scheduledTime: post.scheduledAt,
    platforms: post.platforms,
    mediaUrls: post.mediaUrls || [],
  })
}

// Get all scheduled posts for a date range
export async function getScheduledPosts(startDate: string, endDate: string) {
  return ghlRequest('GET',
    `/locations/${locationId()}/posts?startDate=${startDate}&endDate=${endDate}`
  )
}

// Get all connected social media accounts for Social Planner
export async function getSocialAccounts(): Promise<Record<string, unknown>[]> {
  const data = await ghlRequest('GET', `/social-media-posting/${locationId()}/accounts`)
  // GHL returns: { results: { accounts: [...] } }
  const result = data?.results?.accounts ?? data?.accounts ?? data?.data ?? data
  return Array.isArray(result) ? result : []
}

// Get location users (needed for userId in Social Planner posts)
export async function getLocationUsers(): Promise<{ id: string; name: string }[]> {
  const data = await ghlRequest('GET', `/users/?locationId=${locationId()}`)
  return data.users || []
}

// Create a post in Social Planner (correct endpoint + body format)
export async function createScheduledPost(post: {
  summary: string
  accountIds: string[]
  scheduleDate: string          // ISO datetime string (AST/UTC-4)
  mediaUrls?: string[]
  postType?: 'post' | 'reel' | 'story'
  userId: string
}) {
  const mimeFromUrl = (url: string) => {
    const cleanUrl = url.split('?')[0]
    if (/\.jpe?g$/i.test(cleanUrl)) return 'image/jpeg'
    if (/\.png$/i.test(cleanUrl))   return 'image/png'
    if (/\.gif$/i.test(cleanUrl))   return 'image/gif'
    if (/\.webp$/i.test(cleanUrl))  return 'image/webp'
    if (/\.mp4$/i.test(cleanUrl))   return 'video/mp4'
    if (/\.(mov|qt)$/i.test(cleanUrl)) return 'video/mp4' // GHL y IG son más compatibles forzando video/mp4 para MOV
    if (/\.webm$/i.test(cleanUrl))  return 'video/webm'
    return post.postType === 'reel' ? 'video/mp4' : 'image/jpeg'
  }

  const media = (post.mediaUrls ?? [])
    .filter(Boolean)
    .map(url => ({ url, type: mimeFromUrl(url) }))

  return ghlRequest('POST', `/social-media-posting/${locationId()}/posts`, {
    type: post.postType || 'post',
    status: 'scheduled',
    scheduleDate: post.scheduleDate,
    accountIds: post.accountIds,
    summary: post.summary,
    media,
    userId: post.userId,
  })
}

// ---- WORKFLOWS / AUTOMATIONS ----

// Create a keyword automation for Lead Magnet DMs
export async function createKeywordAutomation(params: {
  keyword: string
  platform: 'instagram' | 'facebook'
  pdfUrl: string
  guideTitle: string
  month: string
}) {
  // GHL workflow via API - triggers on comment containing keyword
  return ghlRequest('POST', `/locations/${locationId()}/workflows`, {
    name: `Lead Magnet — ${params.keyword} — ${params.month}`,
    status: 'active',
    trigger: {
      type: 'social_comment',
      filters: {
        platform: params.platform,
        contains: params.keyword,
      }
    },
    actions: [
      { type: 'wait', delayMinutes: 1 },
      {
        type: 'send_dm',
        platform: params.platform,
        message: `¡Hola! 👋 Aquí tienes la guía que pediste:\n📄 ${params.guideTitle}\n🔗 ${params.pdfUrl}\n\nSi tienes preguntas, escríbenos. ¡Que te sea de mucha utilidad! 😊\n— Equipo Noriega Group`,
      },
      {
        type: 'add_tag',
        tag: `lead-magnet-${params.keyword.toLowerCase()}-${params.month}`,
      },
    ]
  })
}

// ---- CONTACTS ----

export async function getContacts(limit = 20) {
  return ghlRequest('GET', `/contacts/?locationId=${locationId()}&limit=${limit}`)
}

// ---- LOCATION INFO ----

export async function getLocationInfo() {
  return ghlRequest('GET', `/locations/${locationId()}`)
}

// Fetch new contacts created this month
export async function getNewContactsCount(startDate: string, endDate: string): Promise<number> {
  const locId  = process.env.GHL_LOCATION_ID!
  const apiKey = process.env.GHL_API_KEY!
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${locId}&startDate=${startDate}&endDate=${endDate}&limit=100`,
      { headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28' } }
    )
    if (!res.ok) return 0
    const data = await res.json()
    return data.meta?.total ?? (data.contacts?.length ?? 0)
  } catch { return 0 }
}

// Fetch active opportunities count
export async function getOpportunitiesCount(): Promise<number> {
  const locId  = process.env.GHL_LOCATION_ID!
  const apiKey = process.env.GHL_API_KEY!
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/opportunities/search?location_id=${locId}&status=open&limit=100`,
      { headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28' } }
    )
    if (!res.ok) return 0
    const data = await res.json()
    return data.meta?.total ?? (data.opportunities?.length ?? 0)
  } catch { return 0 }
}

// Fetch social posts published/scheduled via GHL this month
export async function getSocialPostsThisMonth(startDate: string, endDate: string): Promise<{ total: number; published: number; scheduled: number }> {
  const locId  = process.env.GHL_LOCATION_ID!
  const apiKey = process.env.GHL_API_KEY!
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/social-media-posting/${locId}/posts?startDate=${startDate}&endDate=${endDate}&limit=200`,
      { headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28' } }
    )
    if (!res.ok) return { total: 0, published: 0, scheduled: 0 }
    const data = await res.json()
    const posts: any[] = data.posts ?? data.data ?? []
    const published = posts.filter((p: any) => p.status === 'published' || p.status === 'PUBLISHED').length
    const scheduled = posts.filter((p: any) => p.status === 'scheduled' || p.status === 'SCHEDULED').length
    return { total: posts.length, published, scheduled }
  } catch { return { total: 0, published: 0, scheduled: 0 } }
}
