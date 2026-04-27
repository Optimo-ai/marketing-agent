# Noriega Group — Agente de Redes Sociales

Dashboard para gestionar el pipeline mensual de contenido en redes sociales.

## Setup en 5 minutos

### 1. Instala dependencias
```bash
npm install
```

### 2. Crea tu archivo de variables de entorno
```bash
cp .env.example .env.local
```

Abre `.env.local` y pega tus keys:

```env
ANTHROPIC_API_KEY=sk-ant-...
MONDAY_API_KEY=eyJhbGci...
MONDAY_WORKSPACE_ID=        # Número — lo ves en la URL de Monday al abrir tu workspace
GHL_API_KEY=pit-...
GHL_LOCATION_ID=61SJ07b3I1IFjvlP5TE3
NEXTAUTH_SECRET=cualquier_string_aleatorio_largo
NEXTAUTH_URL=http://localhost:3000
```

### 3. Corre en desarrollo
```bash
npm run dev
```

Abre http://localhost:3000

### 4. Deploy en Vercel
```bash
# Instala Vercel CLI si no lo tienes
npm i -g vercel

# Deploy
vercel

# En Vercel dashboard → Settings → Environment Variables
# Agrega todas las variables de .env.local
```

---

## Dónde encontrar cada key

| Variable | Dónde |
|---|---|
| ANTHROPIC_API_KEY | console.anthropic.com → API Keys |
| MONDAY_API_KEY | Monday.com → tu perfil (arriba derecha) → Administration → API → Personal API Token |
| MONDAY_WORKSPACE_ID | Entra a tu workspace de Marketing en Monday → mira la URL: `monday.com/workspaces/ESTE_NUMERO` |
| GHL_API_KEY | GoHighLevel → Settings → Integrations → API Keys → Private Integrations |
| GHL_LOCATION_ID | GoHighLevel → Settings → Business Info → al final de la página |

---

## Estructura del proyecto

```
src/
  app/
    page.tsx              ← Dashboard principal (todas las fases)
    layout.tsx
    globals.css
    api/
      briefing/route.ts   ← Fase 1: genera y guarda briefing
      calendar/route.ts   ← Fase 2: genera calendario y sube a Monday
      copy/route.ts       ← Fase 4: genera copy por plataforma
      schedule/route.ts   ← Fase 5: genera horarios y envía a GHL
      reports/route.ts    ← Reportes mensuales
      status/route.ts     ← Verifica conexiones de APIs
  lib/
    claude.ts             ← Cliente Anthropic con skills como system prompts
    monday.ts             ← Cliente Monday.com GraphQL
    ghl.ts                ← Cliente GoHighLevel REST API
```

---

## Flujo de uso

1. **Abre el dashboard** → verifica que las 3 integraciones estén en verde
2. **Fase 1** → click "Generar Briefing" → Claude busca tendencias del mercado → aprueba
3. **Fase 2** → click "Generar Calendario" → revisa los posts (✓/✕) → aprueba → sube a Monday
4. **Fase 3** → Diseños en Canva (manual o via Canva MCP cuando esté configurado)
5. **Fase 4** → click "Generar Copy" → revisa por post → aprueba → guarda en Monday
6. **Fase 5** → click "Generar Horarios" → revisa → "Enviar a GHL" → listo

---

## Notas importantes

- **MONDAY_WORKSPACE_ID**: necesitas crear manualmente el board `Calendario de Contenido Mayo 2025` en tu workspace de Marketing antes de aprobar el calendario. Monday API no permite crear boards desde la API con plan básico.
- **GHL Social Planner**: asegúrate de tener conectadas las cuentas de IG/FB/LinkedIn/GMB en GHL antes de enviar posts.
- **Lead Magnet PDFs**: antes de la Fase 5, sube los PDFs de las guías a GHL → Media Storage para que las automatizaciones los puedan enviar.
