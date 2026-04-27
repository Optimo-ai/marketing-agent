'use client'
import { useState, useEffect, useCallback } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

type Phase = 'dashboard' | 'fase1' | 'fase2' | 'fase3' | 'fase4' | 'fase5' | 'reportes' | 'comparativo' | 'integraciones' | 'carga' | 'ads'
type ContentType = 'carrusel' | 'post' | 'reel'
type ContentStatus = 'borrador' | 'revision' | 'aprobado' | 'programado' | 'publicado'

interface BriefingData {
  contextoReferencia?: string
  desempenoAnuncios?: string
  actividadCompetencia?: string
  tendenciasContenido?: string
  noticiasSector?: string
  insightsClave?: string[]
  [key: string]: unknown
}

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

interface CopyItem {
  postId?: string | number
  postName?: string
  copyIG?: string
  copyFB?: string
  copyLI?: string
  copyGMB?: string
}

interface ScheduleItem {
  postId?: string | number
  postName?: string
  scheduledDate?: string
  scheduledTime?: string
  platforms?: string[]
  copyIG?: string
  copyFB?: string
  copyLI?: string
  copyGMB?: string
  keyword?: string
}

interface IntegrationStatus {
  anthropic: boolean
  monday: boolean
  ghl: boolean
  errors: Record<string, string>
}

interface ReportData {
  month?: string
  year?: number
  totalPosts?: number
  scheduled?: number
  byFormat?: Record<string, number>
  summary?: string
  insights?: string[]
  recommendations?: string[]
}

interface UploadedMedia {
  id: string
  name: string
  mimeType: string
  base64: string
  preview: string
  ghlUrl?: string
}

interface ManualContent {
  id: string
  type: ContentType
  title: string
  description: string
  files: UploadedMedia[]
  platforms: string[]
  scheduledDate: string
  scheduledTime: string
  status: ContentStatus
  captions: { captionIG: string; captionFB: string; captionLI: string; captionGMB: string }
  captionsGenerated: boolean
  generatingCaptions: boolean
  rejectedCopies: Set<'captionIG' | 'captionFB' | 'captionLI' | 'captionGMB'>
  suggestedDates?: string[]
  wasAutoScheduled?: boolean
  folderName?: string
}

const MONTH = 'Mayo'
const YEAR = 2025

function Toast({ message }: { message: string }) {
  return <div className={`toast ${message ? 'show' : ''}`}>{message}</div>
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')

  // Data state
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [briefingApproved, setBriefingApproved] = useState(false)
  const [calendar, setCalendar] = useState<Post[]>([])
  const [calendarApproved, setCalendarApproved] = useState(false)
  const [approvedPosts, setApprovedPosts] = useState<Set<number>>(new Set())
  const [rejectedPosts, setRejectedPosts] = useState<Set<number>>(new Set())
  const [copyData, setCopyData] = useState<CopyItem[]>([])
  const [copyApproved, setCopyApproved] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [scheduleApproved, setScheduleApproved] = useState(false)
  const [ghlProgress, setGhlProgress] = useState(0)
  const [ghlDone, setGhlDone] = useState(false)
  // Generador de Ads
  const [adsImage, setAdsImage]             = useState<{base64:string;mime:string;preview:string}|null>(null)
  const [adsIdea, setAdsIdea]               = useState('')
  const [adsBrand, setAdsBrand]             = useState('Noriega Group')
  const [adsPlatforms, setAdsPlatforms]     = useState<string[]>(['IG','FB'])
  const [adsCopy, setAdsCopy]               = useState<any>(null)
  const [adsRendered, setAdsRendered]       = useState<string|null>(null)
  const [adsStep, setAdsStep]               = useState<'idle'|'analyzing'|'preview'|'rendering'|'done'>('idle')
  const [adsScheduleDate, setAdsScheduleDate] = useState('')
  const [adsScheduleTime, setAdsScheduleTime] = useState('12:00')
  const [adsSent, setAdsSent]               = useState(false)
  const [openPosts, setOpenPosts] = useState<Set<number>>(new Set())
  const [intStatus, setIntStatus] = useState<IntegrationStatus | null>(null)
  const [openCopies, setOpenCopies] = useState<Set<number>>(new Set())
  const [boardId, setBoardId] = useState<string>('')
  const [report, setReport] = useState<ReportData | null>(null)
  const [designs, setDesigns] = useState<any[]>([])
  // Fase 3 — pipeline de imágenes
  const [fase3Files, setFase3Files]         = useState<File[]>([])
  const [assignedPosts, setAssignedPosts]   = useState<any[]>([])
  const [renderedPosts, setRenderedPosts]   = useState<any[]>([])
  const [fase3Step, setFase3Step]           = useState<'idle'|'scanning'|'assigning'|'rendering'|'review'>('idle')
  const [fase3Stats, setFase3Stats]         = useState<{fromDrive:number,fromAI:number,carousels:number}|null>(null)
  const [editingCopy, setEditingCopy]       = useState<Record<string|number,any>>({})
  // Generador de Ads
  const [adImage, setAdImage]           = useState<{base64:string;mimeType:string;preview:string} | null>(null)
  const [adIdea, setAdIdea]             = useState('')
  const [adProject, setAdProject]       = useState('KASA')
  const [adVariations, setAdVariations] = useState<any[]>([])
  const [adSelected, setAdSelected]     = useState<number | null>(null)
  const [adLoading, setAdLoading]       = useState(false)
  const [adSending, setAdSending]       = useState(false)
  const [adPlatforms, setAdPlatforms]   = useState<string[]>(['IG','FB'])
  const [adDate, setAdDate]             = useState('')
  const [adTime, setAdTime]             = useState('19:00')
  const [adGhlUrl, setAdGhlUrl]         = useState('')
  const [manualItems, setManualItems] = useState<ManualContent[]>([])
  const [sendingQuick, setSendingQuick] = useState(false)
  const [quickProgress, setQuickProgress] = useState(0)
  const [expandedCaptions, setExpandedCaptions] = useState<Set<string>>(new Set())
  const [quickError, setQuickError] = useState<string>('')
  const [processingFolder, setProcessingFolder] = useState(false)
  const [showCalendarPreview, setShowCalendarPreview] = useState(false)
  const [generatingAllCaptions, setGeneratingAllCaptions] = useState(false)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const navTo = (p: Phase) => {
    setPhase(p)
    setSidebarOpen(false)
    window.scrollTo(0, 0)
  }

  // Check integration status on load
  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(setIntStatus)
      .catch(() => {})
  }, [])

  // ---- PHASE 1: BRIEFING ----
  async function generateBriefing() {
    setLoading(true)
    setLoadingText('Buscando tendencias y noticias del sector...')
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: MONTH, year: YEAR, action: 'generate' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBriefing(data.briefing)
      showToast('Briefing generado — revisa y aprueba')
    } catch (e: unknown) {
      showToast('Error: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  async function approveBriefing() {
    setLoading(true)
    setLoadingText('Guardando en Monday.com...')
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: MONTH, year: YEAR, action: 'approve', briefing }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBriefingApproved(true)
      showToast('✓ Briefing aprobado y guardado en Monday.com')
    } catch (e: unknown) {
      showToast('Error guardando: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  // ---- PHASE 2: CALENDAR ----
  async function generateCalendar() {
    setLoading(true)
    setLoadingText('Generando calendario de posts...')
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: MONTH, year: YEAR, action: 'generate', briefing }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCalendar(data.calendar)
      showToast(`${data.calendar.length} posts generados`)
    } catch (e: unknown) {
      showToast('Error: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  async function approveCalendar() {
    const approved = calendar.filter((_, i) => !rejectedPosts.has(i))
    setLoading(true)
    setLoadingText('Creando items en Monday.com...')
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: MONTH, year: YEAR, action: 'approve', calendar: approved }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBoardId(data.boardId || '')
      setCalendarApproved(true)
      showToast(`✓ ${data.itemsCreated} posts guardados en Monday.com`)
    } catch (e: unknown) {
      showToast('Error: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  // ---- PHASE 4: COPY ----
  async function generateCopy() {
    setLoading(true)
    setLoadingText('Redactando copy para todos los posts...')
    try {
      const res = await fetch('/api/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: MONTH, year: YEAR, action: 'generate' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCopyData(data.copy)
      if (data.boardId) setBoardId(data.boardId)
      showToast(`Copy generado para ${data.copy.length} posts`)
    } catch (e: unknown) {
      showToast('Error: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  async function approveCopy() {
    setLoading(true)
    setLoadingText('Guardando copy en Monday.com...')
    try {
      const res = await fetch('/api/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: MONTH, year: YEAR, action: 'save', boardId, copyItems: copyData }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCopyApproved(true)
      showToast('✓ Copy aprobado y guardado en Monday.com')
    } catch (e: unknown) {
      showToast('Error: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  // ---- PHASE 5: SCHEDULE ----
  async function generateSchedule() {
    setLoading(true)
    setLoadingText('Calculando horarios óptimos para DR/LATAM...')
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: MONTH, year: YEAR, action: 'generate', copyData }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSchedule(data.schedule)
      if (data.boardId) setBoardId(data.boardId)
      showToast(`${data.schedule.length} posts con horarios asignados`)
    } catch (e: unknown) {
      showToast('Error: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  async function sendToGHL() {
    setScheduleApproved(true)
    setLoading(true)
    setLoadingText('Enviando a GHL...')
    let progress = 0
    const interval = setInterval(() => {
      progress = Math.min(progress + 12, 90)
      setGhlProgress(progress)
    }, 500)
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: MONTH, year: YEAR, action: 'send_to_ghl', schedule, boardId }),
      })
      const data = await res.json()
      clearInterval(interval)
      setGhlProgress(100)
      if (data.error) throw new Error(data.error)
      setTimeout(() => setGhlDone(true), 500)
      showToast(`✓ ${data.success} posts programados en GHL`)
    } catch (e: unknown) {
      clearInterval(interval)
      showToast('Error: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  // ---- REPORTS ----
  async function loadReport() {
    setLoading(true)
    setLoadingText('Generando reporte...')
    try {
      const res = await fetch(`/api/reports?month=${MONTH}&year=${YEAR}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setReport(data.report)
    } catch (e: unknown) {
      showToast('Error: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  async function exportToPDF() {
    const el = document.getElementById('report-wrapper')
    if (!el) return
    setLoading(true)
    setLoadingText('Exportando a PDF...')
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const w = pdf.internal.pageSize.getWidth()
      const h = (canvas.height * w) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, w, h)
      pdf.save(`Noriega_Reporte_${MONTH}_${YEAR}.pdf`)
      showToast('✓ Reporte exportado a PDF')
    } catch (e) {
      showToast('Error exportando: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  async function runFase3() {
    if (fase3Files.length === 0) { showToast('Selecciona al menos una imagen'); return }

    // PASO A: Procesar imágenes locales
    setFase3Step('scanning')
    setLoading(true)
    setLoadingText('Procesando imágenes subidas...')
    try {
      // Client-side resize para optimizar el envío a Claude
      const resizeImage = (file: File, max = 1080): Promise<string> => new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let w = img.width, h = img.height
          if (w > max) { h = Math.round((h * max) / w); w = max }
          canvas.width = w; canvas.height = h
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', 0.7))
        }
        img.src = URL.createObjectURL(file)
      })

      const allImages = await Promise.all(fase3Files.map(async (f, i) => {
        const dataUrl = await resizeImage(f)
        const nameLow = f.name.toLowerCase()
        const brand = nameLow.includes('kasa') ? 'kasa' : nameLow.includes('arko') ? 'arko' : nameLow.includes('aria') ? 'aria' : 'Noriega Group'
        return {
          fileId: `local-${i}-${Date.now()}`,
          name: f.name,
          mimeType: 'image/jpeg',
          thumbnail: dataUrl,
          brand
        }
      }))

      showToast(`✓ ${allImages.length} imágenes procesadas`)

      // PASO B: Claude Vision asigna imágenes a posts
      setFase3Step('assigning')
      setLoadingText(`Claude analiza ${allImages.length} imágenes y las asigna al calendario...`)

      const postsToAssign = calendar.filter((_, i) => !rejectedPosts.has(i))
      const assignRes = await fetch('/api/vision-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: allImages, posts: postsToAssign }),
      })
      const assignData = await assignRes.json()
      if (!assignRes.ok) throw new Error(assignData.error ?? `Vision error ${assignRes.status}`)
      setAssignedPosts(assignData.assignments)

      // PASO C: Renderizar con marca
      setFase3Step('rendering')
      setLoadingText(`Renderizando ${assignData.assignments.length} posts (${assignData.needsAI} con IA generativa)...`)

      const renderRes = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: assignData.assignments }),
      })
      const renderData = await renderRes.json()
      if (!renderRes.ok) throw new Error(renderData.error ?? `Render error ${renderRes.status}`)

      setRenderedPosts(renderData.posts)
      setDesigns(renderData.posts) // compatibilidad con Fase 5
      setFase3Stats({ fromDrive: renderData.fromDrive, fromAI: renderData.fromAI, carousels: renderData.carousels })
      setFase3Step('review')
      showToast(`✓ ${renderData.rendered} posts listos para revisión`)

    } catch (e: unknown) {
      showToast('Error Fase 3: ' + String(e))
      setFase3Step('idle')
    } finally {
      setLoading(false)
    }
  }

  async function rejectAndRegenerate(post: any) {
    setLoading(true)
    setLoadingText(`Regenerando "${post.postName}"...`)
    try {
      const assignment = assignedPosts.find((p: any) => String(p.postId) === String(post.postId))
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: [{ ...assignment, needsAI: true }] }),
      })
      const data = await res.json()
      if (data.posts?.[0]) {
        setRenderedPosts((prev: any[]) =>
          prev.map((p: any) => String(p.postId) === String(post.postId) ? data.posts[0] : p)
        )
        showToast('✓ Imagen regenerada')
      }
    } catch (e) {
      showToast('Error: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  function updatePostCopy(postId: string|number, field: string, value: string) {
    setEditingCopy((prev: any) => ({ ...prev, [postId]: { ...(prev[postId] ?? {}), [field]: value } }))
  }

  // ---- GENERADOR DE ADS ----
  async function handleAdImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const [header, b64] = dataUrl.split(',')
      const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
      setAdImage({ base64: b64, mimeType, preview: dataUrl })
      setAdVariations([])
      setAdSelected(null)
      setAdGhlUrl('')
    }
    reader.readAsDataURL(file)
  }

  async function generateAdVariations() {
    if (!adImage || !adIdea.trim()) { showToast('Sube una imagen y describe la idea'); return }
    setAdLoading(true)
    setAdVariations([])
    setAdSelected(null)
    try {
      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: adImage.base64,
          mimeType: adImage.mimeType,
          idea: adIdea,
          project: adProject,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAdVariations(data.variations)
      showToast(`✓ ${data.variations.length} variaciones generadas`)
    } catch (e) {
      showToast('Error: ' + String(e))
    } finally {
      setAdLoading(false)
    }
  }

  async function sendAdToGHL() {
    if (adSelected === null) { showToast('Selecciona una variación primero'); return }
    if (!adDate) { showToast('Selecciona fecha de publicación'); return }
    setAdSending(true)
    try {
      // Primero subir imagen a GHL si no está subida
      let imageUrl = adGhlUrl
      if (!imageUrl) {
        const blob = await fetch(adImage!.preview).then(r => r.blob())
        const form = new FormData()
        form.append('file', blob, `ad_${Date.now()}.jpg`)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: form })
        const uploadData = await uploadRes.json()
        if (!uploadData.url) throw new Error('Upload falló')
        imageUrl = uploadData.url
        setAdGhlUrl(imageUrl)
      }

      const res = await fetch('/api/ads?action=send_to_ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          variation: adVariations[adSelected],
          platforms: adPlatforms,
          scheduledDate: adDate,
          scheduledTime: adTime,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast('✓ Ad programado en GHL correctamente')
    } catch (e) {
      showToast('Error GHL: ' + String(e))
    } finally {
      setAdSending(false)
    }
  }

  function approveAllAndContinue() {
    const merged = renderedPosts.map((p: any) => ({ ...p, ...(editingCopy[p.postId] ?? {}) }))
    setDesigns(merged)
    showToast(`✓ ${merged.length} posts aprobados — continúa a Fase 4`)
    navTo('fase4')
  }

  // ---- CARGA RÁPIDA ----

  function addManualItem() {
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]
    setManualItems(prev => [...prev, {
      id: `mc-${Date.now()}`,
      type: 'post',
      title: '',
      description: '',
      files: [],
      platforms: ['IG', 'FB'],
      scheduledDate: dateStr,
      scheduledTime: '12:00',
      status: 'borrador',
      captions: { captionIG: '', captionFB: '', captionLI: '', captionGMB: '' },
      captionsGenerated: false,
      generatingCaptions: false,
      rejectedCopies: new Set(),
      wasAutoScheduled: false,
    }])
  }

  function updateManualItem(id: string, updates: Partial<ManualContent>) {
    setManualItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item))
  }

  function deleteManualItem(id: string) {
    setManualItems(prev => {
      const item = prev.find(i => i.id === id)
      item?.files.forEach(f => URL.revokeObjectURL(f.preview))
      return prev.filter(i => i.id !== id)
    })
  }

  function togglePlatformManual(id: string, plat: string) {
    setManualItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const platforms = item.platforms.includes(plat)
        ? item.platforms.filter(p => p !== plat)
        : [...item.platforms, plat]
      return { ...item, platforms }
    }))
  }

  function removeMediaFile(itemId: string, fileId: string) {
    setManualItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      const f = item.files.find(f => f.id === fileId)
      if (f) URL.revokeObjectURL(f.preview)
      return { ...item, files: item.files.filter(f => f.id !== fileId) }
    }))
  }

  function toggleCaptionsExpand(id: string) {
    setExpandedCaptions(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function updateCaption(itemId: string, key: keyof ManualContent['captions'], value: string) {
    setManualItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, captions: { ...item.captions, [key]: value } } : item
    ))
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function base64ToBlob(b64: string, mimeType: string): Blob {
    const bytes = atob(b64)
    const ab = new ArrayBuffer(bytes.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < bytes.length; i++) ia[i] = bytes.charCodeAt(i)
    return new Blob([ab], { type: mimeType })
  }

  async function handleMediaSelect(itemId: string, files: FileList | null, append = false) {
    if (!files || files.length === 0) return
    const currentItem = manualItems.find(i => i.id === itemId)
    const isMulti = currentItem?.type === 'carrusel'
    const fileList = isMulti ? Array.from(files) : [files[0]]

    const newMedia: UploadedMedia[] = []
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const base64 = await fileToBase64(file)
      newMedia.push({
        id: `f-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        mimeType: file.type,
        base64,
        preview: URL.createObjectURL(file),
      })
    }

    setManualItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      const merged = append ? [...item.files, ...newMedia] : newMedia
      return { ...item, files: merged.slice(0, 10) }
    }))
  }

  async function generateCaptionsForItem(itemId: string) {
    const item = manualItems.find(i => i.id === itemId)
    if (!item) return
    updateManualItem(itemId, { generatingCaptions: true })
    try {
      const firstImg = item.files.find(f => f.mimeType.startsWith('image/'))
      const body: Record<string, string> = {
        contentType: item.type,
        title: item.title,
        description: item.description,
      }
      if (firstImg) {
        body.imageBase64 = firstImg.base64
        body.mimeType = firstImg.mimeType
      }
      const res = await fetch('/api/generate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      updateManualItem(itemId, {
        captions: data.captions,
        captionsGenerated: true,
        generatingCaptions: false,
        status: 'revision',
      })
      setExpandedCaptions(prev => new Set([...prev, itemId]))
      showToast('Descripciones generadas — revísalas y edítalas')
    } catch (e) {
      updateManualItem(itemId, { generatingCaptions: false })
      showToast('Error: ' + String(e))
    }
  }

  async function sendAllQuickToGHL() {
    const ready = manualItems.filter(i => i.platforms.length > 0 && i.scheduledDate && i.captionsGenerated)
    if (ready.length === 0) { showToast('No hay contenido listo para enviar (genera captions primero)'); return }
    setSendingQuick(true)
    setQuickProgress(0)
    setQuickError('')
    try {
      // Step 1: upload files to GHL and collect URLs
      const itemsWithUrls: (ManualContent & { resolvedUrls: string[] })[] = []
      for (let i = 0; i < ready.length; i++) {
        const item = ready[i]
        const resolvedUrls: string[] = []
        for (const file of item.files) {
          if (file.ghlUrl) { resolvedUrls.push(file.ghlUrl); continue }
          const blob = base64ToBlob(file.base64, file.mimeType)
            const form = new FormData()
            form.append('file', blob, file.name)
            const res = await fetch('/api/upload', { method: 'POST', body: form })
            const d = await res.json()
            if (d.url) {
              resolvedUrls.push(d.url)
              updateManualItem(item.id, {
                files: item.files.map(f => f.id === file.id ? { ...f, ghlUrl: d.url } : f)
              })
            } else if (d.error) {
              throw new Error(`Upload fallido: ${d.error}`)
            }
        }
        itemsWithUrls.push({ ...item, resolvedUrls })
        setQuickProgress(Math.round(((i + 1) / ready.length) * 50))
      }
      // Step 2: schedule in GHL (excluyendo copys rechazados)
      const res = await fetch('/api/quick-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsWithUrls.map(item => {
            // Filtrar captions rechazados
            const filteredCaptions = { ...item.captions }
            item.rejectedCopies.forEach(key => {
              filteredCaptions[key] = ''
            })
            return {
              id: item.id,
              title: item.title || `Post ${item.scheduledDate}`,
              contentType: item.type,
              platforms: item.platforms,
              scheduledDate: item.scheduledDate,
              scheduledTime: item.scheduledTime,
              mediaUrls: item.resolvedUrls,
              captions: filteredCaptions,
            }
          })
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setQuickProgress(100)
      const sentIds = new Set(
        (data.results as { id: string; status: string }[])
          .filter(r => r.status === 'ok').map(r => r.id)
      )
      setManualItems(prev => prev.map(item =>
        sentIds.has(item.id) ? { ...item, status: 'programado' } : item
      ))
      if (data.errCount > 0) {
        const errMsgs = (data.results as {id:string;platform:string;status:string;error?:string}[])
          .filter(r => r.status === 'error' && r.error)
          .map(r => `[${r.platform}] ${r.error}`)
          .join('\n')
        setQuickError(errMsgs)
        showToast(`⚠ ${data.okCount} enviadas, ${data.errCount} errores`)
      } else {
        setQuickError('')
        showToast(`✓ ${data.okCount} publicaciones enviadas al calendario de GHL`)
      }
    } catch (e) {
      setQuickError(String(e))
      showToast('Error enviando a GHL')
    } finally {
      setSendingQuick(false)
    }
  }

  // ---- NUEVAS FUNCIONES PARA CARPETAS ----

  function autoDetectContentType(folderName: string): ContentType {
    const lower = folderName.toLowerCase()
    if (lower.includes('carrusel') || lower.includes('carousel')) return 'carrusel'
    if (lower.includes('reel')) return 'reel'
    return 'post'
  }

  function suggestScheduleForItem(index: number): { date: string; time: string } {
    const today = new Date()
    // Sugerir fechas distribuidas (cada día diferente si es posible, de 10-14h o 18-22h)
    const daysOffset = Math.floor(index / 2)
    const schedDate = new Date(today)
    schedDate.setDate(schedDate.getDate() + daysOffset)
    const dateStr = schedDate.toISOString().split('T')[0]
    
    // Alternar entre mañana (10-14h) y tarde/noche (18-22h)
    const timeStr = index % 2 === 0 ? '12:00' : '19:00'
    return { date: dateStr, time: timeStr }
  }

  async function generateAllCaptions() {
    const itemsWithoutCaptions = manualItems.filter(i => !i.captionsGenerated && i.files.length > 0)
    if (itemsWithoutCaptions.length === 0) {
      showToast('Todos los items ya tienen captions generados')
      return
    }
    
    setGeneratingAllCaptions(true)
    let completed = 0
    try {
      for (const item of itemsWithoutCaptions) {
        await generateCaptionsForItem(item.id)
        completed++
        setLoadingText(`Generando captions... ${completed}/${itemsWithoutCaptions.length}`)
      }
      setLoadingText('')
      showToast(`✓ ${completed} captions generados`)
    } catch (e) {
      showToast('Error: ' + String(e))
    } finally {
      setGeneratingAllCaptions(false)
    }
  }

  function toggleCopyRejection(itemId: string, copyKey: 'captionIG' | 'captionFB' | 'captionLI' | 'captionGMB') {
    setManualItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      const rejected = new Set(item.rejectedCopies)
      if (rejected.has(copyKey)) {
        rejected.delete(copyKey)
      } else {
        rejected.add(copyKey)
      }
      return { ...item, rejectedCopies: rejected }
    }))
  }

  async function handleFolderUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    
    setProcessingFolder(true)
    setLoadingText('Procesando carpeta...')
    
    try {
      // Agrupar archivos por carpeta
      const folderMap: Record<string, File[]> = {}
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        // Extraer nombre de carpeta del path (webkitRelativePath o name)
        const path = (file as any).webkitRelativePath || file.name
        const parts = path.split('/')
        const folderName = parts.length > 1 ? parts[0] : 'contenido'
        
        if (!folderMap[folderName]) folderMap[folderName] = []
        folderMap[folderName].push(file)
      }
      
      // Crear item por carpeta
      let baseDate = new Date()
      let itemIndex = 0
      
      for (const [folderName, folderFiles] of Object.entries(folderMap)) {
        const contentType = autoDetectContentType(folderName)
        const imageFiles = Array.from(folderFiles).filter(f => f.type.startsWith('image/'))
        
        if (imageFiles.length === 0) continue
        
        const { date, time } = suggestScheduleForItem(itemIndex)
        
        const newMedia: UploadedMedia[] = []
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i]
          const base64 = await fileToBase64(file)
          newMedia.push({
            id: `f-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
            name: file.name,
            mimeType: file.type,
            base64,
            preview: URL.createObjectURL(file),
          })
        }
        
        const newItem: ManualContent = {
          id: `mc-${Date.now()}-${itemIndex}`,
          type: contentType,
          title: folderName.replace(/_/g, ' '),
          description: '',
          files: newMedia.slice(0, 10),
          platforms: ['IG', 'FB'],
          scheduledDate: date,
          scheduledTime: time,
          status: 'borrador',
          captions: { captionIG: '', captionFB: '', captionLI: '', captionGMB: '' },
          captionsGenerated: false,
          generatingCaptions: false,
          rejectedCopies: new Set(),
          wasAutoScheduled: true,
          folderName,
        }
        
        setManualItems(prev => [...prev, newItem])
        itemIndex++
      }
      
      setProcessingFolder(false)
      setLoadingText('')
      showToast(`✓ ${itemIndex} contenidos cargados de la carpeta`)
    } catch (e) {
      setProcessingFolder(false)
      setLoadingText('')
      showToast('Error: ' + String(e))
    }
  }

  const pipelineStatus = (p: number) => {
    if (p === 1) return briefingApproved ? 'done' : briefing ? 'active' : 'pending'
    if (p === 2) return calendarApproved ? 'done' : calendar.length > 0 ? 'active' : briefingApproved ? 'active' : 'pending'
    if (p === 3) return 'pending' // designs phase
    if (p === 4) return copyApproved ? 'done' : copyData.length > 0 ? 'active' : calendarApproved ? 'active' : 'pending'
    if (p === 5) return ghlDone ? 'done' : schedule.length > 0 ? 'active' : copyApproved ? 'active' : 'pending'
    return 'pending'
  }

  const badgeClass = (status: string) =>
    status === 'done' ? 'step-badge badge-done' :
    status === 'active' ? 'step-badge badge-active' :
    'step-badge badge-pending'

  const badgeText = (status: string) =>
    status === 'done' ? '✓ Listo' :
    status === 'active' ? 'En progreso' :
    'Pendiente'

  function formatChip(format: string = '') {
    const f = format.toLowerCase()
    if (f.includes('carousel') || f.includes('carrusel')) return 'chip chip-carousel'
    if (f.includes('foto') || f.includes('photo')) return 'chip chip-foto'
    if (f.includes('story') || f.includes('storie')) return 'chip chip-story'
    if (f.includes('lead')) return 'chip chip-lead'
    return 'chip chip-story'
  }

  function projectChip(project: string = '') {
    if (project.toUpperCase().includes('KASA')) return 'chip chip-kasa'
    if (project.toUpperCase().includes('ARKO')) return 'chip chip-arko'
    return 'chip chip-general'
  }

  function platClass(p: string) {
    if (p === 'IG') return 'plat plat-ig'
    if (p === 'FB') return 'plat plat-fb'
    if (p === 'LI') return 'plat plat-li'
    return 'plat plat-gm'
  }

  return (
    <>
      <Toast message={toast} />
      <div className="overlay" id="overlay" onClick={() => setSidebarOpen(false)} style={{ display: sidebarOpen ? 'block' : 'none' }} />

      <div className="layout">
        {/* SIDEBAR */}
        <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="sidebar-logo">
            <div className="logo-mark">
              <div className="logo-icon">NG</div>
              <div>
                <div className="logo-name">Noriega Group</div>
                <div className="logo-sub">agente · redes sociales</div>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-section">Pipeline</div>
            {([
              ['dashboard', 'Dashboard'],
              ['fase1', 'Fase 1 — Briefing'],
              ['fase2', 'Fase 2 — Calendario'],
              ['fase3', 'Fase 3 — Diseños'],
              ['fase4', 'Fase 4 — Copy'],
              ['fase5', 'Fase 5 — Programar'],
            ] as [Phase, string][]).map(([p, label]) => (
              <div key={p} className={`nav-item${phase === p ? ' active' : ''}`} onClick={() => navTo(p)}>
                {label}
                {p === 'fase2' && calendar.length > 0 && (
                  <span className="nav-badge">{calendar.length}</span>
                )}
              </div>
            ))}

            <div className={`nav-item${phase === 'carga' ? ' active' : ''}`} onClick={() => navTo('carga')}>
              Carga Rápida
              {manualItems.length > 0 && <span className="nav-badge">{manualItems.length}</span>}
            </div>
            <div className={`nav-item${phase === 'ads' ? ' active' : ''}`} onClick={() => navTo('ads')}>
              🎯 Generador de Ads
            </div>

            <div className="nav-section">Reportes</div>
            <div className={`nav-item${phase === 'reportes' ? ' active' : ''}`} onClick={() => navTo('reportes')}>Desempeño mensual</div>
            <div className={`nav-item${phase === 'comparativo' ? ' active' : ''}`} onClick={() => navTo('comparativo')}>Mes vs mes</div>

            <div className="nav-section">Sistema</div>
            <div className={`nav-item${phase === 'integraciones' ? ' active' : ''}`} onClick={() => navTo('integraciones')}>Integraciones</div>
          </nav>

          <div className="sidebar-footer">
            <div className="month-selector">
              <div>
                <div className="month-label">{MONTH} {YEAR}</div>
                <div className="month-sub">ciclo activo</div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">
          <div className="topbar">
            <div className="topbar-left">
              <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
                <span/><span/><span/>
              </button>
              <div>
                <div className="page-title">
                  {phase === 'dashboard' ? 'Dashboard' :
                   phase === 'fase1' ? 'Fase 1 — Briefing Mensual' :
                   phase === 'fase2' ? 'Fase 2 — Calendario' :
                   phase === 'fase3' ? 'Fase 3 — Diseños' :
                   phase === 'fase4' ? 'Fase 4 — Copy' :
                   phase === 'fase5' ? 'Fase 5 — Programar en GHL' :
                   phase === 'carga' ? 'Carga Rápida' :
                   phase === 'ads'   ? 'Generador de Ads' :
                   phase === 'reportes' ? 'Reporte Mensual' :
                   phase === 'comparativo' ? 'Mes vs Mes' :
                   'Integraciones'}
                </div>
                <div className="page-sub">{MONTH} {YEAR}</div>
              </div>
            </div>
            <div className="topbar-right">
              <button className="btn btn-primary btn-sm" onClick={() => showToast('Nuevo ciclo próximamente')}>+ Nuevo mes</button>
            </div>
          </div>

          <div className="content">

            {/* === DASHBOARD === */}
            {phase === 'dashboard' && (
              <div>
                <div className="pipeline-bar">
                  {[1,2,3,4,5].map(n => {
                    const s = pipelineStatus(n)
                    const names = ['','Briefing','Calendario','Diseños','Copy','Programar']
                    const pages: Phase[] = ['dashboard','fase1','fase2','fase3','fase4','fase5']
                    return (
                      <div key={n} className={`pipeline-step${s === 'active' ? ' ps-active' : ''}`} onClick={() => navTo(pages[n])}>
                        <div className="step-num">0{n}</div>
                        <div className="step-name">{names[n]}</div>
                        <span className={badgeClass(s)}>{badgeText(s)}</span>
                      </div>
                    )
                  })}
                </div>

                <div className="grid-2" style={{gap:16}}>
                  <div style={{display:'flex',flexDirection:'column',gap:16}}>
                    <div className="card">
                      <div className="card-header">
                        <div><div className="card-title">Estado del mes</div><div className="card-sub">{MONTH} {YEAR}</div></div>
                      </div>
                      {[
                        ['Briefing mensual', briefingApproved ? 'done' : briefing ? 'active' : 'pending'],
                        ['Calendario de contenido', calendarApproved ? 'done' : calendar.length > 0 ? 'active' : 'pending'],
                        ['Diseños visuales', 'pending'],
                        ['Copy por plataforma', copyApproved ? 'done' : copyData.length > 0 ? 'active' : 'pending'],
                        ['Programar en GHL', ghlDone ? 'done' : schedule.length > 0 ? 'active' : 'pending'],
                      ].map(([label, status]) => (
                        <div key={label} className="status-row" style={{opacity: status === 'pending' ? 0.4 : 1}}>
                          <span>{label}</span>
                          <span className={badgeClass(status as string)} style={{borderRadius:20,padding:'3px 10px'}}>{badgeText(status as string)}</span>
                        </div>
                      ))}
                      <div className="divider"/>
                      <button className="btn btn-primary btn-block" onClick={() => navTo('fase1')}>
                        {briefingApproved ? 'Ver Fase 2 →' : 'Comenzar Fase 1 →'}
                      </button>
                    </div>
                  </div>

                  <div style={{display:'flex',flexDirection:'column',gap:16}}>
                    <div className="card">
                      <div className="card-header">
                        <div><div className="card-title">Integraciones</div></div>
                        <button className="btn btn-sm" onClick={() => navTo('integraciones')}>Ver →</button>
                      </div>
                      {intStatus ? (
                        <>
                          <div className="status-row">
                            <span><span className={intStatus.anthropic ? 'dot-connected' : 'dot-error'}/>Anthropic API</span>
                            <span style={{fontSize:11,fontFamily:'var(--mono)',color:intStatus.anthropic ? 'var(--teal)' : 'var(--red)'}}>
                              {intStatus.anthropic ? 'Conectado' : 'Error'}
                            </span>
                          </div>
                          <div className="status-row">
                            <span><span className={intStatus.monday ? 'dot-connected' : 'dot-error'}/>Monday.com</span>
                            <span style={{fontSize:11,fontFamily:'var(--mono)',color:intStatus.monday ? 'var(--teal)' : 'var(--red)'}}>
                              {intStatus.monday ? 'Conectado' : 'Error'}
                            </span>
                          </div>
                          <div className="status-row">
                            <span><span className={intStatus.ghl ? 'dot-connected' : 'dot-error'}/>GHL</span>
                            <span style={{fontSize:11,fontFamily:'var(--mono)',color:intStatus.ghl ? 'var(--teal)' : 'var(--red)'}}>
                              {intStatus.ghl ? 'Conectado' : 'Error'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div style={{padding:'12px 0',color:'var(--text3)',fontSize:12}}>Verificando conexiones...</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* === FASE 1: BRIEFING === */}
            {phase === 'fase1' && (
              <div>
                {briefingApproved && (
                  <div className="alert alert-teal">
                    ✓ Briefing aprobado y guardado en Monday.com
                  </div>
                )}

                {!briefing && !loading && (
                  <div className="generate-area">
                    <div className="generate-title">Generar Briefing de {MONTH} {YEAR}</div>
                    <div className="generate-sub">
                      Claude buscará tendencias del mercado inmobiliario en RD, actividad de la competencia, noticias de MITUR, contenido viral en LATAM y oportunidades para KASA y Arko este mes.
                    </div>
                    <button className="btn btn-primary" onClick={generateBriefing}>
                      Generar Briefing con Claude
                    </button>
                  </div>
                )}

                {loading && (
                  <div className="loading-state">
                    <div className="spinner"/>
                    <div className="loading-text">{loadingText}</div>
                  </div>
                )}

                {briefing && !loading && (
                  <div>
                    <div className="card" style={{marginBottom:16}}>
                      <div className="card-header">
                        <div><div className="card-title">Briefing — {MONTH} {YEAR}</div><div className="card-sub">generado por Claude · sm-1-briefing</div></div>
                        <div className="card-actions">
                          <button className="btn btn-sm" onClick={generateBriefing}>Regenerar</button>
                          {!briefingApproved && (
                            <button className="btn btn-success" onClick={approveBriefing}>
                              Aprobar y continuar →
                            </button>
                          )}
                        </div>
                      </div>

                      {briefing.contextoReferencia && (
                        <div style={{marginBottom:16}}>
                          <div className="section-label">🧭 Contexto de referencia</div>
                          <div style={{fontSize:13,lineHeight:1.7,color:'var(--text)'}}>{briefing.contextoReferencia}</div>
                        </div>
                      )}

                      {briefing.actividadCompetencia && (
                        <div style={{marginBottom:16}}>
                          <div className="section-label">🏢 Actividad de la competencia</div>
                          <div style={{fontSize:13,lineHeight:1.7}}>{briefing.actividadCompetencia}</div>
                        </div>
                      )}

                      {briefing.tendenciasContenido && (
                        <div style={{marginBottom:16}}>
                          <div className="section-label">📈 Tendencias y contenido viral</div>
                          <div style={{fontSize:13,lineHeight:1.7}}>{briefing.tendenciasContenido}</div>
                        </div>
                      )}

                      {briefing.noticiasSector && (
                        <div style={{marginBottom:16}}>
                          <div className="section-label">📰 Noticias del sector</div>
                          <div style={{fontSize:13,lineHeight:1.7}}>{briefing.noticiasSector}</div>
                        </div>
                      )}

                      {briefing.insightsClave && Array.isArray(briefing.insightsClave) && (
                        <div>
                          <div className="section-label">✅ Insights clave</div>
                          {briefing.insightsClave.map((insight: string, i: number) => (
                            <div key={i} style={{display:'flex',gap:10,padding:'8px 12px',background:'var(--surface2)',borderRadius:'var(--r-sm)',marginBottom:7,fontSize:13,lineHeight:1.55}}>
                              <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',width:18,flexShrink:0,paddingTop:1}}>{String(i+1).padStart(2,'0')}</span>
                              <span>{insight}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {!briefingApproved && (
                      <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                        <button className="btn btn-sm" onClick={generateBriefing}>Regenerar</button>
                        <button className="btn btn-success" onClick={approveBriefing}>
                          ✓ Aprobar Briefing y pasar a Fase 2 →
                        </button>
                      </div>
                    )}

                    {briefingApproved && (
                      <div style={{display:'flex',justifyContent:'flex-end'}}>
                        <button className="btn btn-primary" onClick={() => navTo('fase2')}>
                          Ir a Fase 2 — Calendario →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* === FASE 2: CALENDARIO === */}
            {phase === 'fase2' && (
              <div>
                {!calendar.length && !loading && (
                  <div>
                    {!briefingApproved && (
                      <div className="alert alert-amber">
                        Necesitas aprobar el Briefing primero. <button className="btn btn-xs btn-ghost" onClick={() => navTo('fase1')} style={{marginLeft:8}}>Ir a Fase 1 →</button>
                      </div>
                    )}
                    <div className="generate-area">
                      <div className="generate-title">Generar Calendario de Contenido</div>
                      <div className="generate-sub">
                        Claude leerá el briefing aprobado y generará el plan completo del mes: carousels, fotos, stories y lead magnets para KASA y Arko.
                      </div>
                      <button className="btn btn-primary" onClick={generateCalendar} disabled={!briefingApproved}>
                        Generar Calendario con Claude
                      </button>
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="loading-state">
                    <div className="spinner"/>
                    <div className="loading-text">{loadingText}</div>
                  </div>
                )}

                {calendar.length > 0 && !loading && (
                  <div>
                    {calendarApproved ? (
                      <div className="alert alert-teal">✓ Calendario aprobado — {calendar.length - rejectedPosts.size} posts guardados en Monday.com</div>
                    ) : (
                      <div className="alert alert-amber">
                        {approvedPosts.size + rejectedPosts.size === 0
                          ? `${calendar.length} posts generados — revisa y aprueba`
                          : `${approvedPosts.size} aprobados · ${rejectedPosts.size} rechazados de ${calendar.length}`}
                      </div>
                    )}

                    <div className="card">
                      <div className="card-header">
                        <div>
                          <div className="card-title">Calendario — {MONTH} {YEAR}</div>
                          <div className="card-sub">{calendar.length} posts generados</div>
                        </div>
                        {!calendarApproved && (
                          <div className="card-actions">
                            <button className="btn btn-sm btn-danger" onClick={() => {
                              const all = new Set(calendar.map((_,i) => i))
                              setRejectedPosts(all)
                              setApprovedPosts(new Set())
                            }}>Rechazar todo</button>
                            <button className="btn btn-success btn-sm" onClick={() => {
                              const all = new Set(calendar.map((_,i) => i))
                              setApprovedPosts(all)
                              setRejectedPosts(new Set())
                            }}>Aprobar todo</button>
                          </div>
                        )}
                      </div>

                      {[1,2,3,4].map(week => {
                        const weekPosts = calendar.filter(p => p.week === week)
                        if (!weekPosts.length) return null
                        return (
                          <div key={week}>
                            <div className="week-header">
                              <span className="week-title">Semana {week}</span>
                              <span className="week-count">{weekPosts.length} posts</span>
                            </div>
                            <div className="post-list">
                              {weekPosts.map((post, idx) => {
                                const globalIdx = calendar.indexOf(post)
                                const isApproved = approvedPosts.has(globalIdx)
                                const isRejected = rejectedPosts.has(globalIdx)
                                return (
                                  <div key={idx} className={`post-row${isApproved ? ' approved' : isRejected ? ' rejected' : ''}`}>
                                    <div className="post-num">{globalIdx + 1}</div>
                                    <div className="post-body">
                                      <div className="post-name">{post.name}</div>
                                      <div className="post-meta">
                                        <span className="post-date">{post.suggestedDay}</span>
                                        <span className={formatChip(post.format)}>{post.format}</span>
                                        <span className={projectChip(post.project)}>{post.project}</span>
                                        {post.keyword && <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>key: {post.keyword}</span>}
                                        <button 
                                          className="btn btn-xs btn-ghost" 
                                          style={{marginLeft: 'auto'}}
                                          onClick={() => {
                                            const s = new Set(openPosts)
                                            s.has(globalIdx) ? s.delete(globalIdx) : s.add(globalIdx)
                                            setOpenPosts(s)
                                          }}
                                        >
                                          {openPosts.has(globalIdx) ? '▲ Menos info' : '▼ Ver info'}
                                        </button>
                                      </div>
                                      {openPosts.has(globalIdx) && (
                                        <div style={{marginTop: 8, padding: 12, background: 'var(--surface2)', borderRadius: 6, fontSize: 13, color: 'var(--text)'}}>
                                          <div style={{marginBottom: 6}}><strong style={{color:'var(--text2)'}}>Dirección de contenido:</strong><br/> {post.contentDirection}</div>
                                          <div><strong style={{color:'var(--text2)'}}>Media necesaria:</strong><br/> {post.mediaNeeded}</div>
                                        </div>
                                      )}
                                    </div>
                                    {!calendarApproved && (
                                      <div className="post-actions">
                                        <button
                                          className={`action-btn approve${isApproved ? ' approved' : ''}`}
                                          onClick={() => {
                                            const newA = new Set(approvedPosts)
                                            const newR = new Set(rejectedPosts)
                                            if (isApproved) { newA.delete(globalIdx) } else { newA.add(globalIdx); newR.delete(globalIdx) }
                                            setApprovedPosts(newA); setRejectedPosts(newR)
                                          }}
                                        >✓</button>
                                        <button
                                          className={`action-btn reject${isRejected ? ' rejected-state' : ''}`}
                                          onClick={() => {
                                            const newA = new Set(approvedPosts)
                                            const newR = new Set(rejectedPosts)
                                            if (isRejected) { newR.delete(globalIdx) } else { newR.add(globalIdx); newA.delete(globalIdx) }
                                            setApprovedPosts(newA); setRejectedPosts(newR)
                                          }}
                                        >✕</button>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                            {week < 4 && <div className="divider"/>}
                          </div>
                        )
                      })}

                      {!calendarApproved && (
                        <>
                          <div className="divider"/>
                          <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                            <button className="btn btn-sm" onClick={generateCalendar}>Regenerar</button>
                            <button className="btn btn-success" onClick={approveCalendar}>
                              ✓ Aprobar calendario y subir a Monday.com →
                            </button>
                          </div>
                        </>
                      )}

                      {calendarApproved && (
                        <div style={{display:'flex',justifyContent:'flex-end',marginTop:14}}>
                          <button className="btn btn-primary" onClick={() => navTo('fase4')}>
                            Ir a Fase 4 — Copy →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === FASE 3: IMÁGENES AUTOMÁTICAS === */}
            {phase === 'fase3' && (
              <div>
                {/* IDLE */}
                {fase3Step === 'idle' && (
                  <div className="card">
                    <div className="card-header">
                      <div><div className="card-title">Fase 3 — Imágenes Automáticas</div><div className="card-sub">Sube tus fotos → Vision selecciona → Render → Revisión</div></div>
                    </div>
                    <div className="alert alert-amber" style={{marginBottom:16}}>
                      Sube las fotos y renders disponibles. Claude descartará las que no necesite y asignará las mejores al calendario. Lo que falte se genera con IA automáticamente.
                    </div>
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:11,color:'var(--text3)',marginBottom:6}}>SUBIR IMÁGENES</div>
                      <label style={{display:'block', border:'2px dashed var(--border)', padding:'40px 20px', textAlign:'center', borderRadius:'var(--r-sm)', cursor:'pointer', background:'var(--surface2)'}}>
                        <div style={{fontSize:28, marginBottom:8}}>📸</div>
                        <div style={{fontSize:13, fontWeight:500, color:'var(--text)'}}>Haz clic o arrastra imágenes aquí</div>
                        <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>JPG, PNG, WEBP — Puedes subir múltiples a la vez</div>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          style={{display:'none'}}
                          onChange={e => {
                            if (e.target.files) setFase3Files(Array.from(e.target.files))
                          }}
                        />
                      </label>
                      {fase3Files.length > 0 && (
                        <div style={{marginTop:8, fontSize:12, color:'var(--teal)', fontWeight:500}}>
                          ✓ {fase3Files.length} imágenes seleccionadas
                        </div>
                      )}
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-primary" onClick={runFase3} disabled={!calendar.length}>
                        ⚡ Iniciar pipeline de imágenes
                      </button>
                      <button className="btn btn-sm" onClick={() => navTo('fase4')}>Saltar →</button>
                    </div>
                  </div>
                )}

                {/* LOADING */}
                {['scanning','assigning','rendering'].includes(fase3Step) && (
                  <div className="card" style={{textAlign:'center',padding:40}}>
                    <div className="spinner" style={{margin:'0 auto 16px'}}/>
                    <div style={{fontSize:14,fontWeight:600,marginBottom:8}}>{loadingText}</div>
                    <div style={{fontSize:12,color:'var(--text3)'}}>
                      {fase3Step === 'scanning'  && '📁 Procesando imágenes subidas...'}
                      {fase3Step === 'assigning' && '👁 Claude Vision analizando imágenes...'}
                      {fase3Step === 'rendering' && '🎨 Aplicando marca + generando con IA...'}
                    </div>
                  </div>
                )}

                {/* BANDEJA DE REVISIÓN */}
                {fase3Step === 'review' && renderedPosts.length > 0 && (
                  <div>
                    {fase3Stats && (
                      <div className="alert alert-teal" style={{marginBottom:16}}>
                        ✓ <strong>{renderedPosts.length} posts</strong> listos —
                        <strong> {fase3Stats.fromDrive} subidas</strong> ·
                        <strong> {fase3Stats.fromAI} con IA</strong> ·
                        <strong> {fase3Stats.carousels} carruseles</strong>
                      </div>
                    )}

                    {renderedPosts.map((post: any) => (
                      <div key={post.postId} className="card" style={{marginBottom:16}}>
                        <div className="card-header">
                          <div>
                            <div className="card-title">{post.postName}</div>
                            <div className="card-sub">
                              {post.format} · {post.project} · Semana {post.week} {post.suggestedDay} ·
                              <span style={{color: post.source === 'drive' ? 'var(--teal)' : 'var(--purple)', marginLeft:4}}>
                                {post.source === 'drive' ? '📁 Subida' : '🤖 IA generativa'}
                              </span>
                              {post.isCarousel && <span style={{marginLeft:6,color:'var(--text3)'}}>· {post.slideThumbnails?.length} slides</span>}
                            </div>
                          </div>
                          <div style={{display:'flex',gap:8,flexShrink:0}}>
                            <button className="btn btn-sm" style={{background:'var(--danger)',color:'#fff',border:'none'}}
                              onClick={() => rejectAndRegenerate(post)}>✕ Regenerar</button>
                          </div>
                        </div>

                        {/* Previews */}
                        <div style={{display:'flex',gap:8,overflowX:'auto',padding:'8px 0',marginBottom:12}}>
                          {post.isCarousel
                            ? post.slideThumbnails?.map((t: string, i: number) => (
                                <img key={i} src={t} alt={`Slide ${i+1}`}
                                  style={{width:120,height:120,objectFit:'cover',borderRadius:6,flexShrink:0,border:'1px solid var(--border)'}}/>
                              ))
                            : post.imageThumbnail && (
                                <img src={post.imageThumbnail} alt="Preview"
                                  style={{width:120,height:120,objectFit:'cover',borderRadius:6,border:'1px solid var(--border)'}}/>
                              )
                          }
                        </div>

                        {/* Fecha/hora */}
                        <div style={{display:'flex',gap:10,marginBottom:10,alignItems:'center'}}>
                          <span style={{fontSize:11,color:'var(--text3)',whiteSpace:'nowrap'}}>Fecha sugerida:</span>
                          <input type="date"
                            onChange={e => updatePostCopy(post.postId, 'scheduledDate', e.target.value)}
                            style={{padding:'5px 8px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:4,color:'var(--text)',fontSize:12}}
                          />
                          <input type="time" defaultValue="12:00"
                            onChange={e => updatePostCopy(post.postId, 'scheduledTime', e.target.value)}
                            style={{padding:'5px 8px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:4,color:'var(--text)',fontSize:12}}
                          />
                        </div>

                        {/* Copy editable */}
                        {post.platforms?.includes('IG') && (
                          <div style={{marginBottom:8}}>
                            <div style={{fontSize:10,color:'var(--text3)',marginBottom:3,letterSpacing:'.06em'}}>INSTAGRAM</div>
                            <textarea rows={2}
                              defaultValue={post.copyIG ?? ''}
                              onChange={e => updatePostCopy(post.postId, 'copyIG', e.target.value)}
                              style={{width:'100%',padding:'7px 10px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:4,color:'var(--text)',fontSize:12,resize:'vertical' as const,boxSizing:'border-box' as const}}
                            />
                          </div>
                        )}
                        {post.platforms?.includes('FB') && (
                          <div>
                            <div style={{fontSize:10,color:'var(--text3)',marginBottom:3,letterSpacing:'.06em'}}>FACEBOOK</div>
                            <textarea rows={2}
                              defaultValue={post.copyFB ?? ''}
                              onChange={e => updatePostCopy(post.postId, 'copyFB', e.target.value)}
                              style={{width:'100%',padding:'7px 10px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:4,color:'var(--text)',fontSize:12,resize:'vertical' as const,boxSizing:'border-box' as const}}
                            />
                          </div>
                        )}
                      </div>
                    ))}

                    <button className="btn btn-primary" onClick={approveAllAndContinue}
                      style={{width:'100%',padding:'14px',fontSize:14,marginTop:4}}>
                      ✓ Aprobar todo y continuar a Fase 4 →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* === FASE 4: COPY === */}
            {phase === 'fase4' && (
              <div>
                {!copyData.length && !loading && (
                  <div>
                    {!calendarApproved && (
                      <div className="alert alert-amber">
                        Necesitas aprobar el Calendario primero. <button className="btn btn-xs btn-ghost" onClick={() => navTo('fase2')} style={{marginLeft:8}}>Ir a Fase 2 →</button>
                      </div>
                    )}
                    <div className="generate-area">
                      <div className="generate-title">Generar Copy por Plataforma</div>
                      <div className="generate-sub">
                        Claude redactará el copy para cada post adaptado a Instagram, Facebook, LinkedIn y Google My Business — con el tono y voz de Noriega Group.
                      </div>
                      <button className="btn btn-primary" onClick={generateCopy} disabled={!calendarApproved}>
                        Generar Copy con Claude
                      </button>
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="loading-state">
                    <div className="spinner"/>
                    <div className="loading-text">{loadingText}</div>
                  </div>
                )}

                {copyData.length > 0 && !loading && (
                  <div>
                    {copyApproved ? (
                      <div className="alert alert-teal">✓ Copy aprobado y guardado en Monday.com</div>
                    ) : (
                      <div className="alert alert-amber">Revisa el copy de cada post — puedes editarlo antes de aprobar</div>
                    )}

                    <div className="card">
                      <div className="card-header">
                        <div><div className="card-title">Copy por post — {MONTH} {YEAR}</div><div className="card-sub">{copyData.length} posts</div></div>
                        {!copyApproved && (
                          <button className="btn btn-success btn-sm" onClick={approveCopy}>Aprobar todo →</button>
                        )}
                      </div>

                      {copyData.map((item, i) => (
                        <div key={i} className="copy-item">
                          <div className="copy-header" onClick={() => {
                            const s = new Set(openCopies)
                            s.has(i) ? s.delete(i) : s.add(i)
                            setOpenCopies(s)
                          }}>
                            <div className="copy-title">{item.postName}</div>
                            <span className="copy-chevron" style={{transform: openCopies.has(i) ? 'rotate(180deg)' : 'none'}}>▼</span>
                          </div>
                          {openCopies.has(i) && (
                            <div className="copy-body open" style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                              {/* PREVISUALIZACIÓN DE LA IMAGEN */}
                              {designs.find(d => d.postId === item.postId || d.postName === item.postName) && (
                                <div style={{ width: '220px', flexShrink: 0 }}>
                                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Imagen asignada</div>
                                  <img 
                                    src={designs.find(d => d.postId === item.postId || d.postName === item.postName)?.imageUrl} 
                                    alt={item.postName} 
                                    style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border)' }}
                                  />
                                </div>
                              )}
                              
                              {/* TEXTOS POR RED SOCIAL */}
                              <div style={{ flexGrow: 1 }}>
                                {item.copyIG && (
                                  <div className="copy-platform">
                                    <div className="copy-platform-label">Instagram</div>
                                    <div className="copy-text">{item.copyIG}</div>
                                  </div>
                                )}
                                {item.copyFB && (
                                  <div className="copy-platform">
                                    <div className="copy-platform-label">Facebook</div>
                                    <div className="copy-text">{item.copyFB}</div>
                                  </div>
                                )}
                                {item.copyLI && (
                                  <div className="copy-platform">
                                    <div className="copy-platform-label">LinkedIn</div>
                                    <div className="copy-text">{item.copyLI}</div>
                                  </div>
                                )}
                                {item.copyGMB && (
                                  <div className="copy-platform">
                                    <div className="copy-platform-label">Google My Business</div>
                                    <div className="copy-text">{item.copyGMB}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {!copyApproved && (
                        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:14}}>
                          <button className="btn btn-sm" onClick={generateCopy}>Regenerar</button>
                          <button className="btn btn-success" onClick={approveCopy}>
                            ✓ Aprobar copy y pasar a Fase 5 →
                          </button>
                        </div>
                      )}

                      {copyApproved && (
                        <div style={{display:'flex',justifyContent:'flex-end',marginTop:14}}>
                          <button className="btn btn-primary" onClick={() => navTo('fase5')}>
                            Ir a Fase 5 — Programar →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === FASE 5: SCHEDULE === */}
            {phase === 'fase5' && (
              <div>
                {ghlDone && (
                  <div className="alert alert-teal">
                    🎉 ¡{MONTH} {YEAR} completamente programado en GHL! El agente ha completado las 5 fases.
                  </div>
                )}

                {!schedule.length && !loading && !ghlDone && (
                  <div>
                    {!copyApproved && (
                      <div className="alert alert-amber">
                        Necesitas aprobar el Copy primero. <button className="btn btn-xs btn-ghost" onClick={() => navTo('fase4')} style={{marginLeft:8}}>Ir a Fase 4 →</button>
                      </div>
                    )}
                    <div className="generate-area">
                      <div className="generate-title">Generar Horarios y Programar en GHL</div>
                      <div className="generate-sub">
                        Claude calculará los horarios óptimos para la audiencia dominicana y latinoamericana, luego enviará todos los posts directamente a GHL Social Planner.
                      </div>
                      <button className="btn btn-primary" onClick={generateSchedule} disabled={!copyApproved}>
                        Generar Horarios con Claude
                      </button>
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="loading-state">
                    <div className="spinner"/>
                    <div className="loading-text">{loadingText}</div>
                  </div>
                )}

                {schedule.length > 0 && !loading && (
                  <div className="grid-2" style={{gap:16}}>
                    <div>
                      <div className="card">
                        <div className="card-header">
                          <div><div className="card-title">Horarios propuestos</div><div className="card-sub">{schedule.length} posts · {MONTH} {YEAR}</div></div>
                        </div>

                        <div style={{marginBottom:8,display:'grid',gridTemplateColumns:'65px 58px 1fr auto',gap:10,fontSize:10,fontFamily:'var(--mono)',color:'var(--text3)',padding:'0 0 8px',borderBottom:'1px solid var(--border)'}}>
                          <span>Fecha</span><span>Hora</span><span>Post</span><span>Plats</span>
                        </div>

                        {schedule.slice(0,10).map((item, i) => (
                          <div key={i} className="sched-row">
                            <span className="sched-date">{item.scheduledDate?.slice(5)}</span>
                            <span className="sched-time">{item.scheduledTime}</span>
                            <span className="sched-name">{item.postName}</span>
                            <div className="sched-plats">
                              {(item.platforms || []).map(p => (
                                <span key={p} className={platClass(p)}>{p}</span>
                              ))}
                            </div>
                          </div>
                        ))}

                        {schedule.length > 10 && (
                          <div style={{padding:'8px 0',fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>
                            + {schedule.length - 10} posts más...
                          </div>
                        )}

                        <div className="divider"/>
                        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                          <button className="btn btn-sm" onClick={generateSchedule}>Regenerar horarios</button>
                          {!scheduleApproved && (
                            <button className="btn btn-success" onClick={sendToGHL}>
                              Enviar todo a GHL →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="card">
                        <div className="card-header">
                          <div><div className="card-title">Resumen de envío</div></div>
                        </div>
                        {['Instagram','Facebook','LinkedIn','Google My Business'].map(p => {
                          const code = p === 'Instagram' ? 'IG' : p === 'Facebook' ? 'FB' : p === 'LinkedIn' ? 'LI' : 'GMB'
                          const count = schedule.filter(s => s.platforms?.includes(code)).length
                          return (
                            <div key={p} className="status-row">
                              <span>{p}</span>
                              <span style={{fontFamily:'var(--mono)',fontSize:12}}>{count} posts via GHL</span>
                            </div>
                          )
                        })}
                        <div className="divider"/>
                        <div className="status-row">
                          <span style={{fontWeight:500}}>Total</span>
                          <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:500}}>{schedule.length} posts</span>
                        </div>

                        {scheduleApproved && !ghlDone && (
                          <div style={{marginTop:14}}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:12}}>
                              <span style={{color:'var(--text3)',fontFamily:'var(--mono)'}}>Enviando a GHL...</span>
                              <span style={{fontFamily:'var(--mono)',fontWeight:500}}>{ghlProgress}%</span>
                            </div>
                            <div className="progress-bar" style={{height:6}}>
                              <div className="progress-fill progress-teal" style={{width:`${ghlProgress}%`}}/>
                            </div>
                          </div>
                        )}

                        {ghlDone && (
                          <div style={{textAlign:'center',padding:'20px 0'}}>
                            <div style={{fontSize:32,marginBottom:8}}>✅</div>
                            <div style={{fontSize:15,fontWeight:500,marginBottom:6}}>{MONTH} programado</div>
                            <div style={{fontSize:12,color:'var(--text3)',fontFamily:'var(--mono)'}}>{schedule.length} posts en GHL</div>
                            <button className="btn btn-sm" style={{marginTop:14}} onClick={() => navTo('dashboard')}>
                              Volver al dashboard →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === REPORTES === */}
            {phase === 'reportes' && (
              <div>
                {!report && !loading && (
                  <div className="generate-area">
                    <div className="generate-title">Reporte de Desempeño</div>
                    <div className="generate-sub">
                      Claude analizará los datos de Monday.com y GHL para generar un reporte completo del mes con insights y recomendaciones.
                    </div>
                    <button className="btn btn-primary" onClick={loadReport}>
                      Generar Reporte con Claude
                    </button>
                  </div>
                )}

                {loading && (
                  <div className="loading-state">
                    <div className="spinner"/>
                    <div className="loading-text">{loadingText}</div>
                  </div>
                )}

                {report && !loading && (
                  <div>
                    <div className="card" style={{marginBottom:16}}>
                      <div className="card-header">
                        <div><div className="card-title">Reporte — {report.month} {report.year}</div></div>
                    <button className="btn btn-sm btn-primary" onClick={exportToPDF}>Descargar PDF</button>
                      </div>

                  {/* Wrapper para el PDF con fondo blanco */}
                  <div id="report-wrapper" style={{background: '#ffffff', padding: '24px', borderRadius: '8px', color: '#1a1a1a'}}>
                    <h3 style={{marginBottom: 20, fontSize: 18, borderBottom: '2px solid #eaeaea', paddingBottom: 10}}>
                      Reporte de Resultados: Noriega Group
                    </h3>
                    <div className="grid-4" style={{marginBottom:16}}>
                        <div className="metric"><div className="metric-label">total posts</div><div className="metric-val">{report.totalPosts || 0}</div></div>
                        <div className="metric"><div className="metric-label">programados</div><div className="metric-val">{report.scheduled || 0}</div></div>
                        <div className="metric"><div className="metric-label">plataformas</div><div className="metric-val">4</div></div>
                        <div className="metric"><div className="metric-label">lead magnets</div><div className="metric-val">{report.byFormat?.['Lead Magnet'] || 0}</div></div>
                      </div>

                      {report.summary && (
                        <div style={{fontSize:13,lineHeight:1.7,color:'var(--text)',marginBottom:16,padding:'12px 14px',background:'var(--surface2)',borderRadius:'var(--r-sm)'}}>
                          {report.summary}
                        </div>
                      )}

                      {!!report.insights && report.insights.length > 0 && (
                        <div style={{marginBottom:16}}>
                          <div className="section-label">Insights</div>
                          {report.insights.map((ins, i) => (
                            <div key={i} style={{display:'flex',gap:8,padding:'6px 0',fontSize:13,lineHeight:1.55,borderBottom:'1px solid var(--border)'}}>
                              <span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--text3)',width:18,flexShrink:0,paddingTop:2}}>{i+1}</span>
                              {ins}
                            </div>
                          ))}
                        </div>
                      )}

                      {!!report.recommendations && report.recommendations.length > 0 && (
                        <div>
                          <div className="section-label">Recomendaciones para el próximo mes</div>
                          {report.recommendations.map((rec, i) => (
                            <div key={i} style={{display:'flex',gap:8,padding:'6px 0',fontSize:13,lineHeight:1.55,borderBottom:'1px solid var(--border)'}}>
                              <span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--teal)',width:18,flexShrink:0,paddingTop:2}}>→</span>
                              {rec}
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === COMPARATIVO === */}
            {phase === 'comparativo' && (
              <div className="card">
                <div className="card-header">
                  <div><div className="card-title">Comparativo mensual</div><div className="card-sub">se llena automáticamente con datos reales de múltiples meses</div></div>
                </div>
                <div style={{padding:'40px 20px',textAlign:'center',color:'var(--text3)'}}>
                  <div style={{fontSize:32,marginBottom:12}}>📊</div>
                  <div style={{fontSize:14,fontWeight:500,marginBottom:8}}>Datos insuficientes</div>
                  <div style={{fontSize:13,lineHeight:1.6}}>Este reporte se construirá automáticamente cuando tengas 2+ meses de datos guardados en Monday.com.</div>
                </div>
              </div>
            )}

            {/* === INTEGRACIONES === */}
            {phase === 'integraciones' && (
              <div className="grid-2" style={{gap:16}}>
                <div className="card">
                  <div className="card-header"><div><div className="card-title">Estado de conexiones</div></div></div>
                  {intStatus ? (
                    <>
                      <div className="status-row">
                        <span><span className={intStatus.anthropic ? 'dot-connected' : 'dot-error'}/>Anthropic API</span>
                        <span style={{fontSize:11,fontFamily:'var(--mono)',color:intStatus.anthropic ? 'var(--teal)' : 'var(--red)'}}>
                          {intStatus.anthropic ? 'Conectado' : `Error: ${intStatus.errors?.anthropic?.slice(0,40)}`}
                        </span>
                      </div>
                      <div className="status-row">
                        <span><span className={intStatus.monday ? 'dot-connected' : 'dot-error'}/>Monday.com</span>
                        <span style={{fontSize:11,fontFamily:'var(--mono)',color:intStatus.monday ? 'var(--teal)' : 'var(--red)'}}>
                          {intStatus.monday ? 'Conectado' : `Error: ${intStatus.errors?.monday?.slice(0,40)}`}
                        </span>
                      </div>
                      <div className="status-row">
                        <span><span className={intStatus.ghl ? 'dot-connected' : 'dot-error'}/>GHL (GoHighLevel)</span>
                        <span style={{fontSize:11,fontFamily:'var(--mono)',color:intStatus.ghl ? 'var(--teal)' : 'var(--red)'}}>
                          {intStatus.ghl ? 'Conectado' : `Error: ${intStatus.errors?.ghl?.slice(0,40)}`}
                        </span>
                      </div>
                      <div className="divider"/>
                      <button className="btn btn-sm" onClick={() => fetch('/api/status').then(r=>r.json()).then(setIntStatus)}>
                        Verificar conexiones
                      </button>
                    </>
                  ) : (
                    <div className="loading-state" style={{padding:'24px 0'}}>
                      <div className="spinner"/>
                      <div className="loading-text">Verificando...</div>
                    </div>
                  )}
                </div>

                <div className="card">
                  <div className="card-header"><div><div className="card-title">Variables de entorno</div><div className="card-sub">configura en .env.local</div></div></div>
                  {[
                    ['ANTHROPIC_API_KEY','console.anthropic.com → API Keys'],
                    ['MONDAY_API_KEY','Monday perfil → Administration → API'],
                    ['MONDAY_WORKSPACE_ID','URL del workspace en Monday'],
                    ['GHL_API_KEY','GHL → Settings → API Keys'],
                    ['GHL_LOCATION_ID','GHL → Settings → Business Info'],
                  ].map(([key, hint]) => (
                    <div key={key} className="status-row">
                      <div>
                        <div style={{fontFamily:'var(--mono)',fontSize:11,fontWeight:500}}>{key}</div>
                        <div style={{fontSize:10,color:'var(--text3)',marginTop:1}}>{hint}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* === CARGA RÁPIDA === */}
            {phase === 'carga' && (() => {
              const statusColor: Record<ContentStatus, string> = {
                borrador: 'var(--text3)',
                revision: '#f59e0b',
                aprobado: 'var(--teal)',
                programado: 'var(--primary, #6c5dd3)',
                publicado: '#8b5cf6',
              }
              const statusLabel: Record<ContentStatus, string> = {
                borrador: 'Borrador', revision: 'En revisión', aprobado: 'Aprobado',
                programado: 'Programado', publicado: 'Publicado',
              }
              const captionKeys: (keyof ManualContent['captions'])[] = ['captionIG','captionFB','captionLI','captionGMB']
              const captionPlat = ['IG','FB','LI','GMB']
              const readyCount = manualItems.filter(i => i.platforms.length > 0 && i.scheduledDate).length

              const inputStyle: React.CSSProperties = {
                width: '100%', fontSize: 12, padding: '6px 10px',
                border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }
              const dropZone: React.CSSProperties = {
                border: '1.5px dashed var(--border)', borderRadius: 'var(--r-sm)',
                background: 'var(--surface2)', marginBottom: 12, overflow: 'hidden',
              }

              return (
                <div>
                  {/* Header */}
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20, flexWrap:'wrap', gap: 12}}>
                    <p style={{fontSize:13, color:'var(--text2)', margin:0}}>
                      Sube carruseles, fotos y reels ya creados — la IA genera las descripciones y los envías con un clic a GHL.
                    </p>
                    <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
                      <label className="btn btn-primary btn-sm" style={{whiteSpace:'nowrap', marginBottom: 0, cursor: 'pointer'}}>
                        📁 Subir carpeta
                        <input
                          type="file"
                          multiple
                          style={{display:'none'}}
                          onChange={e => handleFolderUpload(e.target.files)}
                          disabled={processingFolder}
                          {...{webkitdirectory: 'true'} as any}
                        />
                      </label>
                      <button className="btn btn-primary btn-sm" onClick={addManualItem} style={{whiteSpace:'nowrap'}}>
                        + Contenido
                      </button>
                    </div>
                  </div>

                  {manualItems.length > 0 && (
                    <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center'}}>
                      <button 
                        className="btn btn-sm" 
                        onClick={() => setShowCalendarPreview(!showCalendarPreview)}
                        style={{background: showCalendarPreview ? 'var(--teal)' : 'var(--surface2)'}}
                      >
                        📅 {showCalendarPreview ? 'Ocultar' : 'Ver'} calendario
                      </button>
                      <button 
                        className="btn btn-sm" 
                        onClick={generateAllCaptions}
                        disabled={generatingAllCaptions || manualItems.filter(i => !i.captionsGenerated).length === 0}
                      >
                        {generatingAllCaptions ? '⏳ Generando...' : `✨ Generar captions (${manualItems.filter(i => !i.captionsGenerated && i.files.length > 0).length})`}
                      </button>
                    </div>
                  )}

                  {showCalendarPreview && manualItems.length > 0 && (
                    <div className="card" style={{marginBottom:16, background:'var(--surface2)', borderLeft:'3px solid var(--teal)', padding:16}}>
                      <div style={{fontSize:12, fontWeight:600, marginBottom:10, color:'var(--teal)'}}>📅 Calendario Presunto</div>
                      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:8}}>
                        {manualItems.map((item, idx) => (
                          <div key={item.id} style={{
                            background: 'var(--surface)',
                            padding: 10,
                            borderRadius: 'var(--r-sm)',
                            fontSize: 11,
                            borderLeft: `2px solid ${item.type === 'carrusel' ? '#f59e0b' : item.type === 'reel' ? '#8b5cf6' : '#6366f1'}`
                          }}>
                            <div style={{fontWeight:600, marginBottom:4, color: 'var(--text)'}}>{item.title}</div>
                            <div style={{fontSize:10, color:'var(--text2)', marginBottom:4}}>
                              {item.type.charAt(0).toUpperCase() + item.type.slice(1)} • {item.scheduledDate} {item.scheduledTime}
                            </div>
                            <div style={{fontSize:9, color:'var(--text3)'}}>
                              {item.platforms.join(', ')} {item.files.length > 0 ? `• ${item.files.length} archivo${item.files.length !== 1 ? 's' : ''}` : ''}
                            </div>
                            {item.wasAutoScheduled && (
                              <div style={{fontSize:9, color:'var(--teal)', marginTop:4}}>⚙️ Programación automática</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {manualItems.length === 0 && (
                    <div className="generate-area">
                      <div className="generate-title">Publicación Rápida</div>
                      <div className="generate-sub">
                        Sube contenido ya creado (carruseles, posts, reels), la IA le agrega las descripciones
                        y con un clic todo va al calendario de GHL programado con fecha, hora y plataformas.
                      </div>
                      <div style={{display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap'}}>
                        <label className="btn btn-primary" style={{cursor:'pointer', marginBottom:0}}>
                          📁 Subir carpeta
                          <input
                            type="file"
                            multiple
                            style={{display:'none'}}
                            onChange={e => handleFolderUpload(e.target.files)}
                            disabled={processingFolder}
                            {...{webkitdirectory: 'true'} as any}
                          />
                        </label>
                        <button className="btn btn-sm" onClick={() => { addManualItem() }}>
                          + Post
                        </button>
                        <button className="btn btn-sm" onClick={() => { addManualItem() }}>
                          + Carrusel
                        </button>
                        <button className="btn btn-sm" onClick={() => { addManualItem() }}>
                          + Reel
                        </button>
                      </div>
                    </div>
                  )}

                  {manualItems.length > 0 && (
                    <>
                      <div style={{display:'flex', flexDirection:'column', gap:16}}>
                        {manualItems.map((item) => (
                          <div key={item.id} className="card" style={{borderLeft:`3px solid ${statusColor[item.status]}`}}>

                            {/* Card top row */}
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
                              <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                                {/* Type selector */}
                                <select
                                  value={item.type}
                                  onChange={e => updateManualItem(item.id, { type: e.target.value as ContentType })}
                                  style={{...inputStyle, width:'auto', fontWeight:600, padding:'4px 8px'}}
                                >
                                  <option value="post">Post</option>
                                  <option value="carrusel">Carrusel</option>
                                  <option value="reel">Reel</option>
                                </select>
                                {/* Status selector */}
                                <select
                                  value={item.status}
                                  onChange={e => updateManualItem(item.id, { status: e.target.value as ContentStatus })}
                                  style={{...inputStyle, width:'auto', padding:'4px 8px', color: statusColor[item.status], fontWeight:500}}
                                >
                                  {(Object.keys(statusLabel) as ContentStatus[]).map(s => (
                                    <option key={s} value={s}>{statusLabel[s]}</option>
                                  ))}
                                </select>
                                {item.status === 'programado' && (
                                  <span style={{fontSize:11, color:'var(--teal)', fontWeight:600}}>✓ En GHL</span>
                                )}
                              </div>
                              <button
                                className="btn btn-xs btn-ghost"
                                onClick={() => deleteManualItem(item.id)}
                                style={{color:'var(--red,#ef4444)', fontSize:16, lineHeight:1, padding:'2px 6px'}}
                              >✕</button>
                            </div>

                            {/* Title */}
                            <input
                              type="text"
                              placeholder="Título del contenido (ej. Carrusel KASA — Amenidades)..."
                              value={item.title}
                              onChange={e => updateManualItem(item.id, {title: e.target.value})}
                              style={{...inputStyle, marginBottom:12}}
                            />

                            {/* File upload */}
                            <div style={dropZone}>
                              {item.files.length === 0 ? (
                                <label style={{cursor:'pointer', display:'block', textAlign:'center', padding:'28px 16px'}}>
                                  <div style={{fontSize:28, marginBottom:8}}>
                                    {item.type === 'reel' ? '🎬' : item.type === 'carrusel' ? '🖼️' : '📷'}
                                  </div>
                                  <div style={{fontSize:12, color:'var(--text2)', marginBottom:4}}>
                                    {item.type === 'reel'
                                      ? 'Arrastra tu video o haz clic (MP4, MOV)'
                                      : item.type === 'carrusel'
                                      ? 'Arrastra las imágenes o haz clic (2-10 imágenes)'
                                      : 'Arrastra la imagen o haz clic (JPG, PNG)'}
                                  </div>
                                  <div style={{fontSize:11, color:'var(--text3)'}}>Seleccionar archivo</div>
                                  <input
                                    type="file"
                                    accept={item.type === 'reel' ? 'video/mp4,video/mov,video/quicktime,video/avi,video/webm' : 'image/jpeg,image/png,image/gif,image/webp'}
                                    multiple
                                    style={{display:'none'}}
                                    onChange={e => handleMediaSelect(item.id, e.target.files)}
                                  />
                                </label>
                              ) : (
                                <div style={{padding:12}}>
                                  <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:8}}>
                                    {item.files.map((f) => (
                                      <div key={f.id} style={{position:'relative', width:76, height:76, borderRadius:6, overflow:'hidden', background:'var(--surface2)', flexShrink:0}}>
                                        {f.mimeType.startsWith('video/') ? (
                                          <video src={f.preview} style={{width:'100%', height:'100%', objectFit:'cover'}} muted/>
                                        ) : (
                                          <img src={f.preview} alt={f.name} style={{width:'100%', height:'100%', objectFit:'cover'}}/>
                                        )}
                                        <button
                                          onClick={() => removeMediaFile(item.id, f.id)}
                                          style={{position:'absolute', top:3, right:3, background:'rgba(0,0,0,0.65)', color:'white', border:'none', borderRadius:'50%', width:18, height:18, cursor:'pointer', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', padding:0}}
                                        >✕</button>
                                        {f.ghlUrl && (
                                          <div style={{position:'absolute', bottom:2, left:2, background:'rgba(0,0,0,0.6)', color:'#4ade80', fontSize:9, borderRadius:3, padding:'1px 4px'}}>GHL</div>
                                        )}
                                      </div>
                                    ))}
                                    {item.type === 'carrusel' && item.files.length < 10 && (
                                      <label style={{width:76, height:76, borderRadius:6, border:'1.5px dashed var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:22, color:'var(--text3)', flexShrink:0, background:'var(--surface2)'}}>
                                        +
                                        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple style={{display:'none'}} onChange={e => handleMediaSelect(item.id, e.target.files, true)}/>
                                      </label>
                                    )}
                                  </div>
                                  <div style={{fontSize:11, color:'var(--text3)', display:'flex', gap:10, alignItems:'center'}}>
                                    <span>{item.files.length} archivo{item.files.length !== 1 ? 's' : ''}</span>
                                    <button className="btn btn-xs btn-ghost" onClick={() => updateManualItem(item.id, {files:[]})}>Cambiar</button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Description / context for reel or carousel */}
                            <textarea
                              placeholder={
                                item.type === 'reel'
                                  ? 'Describe brevemente el reel (ayuda a la IA). Ej: "Recorrido por las amenidades de KASA — piscina, lobby, terraza"...'
                                  : 'Contexto adicional para la IA (opcional). Ej: "Carrusel con los 5 beneficios CONFOTUR de Arko"...'
                              }
                              value={item.description}
                              onChange={e => updateManualItem(item.id, {description: e.target.value})}
                              style={{...inputStyle, minHeight:56, resize:'vertical', marginBottom:12}}
                            />

                            {/* Platforms */}
                            <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap'}}>
                              <span style={{fontSize:11, color:'var(--text3)', minWidth:72}}>Plataformas</span>
                              {(['IG','FB','LI','GMB'] as const).map(p => (
                                <button
                                  key={p}
                                  className={platClass(p)}
                                  onClick={() => togglePlatformManual(item.id, p)}
                                  style={{opacity: item.platforms.includes(p) ? 1 : 0.3, transform: item.platforms.includes(p) ? 'none' : 'scale(0.92)', transition:'all .15s'}}
                                >{p}</button>
                              ))}
                            </div>

                            {/* Date + Time */}
                            <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:14, flexWrap:'wrap'}}>
                              <span style={{fontSize:11, color:'var(--text3)', minWidth:72}}>Programar</span>
                              <input
                                type="date"
                                value={item.scheduledDate}
                                onChange={e => updateManualItem(item.id, {scheduledDate: e.target.value})}
                                style={{...inputStyle, width:'auto'}}
                              />
                              <input
                                type="time"
                                value={item.scheduledTime}
                                onChange={e => updateManualItem(item.id, {scheduledTime: e.target.value})}
                                style={{...inputStyle, width:'auto'}}
                              />
                            </div>

                            {/* Generate captions button */}
                            <div style={{display:'flex', gap:8, alignItems:'center'}}>
                              <button
                                className={`btn ${item.captionsGenerated ? 'btn-sm' : 'btn-primary'}`}
                                onClick={() => generateCaptionsForItem(item.id)}
                                disabled={item.generatingCaptions || (item.files.length === 0 && !item.description && !item.title)}
                              >
                                {item.generatingCaptions ? (
                                  <><span className="spinner" style={{width:12,height:12,borderWidth:2,marginRight:6,display:'inline-block'}}/> Generando...</>
                                ) : item.captionsGenerated ? 'Regenerar descripciones' : 'Generar descripciones con IA'}
                              </button>
                              {item.captionsGenerated && (
                                <button
                                  className="btn btn-xs btn-ghost"
                                  onClick={() => toggleCaptionsExpand(item.id)}
                                >
                                  {expandedCaptions.has(item.id) ? 'Ocultar ▲' : 'Ver / editar ▼'}
                                </button>
                              )}
                            </div>

                            {/* Captions (expanded) */}
                            {item.captionsGenerated && expandedCaptions.has(item.id) && (
                              <div style={{marginTop:14, display:'flex', flexDirection:'column', gap:12}}>
                                <div className="divider"/>
                                {captionPlat.filter(p => item.platforms.includes(p)).map((p, pi) => {
                                  const key = captionKeys[captionPlat.indexOf(p)]
                                  const platNames: Record<string, string> = {IG:'Instagram',FB:'Facebook',LI:'LinkedIn',GMB:'Google My Business'}
                                  const isRejected = item.rejectedCopies.has(key)
                                  return (
                                    <div key={p} style={{opacity: isRejected ? 0.6 : 1, transition: 'opacity 0.2s'}}>
                                      <div style={{display:'flex', gap:6, marginBottom:5, alignItems:'center', flexWrap:'wrap'}}>
                                        <span className={platClass(p)} style={{fontSize:10}}>{p}</span>
                                        <span style={{fontSize:11, color:'var(--text3)'}}>{platNames[p]}</span>
                                        <span style={{fontSize:10, color:'var(--text3)', marginLeft:'auto'}}>
                                          {item.captions[key].length} car.
                                        </span>
                                        <button
                                          onClick={() => toggleCopyRejection(item.id, key)}
                                          style={{
                                            background: isRejected ? 'rgba(239,68,68,0.2)' : 'var(--surface2)',
                                            border: `1px solid ${isRejected ? '#ef4444' : 'var(--border)'}`,
                                            color: isRejected ? '#ef4444' : 'var(--text2)',
                                            padding: '2px 8px',
                                            borderRadius: 'var(--r-sm)',
                                            fontSize: 10,
                                            cursor: 'pointer',
                                            fontWeight: isRejected ? 600 : 400,
                                            transition: 'all 0.2s',
                                          }}
                                        >
                                          {isRejected ? '❌ Rechazado' : '✓ Enviar'}
                                        </button>
                                      </div>
                                      <textarea
                                        value={item.captions[key]}
                                        onChange={e => updateCaption(item.id, key, e.target.value)}
                                        disabled={isRejected}
                                        style={{...inputStyle, minHeight: p === 'IG' ? 120 : 80, resize:'vertical', background: isRejected ? 'var(--surface2)' : 'var(--surface)', lineHeight:1.55, fontSize:11, opacity: isRejected ? 0.6 : 1}}
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                          </div>
                        ))}
                      </div>

                      {/* Error detail panel */}
                      {quickError && (
                        <div style={{marginTop:12, padding:'12px 14px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'var(--r-sm)', fontSize:12, color:'var(--red,#ef4444)', whiteSpace:'pre-wrap', wordBreak:'break-all'}}>
                          <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                            <strong>Error GHL</strong>
                            <button onClick={() => setQuickError('')} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',fontSize:14,padding:0}}>✕</button>
                          </div>
                          {quickError}
                        </div>
                      )}

                      {/* Action bar */}
                      <div className="card" style={{marginTop:20, position:'sticky', bottom:16, zIndex:10}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
                          <div style={{fontSize:13, color:'var(--text2)'}}>
                            <strong style={{color:'var(--text)'}}>{manualItems.length}</strong> items ·{' '}
                            <strong style={{color:'var(--text)'}}>{manualItems.filter(i => i.captionsGenerated).length}</strong> con descripción ·{' '}
                            <strong style={{color:'var(--text3)'}}>{
                              manualItems.reduce((sum, i) => sum + i.rejectedCopies.size, 0)
                            }</strong> copys rechazados ·{' '}
                            <strong style={{color:'var(--teal)'}}>{readyCount}</strong> listos para GHL
                          </div>
                          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                            <button className="btn btn-sm" onClick={addManualItem}>+ Contenido</button>
                            <button
                              className="btn btn-success"
                              disabled={sendingQuick || readyCount === 0}
                              onClick={sendAllQuickToGHL}
                            >
                              {sendingQuick ? `Enviando... ${quickProgress}%` : `Enviar ${readyCount} a GHL →`}
                            </button>
                          </div>
                        </div>
                        {sendingQuick && (
                          <div style={{marginTop:10}}>
                            <div className="progress-track">
                              <div className="progress-fill" style={{width:`${quickProgress}%`, transition:'width .4s'}}/>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

            {/* === GENERADOR DE ADS === */}
            {phase === 'ads' && (
              <div>
                <div className="card" style={{marginBottom:16}}>
                  <div className="card-header">
                    <div>
                      <div className="card-title">🎯 Generador de Anuncios</div>
                      <div className="card-sub">Sube una imagen, describe tu idea y Claude genera 3 variaciones de copy para paid social</div>
                    </div>
                  </div>

                  <div className="grid-2" style={{gap:20}}>
                    {/* COLUMNA IZQUIERDA — Upload + Configuración */}
                    <div>
                      {/* Upload imagen */}
                      <div style={{marginBottom:14}}>
                        <div className="section-label" style={{marginBottom:8}}>IMAGEN DEL ANUNCIO</div>
                        <label style={{
                          display:'block', border:`2px dashed ${adImage ? 'var(--purple-text)' : 'var(--border2)'}`,
                          borderRadius:'var(--r)', cursor:'pointer', overflow:'hidden',
                          background:'var(--surface2)', transition:'border-color .15s',
                        }}>
                          {adImage ? (
                            <img src={adImage.preview} alt="Ad" style={{width:'100%',aspectRatio:'1/1',objectFit:'cover',display:'block'}}/>
                          ) : (
                            <div style={{padding:'40px 20px',textAlign:'center',color:'var(--text3)'}}>
                              <div style={{fontSize:28,marginBottom:8}}>🖼</div>
                              <div style={{fontSize:13}}>Click para subir imagen</div>
                              <div style={{fontSize:11,marginTop:4}}>JPG, PNG, WEBP</div>
                            </div>
                          )}
                          <input type="file" accept="image/*" onChange={handleAdImageSelect} style={{display:'none'}}/>
                        </label>
                      </div>

                      {/* Proyecto */}
                      <div style={{marginBottom:12}}>
                        <div className="section-label" style={{marginBottom:6}}>PROYECTO</div>
                        <div style={{display:'flex',gap:6}}>
                          {['KASA','Arko','Aria','Noriega Group'].map(p => (
                            <button key={p} onClick={() => setAdProject(p)}
                              className={`btn btn-sm ${adProject === p ? 'btn-primary' : ''}`}>
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Idea */}
                      <div style={{marginBottom:14}}>
                        <div className="section-label" style={{marginBottom:6}}>IDEA A TRANSMITIR</div>
                        <textarea
                          value={adIdea}
                          onChange={e => setAdIdea(e.target.value)}
                          placeholder="Ej: Mostrar que KASA es la mejor inversión para renta corta en Punta Cana, destacando el retorno y la ubicación..."
                          rows={4}
                          style={{width:'100%',padding:'9px 12px',resize:'vertical',lineHeight:1.5}}
                        />
                      </div>

                      <button className="btn btn-primary btn-block" onClick={generateAdVariations}
                        disabled={adLoading || !adImage || !adIdea.trim()}>
                        {adLoading ? '⏳ Analizando imagen y generando...' : '✨ Generar 3 variaciones de copy'}
                      </button>
                    </div>

                    {/* COLUMNA DERECHA — Variaciones */}
                    <div>
                      {adLoading && (
                        <div className="loading-state" style={{padding:'40px 0'}}>
                          <div className="spinner"/>
                          <div className="loading-text">Claude Vision analizando la imagen...</div>
                        </div>
                      )}

                      {!adLoading && adVariations.length === 0 && (
                        <div style={{padding:'40px 20px',textAlign:'center',color:'var(--text3)',border:'1px dashed var(--border)',borderRadius:'var(--r)'}}>
                          <div style={{fontSize:32,marginBottom:8}}>🎨</div>
                          <div style={{fontSize:13}}>Las 3 variaciones aparecerán aquí</div>
                        </div>
                      )}

                      {adVariations.map((v: any, i: number) => (
                        <div key={v.id}
                          className={`ad-card${adSelected === i ? ' selected' : ''}`}
                          onClick={() => setAdSelected(i)}
                          style={{marginBottom:12}}>
                          <div className="ad-preview">
                            {adImage && <img src={adImage.preview} alt=""/>}
                            <div className={`ad-overlay ${v.overlay === 'top' ? 'top' : v.overlay === 'center' ? 'center' : ''}`}>
                              <div className="ad-hook">{v.hook}</div>
                              <div className="ad-headline">{v.headline}</div>
                            </div>
                            <div style={{position:'absolute',top:8,right:8,background:'rgba(0,0,0,.6)',color:'#fff',fontSize:10,padding:'2px 7px',borderRadius:3,fontFamily:'var(--mono)'}}>
                              V{v.id}
                            </div>
                            {adSelected === i && (
                              <div style={{position:'absolute',top:8,left:8,background:'var(--purple-text)',color:'#fff',fontSize:10,padding:'2px 7px',borderRadius:3,fontFamily:'var(--mono)'}}>
                                ✓ seleccionado
                              </div>
                            )}
                          </div>
                          <div className="ad-body-text">
                            <div className="ad-body-copy">{v.body}</div>
                            <div className="ad-cta-btn">{v.cta}</div>
                            <div className="ad-rationale">{v.rationale}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PANEL DE ENVÍO A GHL */}
                {adSelected !== null && adVariations.length > 0 && (
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="card-title">Programar en GHL</div>
                        <div className="card-sub">Variación {adSelected + 1} seleccionada — "{adVariations[adSelected]?.hook}"</div>
                      </div>
                    </div>

                    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:14,alignItems:'flex-end'}}>
                      {/* Plataformas */}
                      <div>
                        <div className="section-label" style={{marginBottom:6}}>PLATAFORMAS</div>
                        <div style={{display:'flex',gap:6}}>
                          {['IG','FB','LI'].map(p => (
                            <button key={p} onClick={() => setAdPlatforms(prev =>
                              prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                            )} className={`btn btn-sm ${adPlatforms.includes(p) ? 'btn-primary' : ''}`}>
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Fecha */}
                      <div>
                        <div className="section-label" style={{marginBottom:6}}>FECHA</div>
                        <input type="date" value={adDate} onChange={e => setAdDate(e.target.value)}
                          style={{padding:'6px 10px'}}/>
                      </div>

                      {/* Hora */}
                      <div>
                        <div className="section-label" style={{marginBottom:6}}>HORA</div>
                        <input type="time" value={adTime} onChange={e => setAdTime(e.target.value)}
                          style={{padding:'6px 10px'}}/>
                      </div>

                      <button className="btn btn-success" onClick={sendAdToGHL} disabled={adSending || !adDate}>
                        {adSending ? '⏳ Enviando...' : '🚀 Programar en GHL'}
                      </button>
                    </div>

                    {/* Preview del copy completo */}
                    <div style={{background:'var(--surface2)',borderRadius:'var(--r-sm)',padding:'12px 14px',border:'1px solid var(--border)'}}>
                      <div className="section-label" style={{marginBottom:6}}>COPY QUE SE ENVIARÁ</div>
                      <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>
                        {adVariations[adSelected]?.hook}{'\n'}{adVariations[adSelected]?.headline}{'\n\n'}{adVariations[adSelected]?.body}{'\n\n'}{adVariations[adSelected]?.cta}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  )
}
