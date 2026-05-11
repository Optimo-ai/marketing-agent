'use client'
import { useState } from 'react'

interface Post {
  id?: string | number
  name?: string
  format?: string
  project?: string
  platforms?: string[]
  week?: number
  suggestedDay?: string
  contentDirection?: string
  mediaNeeded?: string
  keyword?: string
  [key: string]: unknown
}

interface CalendarViewProps {
  posts: Post[]
  month: string
  year: number
  approvedIndices: Set<number>
  rejectedIndices: Set<number>
  onToggleApprove: (index: number) => void
  onToggleReject: (index: number) => void
}

const MONTH_NAMES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
}

const PLATFORM_COLORS: Record<string, string> = {
  IG: '#E4405F', FB: '#1877F2', LI: '#0A66C2', GMB: '#EA4335',
}

export function CalendarView({ posts, month, year, approvedIndices, rejectedIndices, onToggleApprove, onToggleReject }: CalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  
  // Obtener número de mes
  const monthNum = MONTH_NAMES[month.toLowerCase()] ?? 4
  const daysInMonth = new Date(year, monthNum + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, monthNum, 1).getDay()
  
  // Mapear posts por fecha (suggestedDay)
  const postsByDay: Record<number, (Post & { index: number })[]> = {}
  posts.forEach((post, idx) => {
    if (post.suggestedDay) {
      const dayStr = post.suggestedDay.toLowerCase()
      const dayMatch = dayStr.match(/(\d+)/)
      if (dayMatch) {
        const day = parseInt(dayMatch[1])
        if (!postsByDay[day]) postsByDay[day] = []
        postsByDay[day].push({ ...post, index: idx })
      }
    }
  })
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: firstDayOfWeek }, (_, i) => null)
  const calendarDays = [...emptyDays, ...days]
  
  const projectColor: Record<string, string> = {
    KASA: '#7e22ce', Arko: '#0d9488', Aria: '#ea4335', 'Noriega Group': '#06b6d4',
  }
  
  const dayPostsForSelectedDay = selectedDay ? (postsByDay[selectedDay] || []) : []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
      {/* Calendario */}
      <div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 12, textTransform: 'capitalize' }}>
            {month} {year}
          </div>
          
          {/* Días de semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sab'].map(day => (
              <div key={day} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text3)', paddingBottom: 8 }}>
                {day}
              </div>
            ))}
          </div>
          
          {/* Días */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {calendarDays.map((day, idx) => {
              const dayPosts = day ? (postsByDay[day] || []) : []
              const hasApproved = dayPosts.some(p => approvedIndices.has(p.index))
              const hasRejected = dayPosts.some(p => rejectedIndices.has(p.index))
              const isSelected = selectedDay === day
              
              return (
                <div
                  key={idx}
                  onClick={() => day && setSelectedDay(day)}
                  style={{
                    minHeight: 80,
                    padding: 8,
                    background: isSelected ? 'var(--purple-light)' : dayPosts.length > 0 ? 'var(--surface2)' : 'var(--surface)',
                    border: isSelected ? '2px solid var(--purple)' : dayPosts.length > 0 ? '1px solid var(--border2)' : '1px solid var(--border)',
                    borderRadius: 8,
                    cursor: day && dayPosts.length > 0 ? 'pointer' : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: day ? 'var(--text)' : 'var(--text3)', marginBottom: 6 }}>
                    {day}
                  </div>
                  
                  {dayPosts.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                      {dayPosts.slice(0, 2).map((p, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 9,
                            padding: '3px 5px',
                            borderRadius: 3,
                            background: projectColor[p.project as string] || '#64748b',
                            color: '#fff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            opacity: approvedIndices.has(p.index) ? 1 : rejectedIndices.has(p.index) ? 0.4 : 0.7,
                          }}
                        >
                          {p.name}
                        </div>
                      ))}
                      {dayPosts.length > 2 && (
                        <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600 }}>
                          +{dayPosts.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {dayPosts.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {hasApproved && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#64fbea' }} />}
                      {hasRejected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff7f6b' }} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      
      {/* Panel de detalles */}
      {selectedDay && dayPostsForSelectedDay.length > 0 && (
        <div style={{ 
          background: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: 10, 
          padding: 14,
          maxHeight: '600px',
          overflowY: 'auto'
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
            {dayPostsForSelectedDay.length} post{dayPostsForSelectedDay.length !== 1 ? 's' : ''} en {month} {selectedDay}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dayPostsForSelectedDay.map((post) => {
              const isApproved = approvedIndices.has(post.index)
              const isRejected = rejectedIndices.has(post.index)
              
              return (
                <div
                  key={post.index}
                  style={{
                    padding: 10,
                    background: 'var(--surface2)',
                    border: `2px solid ${isApproved ? '#64fbea' : isRejected ? '#ff7f6b' : 'var(--border)'}`,
                    borderRadius: 6,
                    opacity: isRejected ? 0.5 : 1,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                    {post.name}
                  </div>
                  
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {post.format && <span>{post.format}</span>}
                    {post.project && <span style={{ color: projectColor[post.project as string] }}>● {post.project}</span>}
                    {post.platforms && Array.isArray(post.platforms) && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {post.platforms.map((p: string) => (
                          <span key={p} style={{ color: PLATFORM_COLORS[p] || 'var(--text3)' }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {post.contentDirection && (
                    <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 8, lineHeight: 1.4 }}>
                      {post.contentDirection}
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => onToggleApprove(post.index)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        background: isApproved ? '#64fbea' : 'var(--surface)',
                        color: isApproved ? '#0f172a' : 'var(--text)',
                        border: `1px solid ${isApproved ? '#64fbea' : 'var(--border)'}`,
                        borderRadius: 4,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      ✓ Aprobar
                    </button>
                    <button
                      onClick={() => onToggleReject(post.index)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        background: isRejected ? '#ff7f6b' : 'var(--surface)',
                        color: isRejected ? '#fff' : 'var(--text)',
                        border: `1px solid ${isRejected ? '#ff7f6b' : 'var(--border)'}`,
                        borderRadius: 4,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      ✕ Rechazar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
