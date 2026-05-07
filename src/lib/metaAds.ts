// src/lib/metaAds.ts
// Meta Graph API — real ads data and social insights

const META_BASE = 'https://graph.facebook.com/v19.0'

// NoriegaGroup ad accounts (all active, USD)
const NORIEGA_AD_ACCOUNTS = [
  { id: 'act_549943855600621', name: 'NoriegaGroup' },
  { id: 'act_314800757995519', name: 'NoriegaGroup NEW' },
  { id: 'act_920140343925320', name: 'Kasa Living + Momnt' },
]

const FB_PAGE_ID = '1816103865295053'
const IG_USER_ID = '17841404374677680'

function tok() {
  const t = process.env.META_ACCESS_TOKEN
  if (!t) throw new Error('META_ACCESS_TOKEN no está configurado')
  return t
}

async function metaGet(path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${META_BASE}/${path}`)
  url.searchParams.set('access_token', tok())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Meta API ${res.status} [/${path}]: ${errText.slice(0, 300)}`)
  }
  return res.json()
}

// Sum daily-period values for a metric across the date range
function sumDailyValues(data: any[], metricName: string): number {
  const metric = data.find((m: any) => m.name === metricName)
  return (metric?.values ?? []).reduce((s: number, v: any) => s + (Number(v.value) || 0), 0)
}

// Latest snapshot value (for cumulative metrics like fan count)
function lastDailyValue(data: any[], metricName: string): number {
  const metric = data.find((m: any) => m.name === metricName)
  const vals = metric?.values ?? []
  return vals.length > 0 ? (Number(vals[vals.length - 1].value) || 0) : 0
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface AdsData {
  available: boolean
  totalSpend: number
  totalImpressions: number
  totalReach: number
  totalClicks: number
  totalLeads: number
  ctr: number
  cpc: number
  roas: number
  accounts: { name: string; spend: number; impressions: number; clicks: number }[]
  campaigns: { account: string; name: string; spend: number; impressions: number; clicks: number }[]
}

export interface SocialData {
  instagram: {
    available: boolean
    followers: number
    impressionsMonth: number
    reachMonth: number
    profileViews: number
    postsThisMonth: number
    avgLikes: number
    avgComments: number
    engagementRate: number
  }
  facebook: {
    available: boolean
    pageFans: number
    impressionsMonth: number
    reachMonth: number
    engagedUsers: number
    postsThisMonth: number
  }
}

// ─── ADS ─────────────────────────────────────────────────────────────────────

export async function getAdsData(startDate: string, endDate: string): Promise<AdsData> {
  const empty: AdsData = {
    available: false,
    totalSpend: 0, totalImpressions: 0, totalReach: 0, totalClicks: 0, totalLeads: 0,
    ctr: 0, cpc: 0, roas: 0, accounts: [], campaigns: [],
  }

  try {
    const timeRange = JSON.stringify({ since: startDate, until: endDate })
    let totalSpend = 0
    let totalImpressions = 0
    let totalReach = 0
    let totalClicks = 0
    let totalLeads = 0
    let totalPurchaseValue = 0
    const accounts: AdsData['accounts'] = []
    const campaigns: AdsData['campaigns'] = []

    const accountErrors: string[] = []
    let accountsSucceeded = 0

    await Promise.all(NORIEGA_AD_ACCOUNTS.map(async (account) => {
      try {
        // Account-level totals
        const acctRes = await metaGet(`${account.id}/insights`, {
          fields: 'spend,impressions,reach,clicks,actions',
          time_range: timeRange,
          level: 'account',
        })
        const d = acctRes.data?.[0]
        if (d) {
          const spend       = parseFloat(d.spend ?? '0')
          const impressions = parseInt(d.impressions ?? '0')
          const reach       = parseInt(d.reach ?? '0')
          const clicks      = parseInt(d.clicks ?? '0')
          const actions: { action_type: string; value: string }[] = d.actions ?? []

          const leadAction = actions.find(a =>
            a.action_type === 'lead' ||
            a.action_type === 'offsite_conversion.fb_pixel_lead' ||
            a.action_type === 'onsite_conversion.lead_grouped'
          )
          const purchaseAction = actions.find(a => a.action_type === 'purchase')

          totalSpend            += spend
          totalImpressions      += impressions
          totalReach            += reach
          totalClicks           += clicks
          totalLeads            += leadAction ? parseInt(leadAction.value ?? '0') : 0
          totalPurchaseValue    += purchaseAction ? parseFloat(purchaseAction.value ?? '0') : 0

          accounts.push({ name: account.name, spend: Math.round(spend * 100) / 100, impressions, clicks })
          accountsSucceeded++
        }

        // Campaign-level breakdown
        const campRes = await metaGet(`${account.id}/insights`, {
          fields: 'campaign_name,spend,impressions,clicks',
          time_range: timeRange,
          level: 'campaign',
          limit: '10',
        })
        for (const c of (campRes.data ?? [])) {
          campaigns.push({
            account: account.name,
            name: c.campaign_name ?? 'Sin nombre',
            spend: Math.round(parseFloat(c.spend ?? '0') * 100) / 100,
            impressions: parseInt(c.impressions ?? '0'),
            clicks: parseInt(c.clicks ?? '0'),
          })
        }
      } catch (acctErr) {
        const msg = String(acctErr).slice(0, 200)
        console.warn(`[metaAds] Ad account ${account.name} error:`, msg)
        accountErrors.push(`${account.name}: ${msg}`)
      }
    }))

    // If no account returned data, return unavailable with error details
    if (accountsSucceeded === 0) {
      console.error('[metaAds] All ad accounts failed:', accountErrors)
      return {
        ...empty,
        available: false,
        error: accountErrors[0] ?? 'All ad accounts unreachable',
      } as any
    }

    const ctr  = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0
    const cpc  = totalClicks > 0     ? Math.round((totalSpend / totalClicks) * 100) / 100 : 0
    const roas = totalSpend > 0      ? Math.round((totalPurchaseValue / totalSpend) * 100) / 100 : 0

    return {
      available: true,
      totalSpend:       Math.round(totalSpend * 100) / 100,
      totalImpressions,
      totalReach,
      totalClicks,
      totalLeads,
      ctr,
      cpc,
      roas,
      accounts,
      campaigns: campaigns.sort((a, b) => b.spend - a.spend).slice(0, 10),
    }
  } catch (err) {
    console.error('[metaAds] getAdsData failed:', err)
    return empty
  }
}

// ─── SOCIAL INSIGHTS ─────────────────────────────────────────────────────────

export async function getSocialData(startDate: string, endDate: string): Promise<SocialData> {
  const igEmpty = {
    available: false, followers: 0, impressionsMonth: 0, reachMonth: 0,
    profileViews: 0, postsThisMonth: 0, avgLikes: 0, avgComments: 0, engagementRate: 0,
  }
  const fbEmpty = {
    available: false, pageFans: 0, impressionsMonth: 0, reachMonth: 0,
    engagedUsers: 0, postsThisMonth: 0,
  }

  // ── Instagram ─────────────────────────────────────────────────────────────
  let ig = { ...igEmpty }
  try {
    const [profileRes, insightsRes, mediaRes] = await Promise.all([
      metaGet(IG_USER_ID, { fields: 'followers_count,media_count' }),
      metaGet(`${IG_USER_ID}/insights`, {
        metric: 'impressions,reach,profile_views',
        period: 'day',
        since: startDate,
        until: endDate,
      }),
      metaGet(`${IG_USER_ID}/media`, {
        fields: 'timestamp,like_count,comments_count',
        limit: '100',
      }),
    ])

    const igData = insightsRes.data ?? []
    let postsThisMonth = 0
    let totalLikes = 0
    let totalComments = 0

    for (const post of (mediaRes.data ?? [])) {
      const ts = (post.timestamp as string | undefined) ?? ''
      if (ts >= startDate && ts <= endDate + 'T23:59:59Z') {
        postsThisMonth++
        totalLikes    += post.like_count    ?? 0
        totalComments += post.comments_count ?? 0
      }
    }

    const followers      = profileRes.followers_count ?? 0
    const avgLikes       = postsThisMonth > 0 ? Math.round(totalLikes / postsThisMonth) : 0
    const avgComments    = postsThisMonth > 0 ? Math.round(totalComments / postsThisMonth) : 0
    const engagementRate = followers > 0 && postsThisMonth > 0
      ? Math.round(((totalLikes + totalComments) / postsThisMonth / followers) * 10000) / 100
      : 0

    ig = {
      available:        true,
      followers,
      impressionsMonth: sumDailyValues(igData, 'impressions'),
      reachMonth:       sumDailyValues(igData, 'reach'),
      profileViews:     sumDailyValues(igData, 'profile_views'),
      postsThisMonth,
      avgLikes,
      avgComments,
      engagementRate,
    }
  } catch (err) {
    console.warn('[metaAds] Instagram error:', err)
  }

  // ── Facebook Page ─────────────────────────────────────────────────────────
  let fb = { ...fbEmpty }
  try {
    const [fbInsightsRes, fbPostsRes, fbPageRes] = await Promise.all([
      metaGet(`${FB_PAGE_ID}/insights`, {
        metric: 'page_impressions,page_reach,page_engaged_users',
        period: 'day',
        since: startDate,
        until: endDate,
      }),
      metaGet(`${FB_PAGE_ID}/posts`, {
        fields: 'created_time',
        since: startDate,
        until: endDate,
        limit: '100',
      }),
      metaGet(FB_PAGE_ID, { fields: 'fan_count' }),
    ])

    const fbData = fbInsightsRes.data ?? []
    fb = {
      available:        true,
      pageFans:         fbPageRes.fan_count ?? lastDailyValue(fbData, 'page_fans'),
      impressionsMonth: sumDailyValues(fbData, 'page_impressions'),
      reachMonth:       sumDailyValues(fbData, 'page_reach'),
      engagedUsers:     sumDailyValues(fbData, 'page_engaged_users'),
      postsThisMonth:   (fbPostsRes.data ?? []).length,
    }
  } catch (err) {
    console.warn('[metaAds] Facebook Page error:', err)
  }

  return { instagram: ig, facebook: fb }
}
