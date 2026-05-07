// src/app/api/compare/route.ts
// Reporte comparativo mes vs mes — extrae datos de Monday.com para dos meses
// y genera análisis de tendencias con Claude

import { NextRequest, NextResponse } from 'next/server'
import { runSkill, parseJSON } from '@/lib/claude'
import { findBoard, getBoardItems } from '@/lib/monday'

interface MonthStats {
  month: string
  year: number
  totalPosts: number
  scheduled: number
  byFormat: Record<string, number>
  byProject: Record<string, number>
  byPlatform: Record<string, number>
  boardFound: boolean
}

async function getStatsForMonth(month: string, year: number): Promise<MonthStats> {
  const board = await findBoard(`Calendario de Contenido ${month} ${year}`)

  if (!board) {
    return {
      month, year,
      totalPosts: 0, scheduled: 0,
      byFormat: {}, byProject: {}, byPlatform: {},
      boardFound: false,
    }
  }

  const items = await getBoardItems(board.id)

  const stats: MonthStats = {
    month, year,
    totalPosts: items.length,
    scheduled: 0,
    byFormat: {}, byProject: {}, byPlatform: {},
    boardFound: true,
  }

  for (const item of items as Record<string, unknown>[]) {
    const cols = item.column_values as Array<{ column: { title: string }; text: string }>
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

  return stats
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month1 = searchParams.get('month1')
    const year1  = Number(searchParams.get('year1'))
    const month2 = searchParams.get('month2')
    const year2  = Number(searchParams.get('year2'))

    if (!month1 || !year1 || !month2 || !year2) {
      return NextResponse.json(
        { error: 'Parámetros requeridos: month1, year1, month2, year2' },
        { status: 400 }
      )
    }

    // Obtener stats de ambos meses en paralelo
    const [statsA, statsB] = await Promise.all([
      getStatsForMonth(month1, year1),
      getStatsForMonth(month2, year2),
    ])

    // Si ningún board fue encontrado
    if (!statsA.boardFound && !statsB.boardFound) {
      return NextResponse.json({
        error: 'No se encontraron boards para ninguno de los meses en Monday.com',
        statsA, statsB,
      }, { status: 404 })
    }

    // Calcular deltas
    const delta = {
      totalPosts: statsB.totalPosts - statsA.totalPosts,
      scheduled:  statsB.scheduled  - statsA.scheduled,
    }

    // Claude genera el análisis comparativo
    const prompt = `Genera un análisis comparativo de rendimiento de social media para Noriega Group entre dos meses.

DATOS ${month1.toUpperCase()} ${year1}:
${JSON.stringify(statsA, null, 2)}

DATOS ${month2.toUpperCase()} ${year2}:
${JSON.stringify(statsB, null, 2)}

VARIACIONES:
- Posts totales: ${delta.totalPosts > 0 ? '+' : ''}${delta.totalPosts} (${statsA.totalPosts} → ${statsB.totalPosts})
- Programados: ${delta.scheduled > 0 ? '+' : ''}${delta.scheduled} (${statsA.scheduled} → ${statsB.scheduled})

Genera un JSON con este formato exacto:
{
  "headline": "Frase ejecutiva de 1 oración sobre la tendencia general",
  "trend": "up" | "down" | "stable",
  "highlights": [
    "3-4 observaciones clave — qué creció, qué bajó, qué marca tuvo mejor rendimiento"
  ],
  "byFormat": {
    "top": "Formato con más posts en ${month2}",
    "growth": "Formato con mayor crecimiento entre meses"
  },
  "byProject": {
    "leader": "Proyecto con más contenido en ${month2}",
    "note": "Observación sobre distribución entre proyectos"
  },
  "recommendations": [
    "3 recomendaciones concretas para el próximo mes basadas en estas tendencias"
  ]
}

Responde SOLO con el JSON. Sin markdown.`

    const raw = await runSkill('briefing', prompt)
    const analysis = parseJSON(raw)

    return NextResponse.json({
      statsA,
      statsB,
      delta,
      analysis,
    })

  } catch (err: unknown) {
    console.error('[compare] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
