'use client'
// src/components/ReportView.tsx
// Reporte mensual completo — gráficos SVG + análisis Claude Sonnet

import { useRef } from 'react'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface ReportKPIs {
  totalPosts: number
  scheduled: number
  schedulingRate: number
  ghlTotal: number
  ghlPublished: number
  ghlScheduled: number
  newContacts: number
  activeOpportunities: number
  platformsActive: number
}

interface Improvement {
  area: string
  issue: string
  action: string
  priority: 'alta' | 'media' | 'baja'
}

interface NextStep {
  step: number
  action: string
  owner: string
  timeline: string
  impact: string
}

interface AdsData {
  available: boolean
  totalSpend: number
  totalImpressions: number
  totalReach: number
  totalClicks: number
  totalLeads: number
  ctr: number
  cpc: number
  roas: number
  accounts: { name: string; spend: number; impressions: number; clicks: number }[]
  campaigns: { account: string; name: string; spend: number; impressions: number; clicks: number }[]
}

interface SocialData {
  instagram: {
    available: boolean
    followers: number
    impressionsMonth: number
    reachMonth: number
    profileViews: number
    postsThisMonth: number
    avgLikes: number
    avgComments: number
    engagementRate: number
  }
  facebook: {
    available: boolean
    pageFans: number
    impressionsMonth: number
    reachMonth: number
    engagedUsers: number
    postsThisMonth: number
  }
}

interface Report {
  month: string
  year: number
  score: number
  scoreRationale: string
  executiveSummary: string
  kpis: ReportKPIs
  byFormat:   Record<string, number>
  byProject:  Record<string, number>
  byPlatform: Record<string, number>
  byWeek:     Record<string, number>
  byStatus:   Record<string, number>
  feedPerformance: {
    topFormat: string
    topPlatform: string
    topProject: string
    weeklyConsistency: string
    contentMix: string
  }
  adsInsights: string
  socialInsights?: string
  adsData?: AdsData
  socialData?: SocialData
  insights: string[]
  wins: string[]
  improvements: Improvement[]
  nextSteps: NextStep[]
  platformStrategy: Record<string, string>
  formatRecommendation: string
}

interface Props {
  report: Report
}

// ─── PALETA ───────────────────────────────────────────────────────────────────

const TEAL    = '#64fbea'
const PURPLE  = '#441e44'
const ACCENT  = '#952a95'
const GOLD    = '#B8973A'
const NAVY    = '#1B2E3D'
const CORAL   = '#ff7f6b'

const CHART_COLORS = [TEAL, ACCENT, GOLD, CORAL, NAVY, '#4A8C6B', '#a34b75']

const PLATFORM_COLORS: Record<string, string> = {
  IG: ACCENT, FB: '#1877F2', LI: '#0A66C2', GMB: '#EA4335',
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function pct(v: number, total: number) {
  return total > 0 ? Math.round((v / total) * 100) : 0
}

function sortDesc(obj: Record<string, number>) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1])
}

// ─── SVG: DONUT CHART ────────────────────────────────────────────────────────

function DonutChart({ data, size = 160 }: { data: Record<string, number>; size?: number }) {
  const entries = sortDesc(data)
  const total   = entries.reduce((s, [, v]) => s + v, 0)
  if (total === 0) return <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>Sin datos</div>

  const r  = size / 2 - 16
  const cx = size / 2
  const cy = size / 2

  let angle = -Math.PI / 2
  const slices = entries.map(([label, value], i) => {
    const sweep   = (value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    angle += sweep
    const x2 = cx + r * Math.cos(angle)
    const y2 = cy + r * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    return { label, value, x1, y1, x2, y2, large, color: CHART_COLORS[i % CHART_COLORS.length], sweep }
  })

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' as const }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path
            key={i}
            d={`M ${cx} ${cy} L ${s.x1} ${s.y1} A ${r} ${r} 0 ${s.large} 1 ${s.x2} ${s.y2} Z`}
            fill={s.color}
            opacity={0.9}
          />
        ))}
        <circle cx={cx} cy={cy} r={r * 0.55} fill="var(--surface)" />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text)" fontSize={20} fontWeight={700}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text3)" fontSize={10}>posts</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text3)' }}>{s.label}</span>
            <span style={{ color: 'var(--text)', fontWeight: 600, marginLeft: 'auto', paddingLeft: 8 }}>{s.value} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({pct(s.value, total)}%)</span></span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SVG: BAR CHART VERTICAL ─────────────────────────────────────────────────

function BarChart({
  data, colorMap, height = 140, label,
}: {
  data: Record<string, number>
  colorMap?: Record<string, string>
  height?: number
  label?: string
}) {
  const entries = sortDesc(data)
  const max = Math.max(...entries.map(([, v]) => v), 1)
  const barW = 36
  const gap  = 12
  const w    = entries.length * (barW + gap) + gap

  return (
    <div>
      {label && <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{label}</div>}
      <svg width={w} height={height + 30} viewBox={`0 0 ${w} ${height + 30}`} style={{ overflow: 'visible' }}>
        {entries.map(([key, val], i) => {
          const bh  = Math.round((val / max) * height)
          const x   = gap + i * (barW + gap)
          const y   = height - bh
          const col = colorMap?.[key] ?? CHART_COLORS[i % CHART_COLORS.length]
          return (
            <g key={key}>
              <rect x={x} y={y} width={barW} height={bh} fill={col} rx={3} opacity={0.9} />
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill="var(--text)" fontSize={11} fontWeight={600}>{val}</text>
              <text x={x + barW / 2} y={height + 16} textAnchor="middle" fill="var(--text3)" fontSize={10}>{key}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── SVG: HORIZONTAL BARS ────────────────────────────────────────────────────

function HBarChart({ data, color = TEAL }: { data: Record<string, number>; color?: string }) {
  const entries = sortDesc(data)
  const max = Math.max(...entries.map(([, v]) => v), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map(([key, val]) => (
        <div key={key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
            <span style={{ color: 'var(--text)' }}>{key}</span>
            <span style={{ color: 'var(--text3)', fontWeight: 600 }}>{val} posts</span>
          </div>
          <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct(val, max)}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── SCORE GAUGE ─────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const s     = Math.max(0, Math.min(100, score))
  const color = s >= 75 ? TEAL : s >= 50 ? GOLD : CORAL
  const r     = 54
  const circ  = 2 * Math.PI * r
  const arc   = circ * 0.75  // 270° gauge
  const fill  = arc * (s / 100)

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={140} height={100} viewBox="0 0 140 100">
        <path
          d={`M 18 90 A ${r} ${r} 0 1 1 122 90`}
          fill="none" stroke="var(--surface2)" strokeWidth={10} strokeLinecap="round"
        />
        <path
          d={`M 18 90 A ${r} ${r} 0 1 1 122 90`}
          fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${fill} ${arc}`}
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <text x={70} y={78} textAnchor="middle" fill={color} fontSize={30} fontWeight={800}>{s}</text>
        <text x={70} y={94} textAnchor="middle" fill="var(--text3)" fontSize={10}>/ 100</text>
      </svg>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: -8 }}>
        {s >= 75 ? '🟢 Excelente' : s >= 50 ? '🟡 En progreso' : '🔴 Requiere atención'}
      </div>
    </div>
  )
}

// ─── WEEK GRID ────────────────────────────────────────────────────────────────

function WeekGrid({ byWeek }: { byWeek: Record<string, number> }) {
  const weeks = ['1', '2', '3', '4']
  const max   = Math.max(...weeks.map(w => byWeek[w] ?? 0), 1)
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      {weeks.map(w => {
        const v   = byWeek[w] ?? 0
        const h   = Math.max(4, Math.round((v / max) * 60))
        const col = v === 0 ? 'var(--surface2)' : v >= max * 0.8 ? TEAL : v >= max * 0.5 ? GOLD : ACCENT
        return (
          <div key={w} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>{v}</span>
            <div style={{ width: '100%', height: h, background: col, borderRadius: 4 }} />
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>Sem {w}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── PRIORITY BADGE ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    alta:  { bg: '#ef444420', color: '#ef4444' },
    media: { bg: '#f59e0b20', color: '#f59e0b' },
    baja:  { bg: '#10b98120', color: '#10b981' },
  }
  const style = map[priority] ?? map.media
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: style.bg, color: style.color, textTransform: 'uppercase' as const }}>
      {priority}
    </span>
  )
}

// ─── SECCIÓN ─────────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 22px', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span> {title}
      </div>
      {children}
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export function ReportView({ report }: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  function exportPDF() {
    window.print()
  }

  const { kpis, byFormat, byProject, byPlatform, byWeek } = report

  return (
    <div ref={printRef} style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap' as const, gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', textTransform: 'capitalize' as const }}>
            Reporte de Desempeño — {report.month} {report.year}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Noriega Group · Generado con Claude Sonnet</div>
        </div>
        <button onClick={exportPDF} className="btn btn-sm" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          ⬇ Exportar PDF
        </button>
      </div>

      {/* ── KPI CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Posts planificados', value: kpis.totalPosts, icon: '📅', color: TEAL },
          { label: 'Tasa de programación', value: `${kpis.schedulingRate}%`, icon: '✅', color: kpis.schedulingRate >= 70 ? TEAL : GOLD },
          { label: 'Publicados en GHL', value: kpis.ghlPublished, icon: '📤', color: ACCENT },
          { label: 'Plataformas activas', value: kpis.platformsActive, icon: '📱', color: NAVY },
          { label: 'Nuevos contactos', value: kpis.newContacts, icon: '👥', color: GOLD },
          { label: 'Oportunidades activas', value: kpis.activeOpportunities, icon: '🎯', color: CORAL },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 20 }}>{k.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color, marginTop: 6 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, lineHeight: 1.3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── SCORE + RESUMEN EJECUTIVO ── */}
      <Section title="Resumen Ejecutivo" icon="📊">
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 24, alignItems: 'start' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>PERFORMANCE SCORE</div>
            <ScoreGauge score={report.score} />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, fontStyle: 'italic', lineHeight: 1.4 }}>{report.scoreRationale}</div>
          </div>
          <div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', margin: 0 }}>{report.executiveSummary}</p>
            {report.wins?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 1 }}>🏆 Victorias del mes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {report.wins.map((w, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                      <span style={{ color: TEAL, flexShrink: 0 }}>✓</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── GRÁFICOS DE CONTENIDO ── */}
      <Section title="Desempeño del Feed" icon="📈">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
          {/* Donut por formato */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Por Formato</div>
            <DonutChart data={byFormat} size={150} />
          </div>
          {/* Barras por plataforma */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Por Plataforma</div>
            <BarChart data={byPlatform} colorMap={PLATFORM_COLORS} height={120} />
          </div>
        </div>

        {/* Distribución por semana */}
        <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Distribución Semanal</div>
          <WeekGrid byWeek={byWeek} />
        </div>

        {/* Por proyecto/marca */}
        <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Por Proyecto / Marca</div>
          <HBarChart data={byProject} color={ACCENT} />
        </div>

        {/* Análisis Claude del feed */}
        {report.feedPerformance && (
          <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { label: 'Formato destacado', value: report.feedPerformance.topFormat },
              { label: 'Plataforma líder',  value: report.feedPerformance.topPlatform },
              { label: 'Proyecto estrella', value: report.feedPerformance.topProject },
              { label: 'Mix de contenido',  value: report.feedPerformance.contentMix },
            ].map(f => (
              <div key={f.label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 5 }}>{f.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{f.value}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── GHL PUBLISHING ── */}
      <Section title="Publicación en GoHighLevel" icon="🔗">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Total en GHL', value: kpis.ghlTotal, color: 'var(--text)' },
            { label: 'Publicados',   value: kpis.ghlPublished, color: TEAL },
            { label: 'Programados',  value: kpis.ghlScheduled, color: GOLD },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>
        {kpis.ghlTotal > 0 && (
          <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: TEAL, width: `${pct(kpis.ghlPublished, kpis.ghlTotal)}%` }} />
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
          {kpis.ghlTotal > 0 ? `${pct(kpis.ghlPublished, kpis.ghlTotal)}% publicado de los posts en GHL` : 'Sin datos de publicación en GHL este mes'}
        </div>
      </Section>

      {/* ── REDES SOCIALES — MÉTRICAS REALES ── */}
      {(report.socialData?.instagram?.available || report.socialData?.facebook?.available) && (
        <Section title="Métricas Reales de Redes Sociales" icon="📲">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* Instagram */}
            {report.socialData?.instagram?.available && (() => {
              const ig = report.socialData!.instagram
              return (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    📸 Instagram
                    <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text3)', textTransform: 'none' as const }}>@noriegagroup</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Seguidores',        value: ig.followers.toLocaleString(),        color: TEAL },
                      { label: 'Posts este mes',     value: ig.postsThisMonth,                    color: ACCENT },
                      { label: 'Impresiones',        value: ig.impressionsMonth.toLocaleString(), color: GOLD },
                      { label: 'Alcance',            value: ig.reachMonth.toLocaleString(),       color: NAVY },
                      { label: 'Visitas al perfil',  value: ig.profileViews.toLocaleString(),     color: CORAL },
                      { label: 'Engagement',         value: `${ig.engagementRate}%`,              color: ig.engagementRate >= 3 ? TEAL : ig.engagementRate >= 1 ? GOLD : CORAL },
                      { label: 'Avg Likes/post',     value: ig.avgLikes,                          color: 'var(--text)' },
                      { label: 'Avg Comentarios',    value: ig.avgComments,                       color: 'var(--text)' },
                    ].map(m => (
                      <div key={m.label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.value}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Facebook */}
            {report.socialData?.facebook?.available && (() => {
              const fb = report.socialData!.facebook
              return (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1877F2', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>
                    👥 Facebook Page
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Fans totales',       value: fb.pageFans.toLocaleString(),        color: '#1877F2' },
                      { label: 'Posts este mes',      value: fb.postsThisMonth,                   color: ACCENT },
                      { label: 'Impresiones',         value: fb.impressionsMonth.toLocaleString(), color: GOLD },
                      { label: 'Alcance',             value: fb.reachMonth.toLocaleString(),       color: NAVY },
                      { label: 'Usuarios activos',    value: fb.engagedUsers.toLocaleString(),     color: CORAL },
                    ].map(m => (
                      <div key={m.label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.value}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          {report.socialInsights && (
            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 8, borderLeft: `3px solid ${TEAL}`, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
              {report.socialInsights}
            </div>
          )}
        </Section>
      )}

      {/* ── ADS ── */}
      <Section title="Ads y Pauta Pagada — Meta" icon="💰">
        {report.adsData?.available ? (
          <>
            {/* KPI Cards de Ads */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Gasto total',   value: `$${report.adsData.totalSpend.toLocaleString()}`, unit: 'USD',  color: CORAL },
                { label: 'Impresiones',   value: report.adsData.totalImpressions.toLocaleString(), unit: '',     color: TEAL },
                { label: 'Alcance',       value: report.adsData.totalReach.toLocaleString(),       unit: '',     color: GOLD },
                { label: 'Clics',         value: report.adsData.totalClicks.toLocaleString(),      unit: '',     color: ACCENT },
                { label: 'CTR',           value: `${report.adsData.ctr}%`,                         unit: '',     color: report.adsData.ctr >= 1 ? TEAL : CORAL },
                { label: 'CPC',           value: `$${report.adsData.cpc}`,                         unit: 'USD',  color: 'var(--text)' },
                { label: 'Leads',         value: report.adsData.totalLeads,                        unit: '',     color: report.adsData.totalLeads > 0 ? TEAL : 'var(--text3)' },
                { label: 'ROAS',          value: `${report.adsData.roas}x`,                        unit: '',     color: report.adsData.roas >= 2 ? TEAL : report.adsData.roas >= 1 ? GOLD : CORAL },
              ].map(k => (
                <div key={k.label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
                  {k.unit && <div style={{ fontSize: 9, color: 'var(--text3)' }}>{k.unit}</div>}
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Por cuenta */}
            {report.adsData.accounts.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Gasto por Cuenta</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {report.adsData.accounts.filter(a => a.spend > 0).map(a => {
                    const maxSpend = Math.max(...report.adsData!.accounts.map(x => x.spend), 1)
                    return (
                      <div key={a.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                          <span style={{ color: 'var(--text)' }}>{a.name}</span>
                          <span style={{ color: CORAL, fontWeight: 600 }}>${a.spend.toLocaleString()} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {a.impressions.toLocaleString()} impr.</span></span>
                        </div>
                        <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct(a.spend, maxSpend)}%`, background: CORAL, borderRadius: 3 }} />
                        </div>
                      </div>
                    )
                  })}
                  {report.adsData.accounts.every(a => a.spend === 0) && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Sin gasto activo en las cuentas este período</div>
                  )}
                </div>
              </div>
            )}

            {/* Campañas */}
            {report.adsData.campaigns.filter(c => c.spend > 0).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Campañas Activas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {report.adsData.campaigns.filter(c => c.spend > 0).slice(0, 6).map((c, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'center', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12 }}>
                      <span style={{ color: 'var(--text)', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{c.name}</span>
                      <span style={{ color: 'var(--text3)', fontSize: 10 }}>{c.account}</span>
                      <span style={{ color: CORAL, fontWeight: 600, whiteSpace: 'nowrap' as const }}>${c.spend}</span>
                      <span style={{ color: 'var(--text3)', whiteSpace: 'nowrap' as const }}>{c.clicks} clics</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '14px 0', color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>
            Sin datos de gasto disponibles para este período. El token de Meta Ads está configurado — puede que las cuentas no tengan campañas activas en estas fechas.
          </div>
        )}

        {/* Análisis de Claude basado en datos reales */}
        {report.adsInsights && (
          <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 8, borderLeft: `3px solid ${CORAL}`, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
            <strong style={{ color: CORAL }}>Análisis: </strong>{report.adsInsights}
          </div>
        )}
      </Section>

      {/* ── INSIGHTS ── */}
      <Section title="Insights Clave" icon="💡">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(report.insights ?? []).map((ins, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, borderLeft: `3px solid ${CHART_COLORS[i % CHART_COLORS.length]}` }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>→</span>
              <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{ins}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── ESTRATEGIA POR PLATAFORMA ── */}
      {report.platformStrategy && (
        <Section title="Estrategia por Plataforma — Próximo Mes" icon="📱">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'instagram', label: 'Instagram', icon: '📸', color: ACCENT },
              { key: 'facebook',  label: 'Facebook',  icon: '👥', color: '#1877F2' },
              { key: 'linkedin',  label: 'LinkedIn',  icon: '💼', color: '#0A66C2' },
              { key: 'gmb',       label: 'Google My Business', icon: '📍', color: '#EA4335' },
            ].map(p => (
              <div key={p.key} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '14px 16px', borderTop: `3px solid ${p.color}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: p.color, marginBottom: 8 }}>{p.icon} {p.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{report.platformStrategy[p.key] ?? '—'}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── MEJORAS ── */}
      <Section title="Oportunidades de Mejora" icon="🔧">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(report.improvements ?? []).map((imp, i) => (
            <div key={i} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '14px 16px', borderLeft: `3px solid ${imp.priority === 'alta' ? '#ef4444' : imp.priority === 'media' ? GOLD : '#10b981'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <PriorityBadge priority={imp.priority} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{imp.area}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
                <strong>Problema:</strong> {imp.issue}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text)', background: 'var(--surface)', padding: '6px 10px', borderRadius: 6, marginTop: 6 }}>
                ✦ <strong>Acción:</strong> {imp.action}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── PRÓXIMOS PASOS ── */}
      <Section title="Próximos Pasos" icon="🚀">
        {report.formatRecommendation && (
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)', marginBottom: 16, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, borderLeft: `3px solid ${TEAL}` }}>
            <strong>Mix recomendado:</strong> {report.formatRecommendation}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(report.nextSteps ?? []).map((ns, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 12, alignItems: 'start', padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                {ns.step}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{ns.action}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  👤 {ns.owner} · ⏱ {ns.timeline}
                </div>
                <div style={{ fontSize: 11, color: TEAL, marginTop: 3 }}>Impacto: {ns.impact}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── FOOTER ── */}
      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)', marginTop: 8 }}>
        Reporte generado automáticamente · Noriega Group Marketing Agent · {report.month} {report.year}
      </div>

    </div>
  )
}
