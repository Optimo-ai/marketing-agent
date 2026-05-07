// src/app/api/reports/route.ts
// Reporte mensual completo:
//   - Monday.com: posts por formato, proyecto, plataforma, semana, status
//   - GHL: posts publicados/programados, contactos nuevos, oportunidades
//   - Meta Graph API: ads (spend, impressions, CTR, leads) + Instagram/Facebook real insights
//   - Claude Sonnet: análisis ejecutivo, insights, mejoras, próximos pasos

import { NextRequest, NextResponse } from 'next/server'
import { runSkill, parseJSON } from '@/lib/claude'
import { getNewContactsCount, getOpportunitiesCount, getSocialPostsThisMonth } from '@/lib/ghl'
import { getAdsData, getSocialData } from '@/lib/metaAds'

const MONDAY_API = 'https://api.monday.com/v2'

async function mondayQuery(query: string) {
  const res = await fetch(MONDAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MONDAY_API_KEY}`,
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`Monday API error: ${res.status}`)
  return res.json()
}

async function getBoardStats(month: string, year: string) {
  const boardRes = await mondayQuery(`{ boards(limit: 50) { id name items_count } }`)
  const boards: any[] = boardRes.data?.boards ?? []
  const board = boards.find((b: any) =>
    b.name.toLowerCase().includes(month.toLowerCase()) &&
    b.name.includes(year)
  )

  if (!board) return null

  const itemsRes = await mondayQuery(`{
    boards(ids: [${board.id}]) {
      items_page(limit: 200) {
        items {
          id
          name
          column_values {
            id
            column { title }
            text
          }
        }
      }
    }
  }`)

  const items: any[] = itemsRes.data?.boards?.[0]?.items_page?.items ?? []

  const byFormat:   Record<string, number> = {}
  const byProject:  Record<string, number> = {}
  const byPlatform: Record<string, number> = {}
  const byWeek:     Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0 }
  const byStatus:   Record<string, number> = {}

  for (const item of items) {
    for (const cv of (item.column_values ?? [])) {
      const title = (cv.column?.title ?? '').toLowerCase()
      const val   = (cv.text ?? '').trim()
      if (!val) continue

      if (title.includes('formato') || title.includes('format')) {
        byFormat[val] = (byFormat[val] ?? 0) + 1
      }
      if (title.includes('proyecto') || title.includes('project')) {
        byProject[val] = (byProject[val] ?? 0) + 1
      }
      if (title.includes('plataforma') || title.includes('platform')) {
        val.split(',').map((v: string) => v.trim()).filter(Boolean).forEach((p: string) => {
          byPlatform[p] = (byPlatform[p] ?? 0) + 1
        })
      }
      if (title.includes('semana') || title.includes('week')) {
        const w = val.replace(/\D/g, '')
        if (['1','2','3','4'].includes(w)) byWeek[w] = (byWeek[w] ?? 0) + 1
      }
      if (title.includes('estado') || title.includes('status')) {
        byStatus[val] = (byStatus[val] ?? 0) + 1
      }
    }
  }

  return {
    boardFound: true,
    totalPosts: items.length,
    byFormat, byProject, byPlatform, byWeek, byStatus,
    scheduled: Object.entries(byStatus)
      .filter(([k]) => k.toLowerCase().includes('program') || k.toLowerCase().includes('schedul'))
      .reduce((s, [, v]) => s + v, 0),
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') ?? ''
    const year  = searchParams.get('year')  ?? String(new Date().getFullYear())

    if (!month) return NextResponse.json({ error: 'Falta el mes' }, { status: 400 })

    const monthNames: Record<string, string> = {
      enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06',
      julio:'07', agosto:'08', septiembre:'09', octubre:'10', noviembre:'11', diciembre:'12',
    }
    const monthNum  = monthNames[month.toLowerCase()] ?? '01'
    const startDate = `${year}-${monthNum}-01`
    const lastDay   = new Date(Number(year), Number(monthNum), 0).getDate()
    const endDate   = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`

    // Fetch everything in parallel
    const [mondayStats, newContacts, opportunities, ghlPosts, adsData, socialData] = await Promise.all([
      getBoardStats(month, year).catch(() => null),
      getNewContactsCount(startDate, endDate).catch(() => 0),
      getOpportunitiesCount().catch(() => 0),
      getSocialPostsThisMonth(startDate, endDate).catch(() => ({ total: 0, published: 0, scheduled: 0 })),
      getAdsData(startDate, endDate).catch(() => ({ available: false, totalSpend: 0, totalImpressions: 0, totalReach: 0, totalClicks: 0, totalLeads: 0, ctr: 0, cpc: 0, roas: 0, accounts: [], campaigns: [] })),
      getSocialData(startDate, endDate).catch(() => ({
        instagram: { available: false, followers: 0, impressionsMonth: 0, reachMonth: 0, profileViews: 0, postsThisMonth: 0, avgLikes: 0, avgComments: 0, engagementRate: 0 },
        facebook:  { available: false, pageFans: 0, impressionsMonth: 0, reachMonth: 0, engagedUsers: 0, postsThisMonth: 0 },
      })),
    ])

    const totalPosts     = mondayStats?.totalPosts ?? 0
    const byFormat       = mondayStats?.byFormat   ?? {}
    const byProject      = mondayStats?.byProject  ?? {}
    const byPlatform     = mondayStats?.byPlatform ?? {}
    const byWeek         = mondayStats?.byWeek     ?? {}
    const byStatus       = mondayStats?.byStatus   ?? {}
    const scheduled      = mondayStats?.scheduled  ?? 0
    const schedulingRate = totalPosts > 0 ? Math.round((scheduled / totalPosts) * 100) : 0

    // Build Claude prompt with real numbers
    const adsSection = adsData.available
      ? `
META ADS (DATOS REALES):
- Gasto total: $${adsData.totalSpend} USD
- Impresiones: ${adsData.totalImpressions.toLocaleString()}
- Alcance: ${adsData.totalReach.toLocaleString()}
- Clics: ${adsData.totalClicks.toLocaleString()}
- CTR: ${adsData.ctr}%
- CPC: $${adsData.cpc} USD
- Leads generados: ${adsData.totalLeads}
- ROAS: ${adsData.roas}x
- Cuentas con gasto: ${adsData.accounts.map(a => `${a.name}: $${a.spend}`).join(', ')}
- Top campañas: ${adsData.campaigns.slice(0, 5).map(c => `"${c.name}" ($${c.spend}, ${c.impressions} impr.)`).join(' | ')}`
      : `META ADS: No se pudieron obtener datos — ${(adsData as any).error ?? 'token expirado o sin permisos'}. NO reportar $0 como inversión real — los datos no están disponibles.`

    const igSection = socialData.instagram.available
      ? `
INSTAGRAM (DATOS REALES — @noriegagroup):
- Seguidores: ${socialData.instagram.followers.toLocaleString()}
- Impresiones del mes: ${socialData.instagram.impressionsMonth.toLocaleString()}
- Alcance del mes: ${socialData.instagram.reachMonth.toLocaleString()}
- Visitas al perfil: ${socialData.instagram.profileViews.toLocaleString()}
- Posts publicados este mes: ${socialData.instagram.postsThisMonth}
- Promedio likes/post: ${socialData.instagram.avgLikes}
- Promedio comentarios/post: ${socialData.instagram.avgComments}
- Tasa de engagement: ${socialData.instagram.engagementRate}%`
      : 'INSTAGRAM: Sin datos disponibles este período.'

    const fbSection = socialData.facebook.available
      ? `
FACEBOOK PAGE (DATOS REALES):
- Fans totales: ${socialData.facebook.pageFans.toLocaleString()}
- Impresiones del mes: ${socialData.facebook.impressionsMonth.toLocaleString()}
- Alcance del mes: ${socialData.facebook.reachMonth.toLocaleString()}
- Usuarios comprometidos: ${socialData.facebook.engagedUsers.toLocaleString()}
- Posts publicados: ${socialData.facebook.postsThisMonth}`
      : 'FACEBOOK: Sin datos disponibles este período.'

    const statsPrompt = `
Month: ${month} ${year}

CONTENT CALENDAR (Monday.com):
- Total posts planned: ${totalPosts}
- Scheduled/programmed: ${scheduled} (${schedulingRate}%)
- By format: ${JSON.stringify(byFormat)}
- By project/brand: ${JSON.stringify(byProject)}
- By platform: ${JSON.stringify(byPlatform)}
- By week: ${JSON.stringify(byWeek)}
- By status: ${JSON.stringify(byStatus)}
- Board found: ${mondayStats?.boardFound ?? false}

GHL SOCIAL PUBLISHING:
- Total posts in GHL: ${ghlPosts.total}
- Published: ${ghlPosts.published}
- Scheduled: ${ghlPosts.scheduled}

CRM METRICS:
- New contacts this month: ${newContacts}
- Active opportunities: ${opportunities}

${adsSection}

${igSection}

${fbSection}

BRAND CONTEXT:
Projects: KASA (Downtown Punta Cana, investment/vacation rental), Arko (Vista Cana, golf/Mediterranean lifestyle), Aria (Downtown PC, mixed-use), Noriega Group (corporate 35yr brand).
Platforms: Instagram, Facebook, LinkedIn, Google My Business.
Typical monthly target: 20-28 posts, at least 4 per platform, balanced across projects.
`.trim()

    const rawReport = await runSkill('report', statsPrompt)
    const aiReport  = parseJSON<any>(rawReport)

    const report = {
      month,
      year: Number(year),
      ...aiReport,
      kpis: {
        totalPosts,
        scheduled,
        schedulingRate,
        ghlTotal:            ghlPosts.total,
        ghlPublished:        ghlPosts.published,
        ghlScheduled:        ghlPosts.scheduled,
        newContacts,
        activeOpportunities: opportunities,
        platformsActive:     Object.keys(byPlatform).length,
      },
      byFormat,
      byProject,
      byPlatform,
      byWeek,
      byStatus,
      adsData,
      socialData,
    }

    return NextResponse.json({ report, rawStats: { mondayStats, ghlPosts, newContacts, opportunities, adsData, socialData } })

  } catch (err: unknown) {
    console.error('[reports] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
