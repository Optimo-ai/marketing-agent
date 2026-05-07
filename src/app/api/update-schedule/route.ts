// src/app/api/update-schedule/route.ts
// Actualiza el status de programación en Monday.com cuando se programa el contenido

import { NextRequest, NextResponse } from 'next/server'
import { updateItemScheduleStatus } from '@/lib/monday'
import type { BoardColumns } from '@/lib/monday'

export async function POST(req: NextRequest) {
  try {
    const {
      boardId,
      itemId,
      columns,
      status,
    } = await req.json()

    if (!boardId || !itemId || !columns) {
      return NextResponse.json(
        { error: 'Faltan boardId, itemId o columns' },
        { status: 400 }
      )
    }

    const result = await updateItemScheduleStatus(
      boardId,
      itemId,
      columns as BoardColumns,
      status || 'programado'
    )

    return NextResponse.json({
      success: !!result,
      itemId,
      scheduleStatus: status || 'programado',
    })
  } catch (err: unknown) {
    console.error('[update-schedule] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
