import { NextRequest, NextResponse } from 'next/server'
import { runSkill, parseJSON } from '@/lib/claude'
import { findBoard, createItem, getBoardItems, createBoard } from '@/lib/monday'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { month, year, action, briefing, calendar } = body

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

    if (action === 'approve') {
      if (!month || !year || !calendar) {
        return NextResponse.json({ error: 'Faltan datos (month, year, calendar)' }, { status: 400 })
      }

      const boardName = `Calendario de Contenido ${month} ${year}`
      
      // Usamos el ID de IA labs si existe, si no, usamos el por defecto
      const workspaceId = "14748581";

      let board = await findBoard(boardName, workspaceId)
      
      if (!board) {
        // Si el tablero no existe, lo creamos automáticamente
        board = await createBoard(boardName, workspaceId)
      }

      // Guardar cada post en Monday.com
      for (const post of calendar) {
        await createItem(board.id, post.name, {}) // Pasamos un objeto vacío de columnas por ahora
      }

      return NextResponse.json({ success: true, boardId: board.id })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (err: unknown) {
    console.error('Calendar POST error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    
    if (!month || !year) return NextResponse.json({ error: 'month and year required' }, { status: 400 })

    const workspaceId = "14748581";

    const boardName = `Calendario de Contenido ${month} ${year}`
    const board = await findBoard(boardName, workspaceId)
    if (!board) return NextResponse.json({ calendar: null })

    const items = await getBoardItems(board.id)
    
    // Formatear los items de Monday a la estructura de la app
    const calendar = items.map((item: any) => ({
      id: item.id,
      name: item.name
    }))

    return NextResponse.json({ calendar, boardId: board.id })
  } catch (err: unknown) {
    console.error('Calendar GET error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}