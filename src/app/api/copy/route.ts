import { NextRequest, NextResponse } from 'next/server'
import { runSkill, parseJSON } from '@/lib/claude'
import { findBoard, getBoardItems } from '@/lib/monday'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { month, year, action, boardId, copyItems } = body
    
    // ID de tu espacio de trabajo AI labs
    const workspaceId = "14748581"

    if (action === 'generate') {
      const boardName = `Calendario de Contenido ${month} ${year}`
      const board = await findBoard(boardName, workspaceId)
      
      if (!board) {
        return NextResponse.json({ error: 'No se encontró el tablero en Monday. Aprueba el calendario primero.' }, { status: 404 })
      }

      const items = await getBoardItems(board.id)
      const postsToCopy = items.map((item: any) => ({
        id: item.id,
        name: item.name
      }))

      const prompt = `Genera el copy para estos posts de ${month} ${year}:\n${JSON.stringify(postsToCopy, null, 2)}`
      
      const raw = await runSkill('copy', prompt, false)
      const copy = parseJSON(raw)

      return NextResponse.json({ copy, boardId: board.id })
    }

    if (action === 'save') {
      if (!boardId || !copyItems) {
        return NextResponse.json({ error: 'Faltan datos para guardar' }, { status: 400 })
      }
      
      // Simulamos el tiempo de guardado (más adelante se pueden crear las columnas en Monday)
      await new Promise(resolve => setTimeout(resolve, 1500))

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (err: unknown) {
    console.error('Copy error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}