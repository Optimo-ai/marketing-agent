import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Noriega Group — Agente de Redes',
  description: 'Pipeline de contenido mensual para redes sociales',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --bg: #f8fafc !important;
            --surface: #ffffff !important;
            --surface2: #f1f5f9 !important;
            --border: #e2e8f0 !important;
            --border2: #cbd5e1 !important;
            --text: #0f172a !important;
            --text2: #334155 !important;
            --text3: #64748b !important;
            --teal: #0d9488 !important;
            --red: #dc2626 !important;
            --purple: #7e22ce !important;
            --purple-text: #7e22ce !important;
          }
          body {
            background-color: var(--bg) !important;
            color: var(--text) !important;
          }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  )
}
