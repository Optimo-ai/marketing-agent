// src/app/api/update-copy/route.ts
// Actualiza el copy aprobado en Monday.com cuando se aprueba el copy

import { NextRequest, NextResponse } from 'next/server'
import { updateItemCopy } from '@/lib/monday'
import type { BoardColumns } from '@/lib/monday'

export async function POST(req: NextRequest) {
  try {
    const {
      boardId,
      itemId,
      columns,
      copyData,
    } = await req.json()

    if (!boardId || !itemId || !columns || !copyData) {
      return NextResponse.json(
        { error: 'Faltan boardId, itemId, columns o copyData' },
        { status: 400 }
      )
    }

    const result = await updateItemCopy(
      boardId,
      itemId,
      columns as BoardColumns,
      copyData
    )

    return NextResponse.json({
      success: !!result,
      itemId,
      copyUpdated: {
        ig: copyData.ig ? 'sí' : 'no',
        fb: copyData.fb ? 'sí' : 'no',
        li: copyData.li ? 'sí' : 'no',
        gmb: copyData.gmb ? 'sí' : 'no',
      },
    })
  } catch (err: unknown) {
    console.error('[update-copy] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
