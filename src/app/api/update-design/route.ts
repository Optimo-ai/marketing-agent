// src/app/api/update-design/route.ts
// Actualiza el URL de diseño y status en Monday.com cuando se aprueba/rechaza un diseño

import { NextRequest, NextResponse } from 'next/server'
import { updateItemDesign } from '@/lib/monday'
import type { BoardColumns } from '@/lib/monday'

export async function POST(req: NextRequest) {
  try {
    const {
      boardId,
      itemId,
      columns,
      designUrl,
      status,
    } = await req.json()

    if (!boardId || !itemId || !columns) {
      return NextResponse.json(
        { error: 'Faltan boardId, itemId o columns' },
        { status: 400 }
      )
    }

    const result = await updateItemDesign(
      boardId,
      itemId,
      columns as BoardColumns,
      designUrl || '',
      status || 'aprobado'
    )

    return NextResponse.json({
      success: !!result,
      itemId,
      status: status || 'aprobado',
      designUrl: designUrl || '',
    })
  } catch (err: unknown) {
    console.error('[update-design] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
