import { NextRequest, NextResponse } from 'next/server'
import { runSkill, parseJSON } from '@/lib/claude'
import { findBoard, getBoardItems, updateCalendarItem } from '@/lib/monday'
import type { BoardColumns } from '@/lib/monday'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { month, year, action, boardId, boardColumns, mondayIdMap, copyItems } = body

    // ── GENERATE ─────────────────────────────────────────────────────────────
    if (action === 'generate') {
      const calendarFromBody = body.calendar as any[] | undefined
      let postsToCopy: any[]
      let boardIdToReturn = ''

      if (calendarFromBody?.length) {
        postsToCopy = calendarFromBody.map((p: any) => ({
          id: p.id,
          name: p.name,
          format: p.format,
          project: p.project,
          platforms: p.platforms,
          contentDirection: p.contentDirection,
          week: p.week,
          suggestedDay: p.suggestedDay,
        }))
      } else {
        try {
          const boardName = `Calendario de Contenido ${month} ${year}`
          const board = await findBoard(boardName)
          if (!board) {
            return NextResponse.json(
              { error: 'Aprueba el calendario primero (Fase 2) antes de generar el copy.' },
              { status: 400 }
            )
          }
          boardIdToReturn = board.id
          const items = await getBoardItems(board.id)
          postsToCopy = items.map((item: any) => ({ id: item.id, name: item.name }))
        } catch {
          return NextResponse.json(
            { error: 'No se pudo cargar el calendario. Verifica MONDAY_API_KEY en .env.local' },
            { status: 503 }
          )
        }
      }

      const prompt = `Genera el copy para estos posts de ${month} ${year}:\n${JSON.stringify(postsToCopy, null, 2)}`
      const raw  = await runSkill('copy', prompt, false)
      const copy = parseJSON(raw)
      return NextResponse.json({ copy, boardId: boardIdToReturn })
    }

    // ── SAVE → update Monday column values ───────────────────────────────────
    if (action === 'save') {
      if (!copyItems?.length) {
        return NextResponse.json({ error: 'Faltan datos para guardar' }, { status: 400 })
      }

      // Resolve boardId — use passed value or look it up
      let targetBoardId: string = boardId || ''
      let targetColumns: BoardColumns = boardColumns || {}

      if (!targetBoardId && month && year) {
        try {
          const boardName = `Calendario de Contenido ${month} ${year}`
          const board = await findBoard(boardName)
          targetBoardId  = board?.id ?? ''
          targetColumns  = board?.columns
            ? Object.fromEntries((board.columns as { id: string; title: string }[]).map(c => [c.title.toLowerCase(), c.id]))
            : {}
        } catch { /* fallback gracefully */ }
      }

      // ID map: claudePostId → Monday item ID (provided by calendar approval)
      const idMap: Record<string, string> = mondayIdMap || {}

      let savedCount = 0
      const errors: string[] = []

      for (const item of copyItems) {
        if (!item.postId) continue

        // Resolve the real Monday item ID
        const mondayItemId = idMap[String(item.postId)] ?? String(item.postId)

        try {
          if (targetBoardId && targetColumns && Object.keys(targetColumns).length > 0) {
            // Structured column update
            await updateCalendarItem(
              targetBoardId,
              mondayItemId,
              targetColumns,
              {
                ig:  item.copyIG  || undefined,
                fb:  item.copyFB  || undefined,
                li:  item.copyLI  || undefined,
                gmb: item.copyGMB || undefined,
              },
            )
          }
          savedCount++
          await new Promise(r => setTimeout(r, 200))
        } catch (err) {
          errors.push(`Post ${item.postId}: ${String(err).slice(0, 80)}`)
        }
      }

      return NextResponse.json({
        success: true,
        savedCount,
        errors: errors.length ? errors : undefined,
        warning: errors.length
          ? `${errors.length} item(s) no pudieron guardarse en Monday.com`
          : undefined,
      })
    }

    // ── EDIT ─────────────────────────────────────────────────────────────────
    if (action === 'edit') {
      const { platform, currentCopy, instruction, postName, project } = body
      if (!currentCopy || !instruction) {
        return NextResponse.json({ error: 'Faltan currentCopy o instruction' }, { status: 400 })
      }
      const prompt = `Post: ${postName ?? ''}
Platform: ${platform}
Project: ${project ?? ''}

Current copy:
${currentCopy}

Instruction: ${instruction}`
      const edited = await runSkill('editCopy', prompt, false)
      return NextResponse.json({ editedCopy: edited.trim() })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (err: unknown) {
    console.error('[copy] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
