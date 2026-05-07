import { NextRequest, NextResponse } from 'next/server'
import { runSkill, parseJSON } from '@/lib/claude'
import { findBoard, createOrGetCalendarBoard, createCalendarItem, getBoardItems } from '@/lib/monday'
import type { BoardColumns } from '@/lib/monday'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { month, year, action, briefing, calendar } = body

    // ── GENERATE ─────────────────────────────────────────────────────────────
    if (action === 'generate') {
      if (!month || !year || !briefing) {
        return NextResponse.json({ error: 'Faltan datos (month, year, briefing)' }, { status: 400 })
      }
      const prompt = `Genera el calendario de contenido para ${month} ${year}.
Aquí tienes el Briefing Mensual aprobado como contexto:

${typeof briefing === 'string' ? briefing : JSON.stringify(briefing, null, 2)}`

      const raw = await runSkill('calendar', prompt, false)
      const generatedCalendar = parseJSON(raw)
      return NextResponse.json({ calendar: generatedCalendar })
    }

    // ── APPROVE → sync to Monday ──────────────────────────────────────────────
    if (action === 'approve') {
      if (!month || !year || !calendar) {
        return NextResponse.json({ error: 'Faltan datos (month, year, calendar)' }, { status: 400 })
      }

      const boardName = `Calendario de Contenido ${month} ${year}`
      let boardId = ''
      let columns: BoardColumns = {}
      let itemsCreated = 0
      let mondayError = ''
      // Maps Claude post ID (string|number) → Monday item ID (string)
      const mondayIdMap: Record<string, string> = {}

      try {
        const result = await createOrGetCalendarBoard(boardName)
        boardId  = result.id
        columns  = result.columns

        for (const post of calendar) {
          try {
            const item = await createCalendarItem(boardId, columns, {
              name:             post.name,
              format:           post.format,
              project:          post.project,
              platforms:        post.platforms,
              week:             post.week,
              suggestedDay:     post.suggestedDay,
              contentDirection: post.contentDirection,
            })
            if (item?.id) {
              mondayIdMap[String(post.id ?? itemsCreated)] = item.id
              itemsCreated++
            }
            await new Promise(r => setTimeout(r, 150))
          } catch (err) {
            console.error(`[calendar] Item "${post.name}" error:`, err)
          }
        }
      } catch (err) {
        mondayError = String(err).slice(0, 200)
        console.warn('[calendar] Monday sync error:', mondayError)
      }

      return NextResponse.json({
        success: true,
        boardId,
        boardColumns: columns,
        mondayIdMap,
        itemsCreated,
        mondayError:  mondayError || undefined,
        warning: mondayError
          ? 'Calendario aprobado en el agente pero no guardado en Monday.com — verifica tu MONDAY_API_KEY'
          : undefined,
      })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (err: unknown) {
    console.error('[calendar] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const year  = searchParams.get('year')
    if (!month || !year) return NextResponse.json({ error: 'month and year required' }, { status: 400 })

    try {
      const boardName = `Calendario de Contenido ${month} ${year}`
      const board = await findBoard(boardName)
      if (!board) return NextResponse.json({ calendar: null })

      const items = await getBoardItems(board.id)
      const cal   = items.map((item: any) => ({ id: item.id, name: item.name }))
      return NextResponse.json({ calendar: cal, boardId: board.id })
    } catch {
      return NextResponse.json({ calendar: null })
    }
  } catch (err: unknown) {
    console.error('[calendar GET] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
