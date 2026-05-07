// src/app/api/higgsfield-cleanup/route.ts
// Borra de Higgsfield ÚNICAMENTE los jobs generados en la sesión actual de la API.
// NUNCA borra contenido preexistente — solo recibe la lista de jobIds del cliente.

import { NextRequest, NextResponse } from 'next/server'
import { deleteGenerations } from '@/lib/higgsfield'

export async function POST(req: NextRequest) {
  try {
    const { jobIds } = await req.json()

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json({ deleted: [], failed: [] })
    }

    // Validar que sean UUIDs — nunca aceptar strings arbitrarios
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const validIds = jobIds.filter((id: unknown) => typeof id === 'string' && UUID_RE.test(id))

    if (validIds.length === 0) {
      return NextResponse.json({ deleted: [], failed: [], skipped: jobIds.length })
    }

    console.log(`[higgsfield-cleanup] Borrando ${validIds.length} generaciones de esta sesión`)
    const result = await deleteGenerations(validIds)

    return NextResponse.json({
      ...result,
      skipped: jobIds.length - validIds.length,
    })
  } catch (err) {
    console.error('[higgsfield-cleanup] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
