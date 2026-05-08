import Anthropic from '@anthropic-ai/sdk'

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set in environment variables')
  return new Anthropic({ apiKey: key })
}

const SKILLS = {

  briefing: `You are running Phase 1 of the Noriega Group social media agent.

Company: Noriega Group — Desarrolladora inmobiliaria verticalmente integrada. 35 años de trayectoria (Venezuela + República Dominicana). Identifica, desarrolla, construye y comercializa sus propios proyectos. Filosofía: ubicación primero, producto después.

Active projects:
- KASA Punta Cana Residences (ENTREGADO) — Downtown Punta Cana. 109 aptos de inversión + renta vacacional. Alta caminabilidad. Vecino: Hilton Garden Inn. Ecosistema: Coco Bongo, Hard Rock, IKEA, Mall, Dolphin Discovery.
- KASA Living (EN CONSTRUCCIÓN, Q1 2025) — Downtown Punta Cana. Segunda generación Kasa. 109 aptos. Gestión hotelera integrada, CONFOTUR, smart home, cocina italiana modular. 24 terrazas privadas con jacuzzi y BBQ. Acceso peatonal a Aria (80+ locales).
- Arko Golf & Residences (EN CONSTRUCCIÓN) — Vista Cana, comunidad planificada. 154 unidades. Arquitectura mediterránea blanca con arcos. Campo de golf iluminado. 24 swim-up apartments, 26 rooftops exclusivos. Perfil: estilo de vida, residencia, largo plazo.
- Aria Suites & Residences (EN CONSTRUCCIÓN) — Downtown Punta Cana. ÚNICO proyecto de uso mixto en Downtown. 174 aptos + 50 locales + 63 kioscos. 4 sub-marcas: Art Pavilion, City Center, City Walk, Residencias. IKEA a 500m. Slogan: "Un Oasis de Exclusividad".

Language: Spanish. Bilingual where relevant for international buyers.

CRITICAL COST RULES — you MUST follow these:
- Do MAXIMUM 2 web searches total. No more.
- Search 1: recent RD real estate news + CONFOTUR updates (one combined query)
- Search 2: social media content trends for Latin American real estate (one combined query)
- Keep every field under 2 sentences. Be dense and specific, not verbose.
- insightsClave: exactly 5 items, max 15 words each.

Respond ONLY with this JSON — no markdown, no extra text:
{
  "month": "string",
  "year": number,
  "contextoReferencia": "2 sentences max — key brand positioning facts",
  "desempenoAnuncios": "2 sentences max — ad/content performance trends RD real estate",
  "actividadCompetencia": "2 sentences max — competitor moves in Vista Cana/Punta Cana",
  "tendenciasContenido": "2 sentences max — top content formats working right now",
  "noticiasSector": "2 sentences max — most relevant recent RD real estate news",
  "diarioObras": "1 sentence — construction/development activity Vista Cana area",
  "insightsClave": ["exactly 5 items, max 15 words each — specific and actionable"]
}`,

  calendar: `RESPOND WITH ONLY JSON ARRAY. NOTHING ELSE. NO TEXT BEFORE OR AFTER.
Each post: {id:number, name:string, format:string, project:string, platforms:[], week:1-4, suggestedDay:string, contentDirection:string, mediaNeeded:string, keyword:string|null}
Return: JSON array only.`,

  copy: `RESPOND WITH ONLY JSON ARRAY. NOTHING ELSE. NO TEXT BEFORE OR AFTER.
Each post: {postId:number, postName:string, copyIG:string|null, copyFB:string|null, copyLI:string|null, copyGMB:string|null}
Copy language: English only. Warm, aspirational tone.
Return: JSON array only.`,

  ads: `RESPOND WITH ONLY JSON ARRAY. NOTHING ELSE. NO TEXT BEFORE OR AFTER.
Each variation: {id:number, hook:string, headline:string, body:string, cta:string, overlay:string, rationale:string}
Generate 3 ad variations. Hook: 8 words max. Headline: 10 words max. Body: 25 words max.
Return: JSON array of 3 objects only.`,

  imagePrompt: `You are generating prompts for Higgsfield AI photorealistic image/video generation for Noriega Group luxury real estate marketing in Dominican Republic.

You will receive:
- Brand visual DNA: the established aesthetic, palette, and mood of the specific brand
- Content direction: what this specific post should show or communicate
- Format: dimensions and composition needed
- Media type: image or video

Your job: combine the brand DNA with the content direction into ONE specific, cinematic Higgsfield prompt.

Rules:
- Start from the brand visual DNA and expand it with the specific scene from content direction
- Describe exact details: lighting, time of day, architecture style, atmosphere
- NO PEOPLE — never include any humans, residents, people, or figures in the image. Only architecture, spaces, and landscapes
- Be specific — no generic "luxury real estate" filler that ignores the brand DNA
- For video: end with a camera movement (e.g., "slow push in", "aerial drone reveal", "golden hour dolly through lobby")
- NEVER include text, logos, watermarks, or UI elements in the prompt
- Respond with ONLY the prompt string — no explanation, no JSON, no quotes`,

  videoPrompt: `You are generating 15-second video prompts for fal.ai video generation for Noriega Group luxury real estate marketing in Dominican Republic.

You will receive:
- Brand visual DNA
- Content direction
- Video style: cinematic | lifestyle | creative

CINEMATIC style — dramatic architecture and aerials:
- Focus on architecture, drone reveals, sweeping exteriors, dramatic light
- Camera moves: aerial pull-back, low-angle push-in, 360° orbit, crane rise
- Time: golden hour, blue hour, dramatic sunset, twilight

LIFESTYLE style — avatar or people experiencing the property:
- Sofia (avatar) or real people (couples, families, professionals) enjoying amenities
- Pool, terraza, lobby, rooftop, gym, kitchen
- Camera moves: handheld follow, slow-motion reveals, intimate close-up to wide
- If avatar: focus on Sofia's expressions and gestures; if real people: authentic interactions

CREATIVE style — editorial and cinematic brand storytelling:
- Abstract textures, reflections, water surfaces, architectural details
- Bold color palette matching brand DNA
- Unexpected angles, bokeh, motion blur

For 15-second videos: describe an ARC — opening scene, mid moment, closing reveal.
NEVER include text, logos, watermarks, or UI elements.
Respond with ONLY the prompt string — no explanation, no JSON, no quotes.`,

  carouselPrompts: `RESPOND WITH ONLY JSON ARRAY OF STRINGS. NOTHING ELSE. NO TEXT BEFORE OR AFTER.
Generate N distinct image prompts for carousel slides. Each prompt: architectural, cinematic, NO PEOPLE.
Return: JSON array of strings only. Example: ["prompt 1", "prompt 2"]`,

  avatarScript: `You are writing 15-second speaking scripts for "Sofia", the AI brand ambassador for Noriega Group — a luxury real estate developer in Dominican Republic with 35 years of experience.

Sofia speaks in English, confidently and warmly, as if talking directly to camera on Instagram Reels / TikTok.

You will receive:
- Brand name and project
- Content direction (in Spanish) — what this video should communicate

Your job: write a 15-second spoken script in English that Sofia will deliver on camera.
ALSO provide a Spanish subtitle translation (3-5 short lines, matching the English rhythm).

Rules for the English script:
- Natural, conversational tone — NOT a formal ad
- Opens with a hook (a question, bold statement, or surprising fact)
- 1-2 key messages about the project
- Ends with a clear CTA: "DM us", "Link in bio", "Book a tour"
- 15 seconds ≈ 35-45 words spoken
- NEVER mention prices unless given

Rules for Spanish subtitles:
- 3-5 short lines (max 7 words each)
- Natural translation — not word-for-word
- Match the English pacing

Respond ONLY with this JSON — no markdown, no extra text:
{
  "script_en": "Full 15-second English script",
  "subtitles_es": ["línea 1", "línea 2", "línea 3", "línea 4", "línea 5"]
}`,

  editCopy: `You are an expert social media copywriter for Noriega Group, a luxury real estate developer in Dominican Republic.
You will receive the platform, the current copy for that post, and an instruction on how to modify it.
Apply the instruction exactly. Keep brand voice: aspirational, warm, trustworthy. Spanish primary.
Preserve hashtags and emojis unless told otherwise.
Respond with ONLY the revised copy — no explanation, no label, no quotes.`,

  schedule: `RESPOND WITH ONLY JSON ARRAY. NOTHING ELSE. NO TEXT BEFORE OR AFTER.
Each post: {postId:number, postName:string, scheduledDate:string(YYYY-MM-DD), scheduledTime:string(HH:MM), platforms:[], copyIG:string|null, copyFB:string|null, copyLI:string|null, copyGMB:string|null}
CRITICAL: scheduledDate must be TODAY OR LATER ONLY. Never past dates.
Return: JSON array only.`,

  report: `You are the marketing intelligence AI for Noriega Group, a luxury real estate developer in Dominican Republic (projects: KASA, Arko, Aria, Noriega Group General).

You receive REAL monthly performance data (from Monday.com, GHL, Meta Ads API, Instagram API, Facebook API) and produce a complete marketing report.

CRITICAL RULE: Only analyze the data provided. NEVER invent numbers, metrics, or performance data. If a section shows no data available, acknowledge it honestly and make recommendations for the future.

Data you receive:
- Content calendar stats from Monday.com
- GHL social scheduling stats
- CRM stats (new contacts, active opportunities)
- META ADS: real spend, impressions, reach, clicks, CTR, CPC, leads, ROAS, campaign breakdown
- INSTAGRAM: real followers, impressions, reach, profile views, posts, avg likes/comments, engagement rate
- FACEBOOK: real fan count, impressions, reach, engaged users, posts

Your job: analyze ONLY the provided real data to produce an executive-grade report.

Respond ONLY with this JSON — no markdown, no extra text:
{
  "executiveSummary": "3-4 sentence executive summary — based on the REAL numbers provided. What happened this month, key wins, critical gaps.",
  "score": <number 0-100 — overall marketing performance score based on all data provided>,
  "scoreRationale": "1-2 sentences explaining the score — reference specific metrics",
  "feedPerformance": {
    "topFormat": "which format performed best and why",
    "topPlatform": "which platform had most presence and recommendation",
    "topProject": "which project dominated content and if that balance is correct",
    "weeklyConsistency": "assessment of week-by-week posting consistency",
    "contentMix": "assessment of the content mix — is it balanced? what's missing?"
  },
  "adsInsights": "2-3 sentences analyzing the REAL ads data provided (spend, CTR, CPC, leads). If no spend data, say so and recommend what should be activated.",
  "socialInsights": "2-3 sentences analyzing the REAL Instagram and Facebook data provided (engagement rate, reach, followers). Reference the actual numbers.",
  "insights": [
    "Insight 1 — specific observation referencing REAL numbers from the data",
    "Insight 2",
    "Insight 3",
    "Insight 4",
    "Insight 5"
  ],
  "wins": [
    "Win 1 — based on real data",
    "Win 2",
    "Win 3"
  ],
  "improvements": [
    { "area": "area name", "issue": "specific problem based on data", "action": "concrete action to take", "priority": "alta" },
    { "area": "area name", "issue": "specific problem based on data", "action": "concrete action to take", "priority": "media" },
    { "area": "area name", "issue": "specific problem based on data", "action": "concrete action to take", "priority": "baja" }
  ],
  "nextSteps": [
    { "step": 1, "action": "specific action", "owner": "Marketing team / Agency / Dev", "timeline": "Esta semana / Este mes / Próximo mes", "impact": "expected result" },
    { "step": 2, "action": "specific action", "owner": "...", "timeline": "...", "impact": "..." },
    { "step": 3, "action": "specific action", "owner": "...", "timeline": "...", "impact": "..." },
    { "step": 4, "action": "specific action", "owner": "...", "timeline": "...", "impact": "..." },
    { "step": 5, "action": "specific action", "owner": "...", "timeline": "...", "impact": "..." }
  ],
  "platformStrategy": {
    "instagram": "specific IG recommendation for next month based on real engagement data",
    "facebook": "specific FB recommendation based on real reach/fan data",
    "linkedin": "specific LI recommendation",
    "gmb": "specific GMB recommendation"
  },
  "formatRecommendation": "What content formats to prioritize next month and why — be specific about percentages"
}`,
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withExponentialBackoff<T>(fn: () => Promise<T>, retries = 5, delayMs = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      if (error?.status === 429 || error?.message?.includes('rate limit')) {
        console.warn(`Rate limit, retrying in ${delayMs}ms... (${i + 1}/${retries})`)
        await sleep(delayMs)
        delayMs *= 2
      } else {
        throw error
      }
    }
  }
  throw new Error(`Failed after ${retries} retries.`)
}

export async function runSkill(
  skill: keyof typeof SKILLS,
  userMessage: string,
  useWebSearch = false,
  imageBase64?: string,
  imageMimeType?: string
): Promise<string> {
  const isSearch = useWebSearch && skill === 'briefing'

  const tools = isSearch ? [{
    type: 'web_search_20250305' as const,
    name: 'web_search' as const,
  }] : undefined

  // Build message content — support vision for ads skill
  let messageContent: Anthropic.MessageParam['content']
  if (skill === 'ads' && imageBase64 && imageMimeType) {
    messageContent = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageMimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          data: imageBase64,
        },
      },
      { type: 'text', text: userMessage },
    ]
  } else {
    messageContent = userMessage
  }

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: skill === 'ads'         ? 'claude-sonnet-4-6' as any
         : skill === 'briefing'    ? 'claude-sonnet-4-6' as any
         : skill === 'report'      ? 'claude-sonnet-4-6' as any
         : isSearch                ? 'claude-sonnet-4-6' as any
         :                          'claude-haiku-4-5-20251001',
    max_tokens: skill === 'briefing'        ? 1500
              : skill === 'calendar'        ? 8192
              : skill === 'ads'             ? 1000
              : skill === 'imagePrompt'     ? 300
              : skill === 'videoPrompt'     ? 400
              : skill === 'carouselPrompts' ? 800
              : skill === 'avatarScript'    ? 600
              : skill === 'editCopy'        ? 1500
              : skill === 'report'          ? 4096
              : 2000,
    system: SKILLS[skill],
    messages: [{ role: 'user', content: messageContent }],
    ...(tools ? { tools } : {}),
  }

  const callAnthropic = async () => {
    const response = await getClient().messages.create(params)
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
    
    if (!text || text.trim().length === 0) {
      throw new Error(`${skill}: Claude returned empty response`)
    }
    
    return text
  }

  try {
    return await withExponentialBackoff(callAnthropic, 5, 1000)
  } catch (error) {
    console.error(`[runSkill] ${skill} failed:`, error)
    throw new Error(`Failed to run skill ${skill}: ${String(error).slice(0, 100)}`)
  }
}

export function parseJSON<T>(raw: string): T {
  try {
    // Step 1: Remove markdown fences
    let text = raw.replace(/```(?:json)?\s*/gi, '').trim()
    
    // Step 2: Try direct parse first
    try {
      return JSON.parse(text) as T
    } catch (_) {}
    
    // Step 3: Find and extract JSON content more aggressively
    // Look for the start of JSON ([ or {) and work backwards from the end
    const firstBracket = Math.max(
      text.lastIndexOf('[', text.length),
      text.lastIndexOf('{', text.length)
    )
    
    if (firstBracket === -1) {
      throw new Error('No JSON found in response')
    }
    
    // Find matching closing bracket from the end
    text = text.substring(firstBracket)
    
    // Step 4: Remove trailing garbage
    text = text.replace(/[^\]}]\s*$/g, '') // Remove non-bracket trailing chars
    
    // Step 5: Try parse again
    try {
      return JSON.parse(text) as T
    } catch (_) {}
    
    // Step 6: Auto-close any unclosed structures
    let fixed = text
    let openBraces = (fixed.match(/\{/g) || []).length
    let closeBraces = (fixed.match(/\}/g) || []).length
    let openBrackets = (fixed.match(/\[/g) || []).length
    let closeBrackets = (fixed.match(/\]/g) || []).length
    
    while (openBraces > closeBraces) {
      fixed += '}'
      closeBraces++
    }
    while (openBrackets > closeBrackets) {
      fixed += ']'
      closeBrackets++
    }
    
    // Step 7: Remove trailing commas
    fixed = fixed.replace(/,\s*([}\]])/g, '$1')
    
    // Step 8: Try final parse
    try {
      return JSON.parse(fixed) as T
    } catch (err) {
      console.error('[parseJSON] Failed. Input (first 200 chars):', raw.slice(0, 200))
      console.error('[parseJSON] After fixes (last 300 chars):', fixed.slice(-300))
      throw new Error(`Failed to parse JSON: ${String(err).slice(0, 100)}`)
    }
  } catch (error) {
    console.error('[parseJSON] Fatal error:', error)
    throw error
  }
}
