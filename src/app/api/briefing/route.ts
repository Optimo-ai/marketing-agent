import { NextRequest, NextResponse } from 'next/server'
import { runSkill, parseJSON } from '@/lib/claude'
import { createDoc, findDoc, getDocContent } from '@/lib/monday'

export async function POST(req: NextRequest) {
  try {
    const { month, year, action, briefing } = await req.json()

    // action: 'generate' | 'approve' | 'load'
    if (action === 'load') {
      // Load existing approved briefing from Monday
      const doc = await findDoc(`Briefing Mensual — ${month} ${year}`)
      if (!doc) return NextResponse.json({ error: 'No briefing found' }, { status: 404 })
      const content = await getDocContent(doc.id)
      return NextResponse.json({ briefing: content, docUrl: doc.url })
    }

    if (action === 'approve') {
      // Save approved briefing to Monday.com as a Doc
      const title = `Briefing Mensual — ${month} ${year}`
      const content = `STATUS: APROBADO\nFECHA: ${new Date().toISOString().split('T')[0]}\n\n${JSON.stringify(briefing, null, 2)}`
      const doc = await createDoc(title, content)
      return NextResponse.json({ success: true, docUrl: doc.url, docId: doc.id })
    }

    // action === 'generate'
    const prompt = `Generate the Monthly Intelligence Brief for ${month} ${year} for Noriega Group.
Search for:
1. Current real estate market trends in Dominican Republic and Punta Cana area
2. Recent MITUR news and tourism/infrastructure developments
3. Competitor activity in Cap Cana, Bávaro, Vista Cana real estate
4. Viral social media content trends for Latin American real estate accounts
5. CONFOTUR and investment incentive news
6. Golf lifestyle and luxury Caribbean property trends for ${month} ${year}

Use web search to find real, current information.`

    const raw = await runSkill('briefing', prompt, true)
    const generatedBriefing = parseJSON(raw)

    return NextResponse.json({ briefing: generatedBriefing })
  } catch (err: unknown) {
    console.error('Briefing error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    if (!month || !year) return NextResponse.json({ error: 'month and year required' }, { status: 400 })
    const doc = await findDoc(`Briefing Mensual — ${month} ${year}`)
    if (!doc) return NextResponse.json({ briefing: null })
    const content = await getDocContent(doc.id)
    return NextResponse.json({ briefing: content, docUrl: doc.url })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
