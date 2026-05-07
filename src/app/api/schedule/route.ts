import { NextRequest, NextResponse } from 'next/server'
import { runSkill, parseJSON } from '@/lib/claude'
import { createScheduledPost, getSocialAccounts, getLocationUsers } from '@/lib/ghl'

// Platform name map — GHL account types vs our short codes
const PLATFORM_MAP: Record<string, string[]> = {
  IG:  ['instagram'],
  FB:  ['facebook'],
  LI:  ['linkedin'],
  GMB: ['google_my_business', 'gmb'],
}

function matchAccount(accounts: any[], platform: string): string | null {
  const targets = PLATFORM_MAP[platform] ?? [platform.toLowerCase()]
  const found = accounts.find((a: any) => {
    const t = (a.type ?? a.platform ?? a.name ?? '').toLowerCase()
    return targets.some(p => t.includes(p))
  })
  return found?.id ?? null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { month, year, action, copyData, schedule } = body

    // ── GENERATE SCHEDULE ─────────────────────────────────────────────────────
    if (action === 'generate') {
      if (!copyData || copyData.length === 0) {
        return NextResponse.json({ error: 'Faltan los datos del copy.' }, { status: 400 })
      }
      const today = new Date().toISOString().slice(0, 10)
      const prompt = `Today's date: ${today}. Month to schedule: ${month} ${year}.\nDo NOT assign any scheduledDate before ${today}. Posts for past dates must be scheduled starting from today onward.\n\n${JSON.stringify(copyData, null, 2)}`
      const raw = await runSkill('schedule', prompt, false)
      const generatedSchedule = parseJSON(raw)
      return NextResponse.json({ schedule: generatedSchedule })
    }

    // ── SEND TO GHL ───────────────────────────────────────────────────────────
    if (action === 'send_to_ghl') {
      if (!schedule || !schedule.length) {
        return NextResponse.json({ error: 'Falta el calendario para enviar a GHL.' }, { status: 400 })
      }

      // Obtener cuentas sociales y usuario conectado
      let accounts: any[] = []
      let userId = ''
      try {
        accounts = await getSocialAccounts()
        const users = await getLocationUsers()
        userId = users[0]?.id ?? ''
      } catch (e) {
        console.warn('[schedule] No se pudieron obtener cuentas GHL:', e)
      }

      const results: { postId: any; status: string; ghlId?: string; error?: string }[] = []
      let successCount = 0

      for (const item of schedule) {
        try {
          // Construir lista de accountIds según plataformas del post
          const accountIds: string[] = []
          for (const plat of (item.platforms ?? [])) {
            const id = matchAccount(accounts, plat)
            if (id) accountIds.push(id)
          }

          // Copy principal — usar IG como fallback
          const summary = item.copyIG ?? item.copyFB ?? item.copyLI ?? item.copyGMB ?? item.postName ?? ''

          // Media URLs — vienen del pipeline de imágenes (Fase 3)
          const mediaUrls: string[] = []
          if (item.imageUrl)   mediaUrls.push(item.imageUrl)
          if (item.slideUrls)  mediaUrls.push(...item.slideUrls)

          // Fecha programada en ISO con timezone AST (UTC-4)
          const scheduledAt = item.scheduledDate && item.scheduledTime
            ? `${item.scheduledDate}T${item.scheduledTime}:00-04:00`
            : new Date(Date.now() + 86400000).toISOString() // mañana si no hay fecha

          // Determinar tipo de post
          const postType = item.isCarousel || (item.slideUrls?.length > 1)
            ? 'post'   // GHL usa 'post' para carruseles también
            : (item.format?.toLowerCase().includes('story') ? 'story' : 'post')

          const ghlRes = await createScheduledPost({
            summary,
            accountIds: accountIds.length ? accountIds : [],
            scheduleDate: scheduledAt,
            mediaUrls,
            postType,
            userId,
          })

          results.push({ postId: item.postId, status: 'ok', ghlId: ghlRes?.id })
          successCount++

          // Pequeña pausa para no saturar GHL API
          await new Promise(r => setTimeout(r, 150))

        } catch (err: any) {
          console.error(`[schedule] GHL error para "${item.postName}":`, err)
          results.push({ postId: item.postId, status: 'error', error: String(err).slice(0, 120) })
        }
      }

      return NextResponse.json({
        success: successCount,
        total: schedule.length,
        errors: results.filter(r => r.status === 'error').length,
        results,
      })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (err: unknown) {
    console.error('[schedule] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
