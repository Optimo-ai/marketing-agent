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
    if (/\.jpe?g$/i.test(url)) return 'image/jpeg'
    if (/\.png$/i.test(url))   return 'image/png'
    if (/\.gif$/i.test(url))   return 'image/gif'
    if (/\.webp$/i.test(url))  return 'image/webp'
    if (/\.mp4$/i.test(url))   return 'video/mp4'
    if (/\.(mov|qt)$/i.test(url)) return 'video/quicktime'
    if (/\.webm$/i.test(url))  return 'video/webm'
    return 'image/jpeg'
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
