import { NextRequest, NextResponse } from 'next/server'
import { runSkill, parseJSON } from '@/lib/claude'
import { findBoard, getBoardItems } from '@/lib/monday'
import { getScheduledPosts } from '@/lib/ghl'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const type = searchParams.get('type') || 'monthly' // 'monthly' | 'comparative'

    if (!month || !year) return NextResponse.json({ error: 'month and year required' }, { status: 400 })

    // Get data from Monday and GHL
    const board = await findBoard(`Calendario de Contenido ${month} ${year}`)
    const items = board ? await getBoardItems(board.id) : []

    // Get scheduled posts from GHL for the month
    const monthNum = new Date(`${month} 1, ${year}`).getMonth() + 1
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
    const endDate = `${year}-${String(monthNum).padStart(2, '0')}-31`
    let ghlPosts = []
    try {
      const ghlData = await getScheduledPosts(startDate, endDate)
      ghlPosts = ghlData.posts || []
    } catch {
      // GHL might not have posts yet
    }

    // Count statuses from Monday
    const stats = {
      totalPosts: items.length,
      scheduled: 0,
      byFormat: {} as Record<string, number>,
      byProject: {} as Record<string, number>,
      byPlatform: {} as Record<string, number>,
    }

    for (const item of items as Record<string, unknown>[]) {
      const cols = item.column_values as Array<{ column: { title: string }, text: string }>
      const get = (title: string) => cols.find(c => c.column.title === title)?.text || ''

      const status = get('Estado programación')
      if (status === 'Programado') stats.scheduled++

      const format = get('Formato')
      if (format) stats.byFormat[format] = (stats.byFormat[format] || 0) + 1

      const project = get('Proyecto')
      if (project) stats.byProject[project] = (stats.byProject[project] || 0) + 1

      const platforms = get('Plataformas').split(', ').filter(Boolean)
      for (const p of platforms) {
        stats.byPlatform[p] = (stats.byPlatform[p] || 0) + 1
      }
    }

    // Use Claude to generate insights from the data
    const prompt = `Analyze this social media data for Noriega Group (${month} ${year}) and generate a performance report.

Monday.com board stats:
${JSON.stringify(stats, null, 2)}

GHL scheduled posts count: ${ghlPosts.length}

Generate a JSON report with:
{
  "month": "${month}",
  "year": ${year},
  "summary": "2-3 sentence executive summary",
  "totalPosts": number,
  "scheduled": number,
  "byFormat": { "Carousel": n, "Foto": n, "Story": n, "Lead Magnet": n },
  "byProject": { "KASA": n, "Arko": n, "General": n },
  "byPlatform": { "IG": n, "FB": n, "LI": n, "GMB": n },
  "insights": ["3-5 actionable insights for next month based on the data"],
  "recommendations": ["3 specific recommendations for improving performance"]
}

Respond ONLY with the JSON. No markdown.`

    const raw = await runSkill('briefing', prompt)
    const report = parseJSON(raw)

    return NextResponse.json({ report, rawStats: stats })
  } catch (err: unknown) {
    console.error('Reports error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
