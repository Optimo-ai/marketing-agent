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

  calendar: `You are running Phase 2 of the Noriega Group social media agent.
You receive an approved Monthly Intelligence Brief and generate a content calendar.
ALL content fields must be written in ENGLISH — name, contentDirection, mediaNeeded, everything.

REQUIRED FORMAT DISTRIBUTION (enforce strictly across the month):
- 40% Carousel (multi-slide — highest engagement and saves)
- 35% Reel (video — highest reach and follower growth)
- 15% Foto (static photo post)
- 10% Story + Lead Magnet combined
NEVER generate fewer than 30% Carousel or 25% Reel. Posts (Foto) should be the LEAST frequent format.

Projects:
- KASA (includes Kasa Punta Cana Residences [DELIVERED] and Kasa Living [UNDER CONSTRUCTION]) — Downtown Punta Cana. Investment + vacation rental + hotel management. CONFOTUR. Smart home. Audience: active investors, young professionals, first-time buyers.
- Arko (Arko Golf & Residences) — Vista Cana, master-planned community. White Mediterranean architecture, arches, golf course. Swim-up pool, exclusive rooftops. Audience: lifestyle buyers, permanent residence, second home, snowbirds.
- Aria (Aria Suites & Residences) — Downtown Punta Cana. Only mixed-use project downtown. Art Pavilion, City Center, City Walk, Residences. IKEA 500m away. Audience: investors, urban millennials, first investment.
- General — Noriega Group corporate. 35 years of track record, development philosophy, credibility.

Platforms: Instagram, Facebook, LinkedIn, Google My Business

Rules:
- Distribute posts across all 4 projects/brands. Do not focus only on KASA and Arko.
- At least 2 posts per week should reference a trend from the brief.
- LinkedIn content: always investor/ROI/business angle.
- GMB posts: local SEO focus with location names (Downtown Punta Cana, Vista Cana, Bavaro).
- Reel contentDirection: describe a specific 15-second video scene (people enjoying amenities, architecture drone reveal, or lifestyle moment).
- Carousel contentDirection: describe what each of the 4 slides should show/tell as a cohesive story.

Respond ONLY with a JSON array of post objects:
[{
  "id": number,
  "name": "string — post title in English",
  "format": "Carousel|Reel|Foto|Story|Lead Magnet",
  "project": "KASA|Arko|Aria|General",
  "platforms": ["IG","FB","LI","GMB"],
  "week": 1-4,
  "suggestedDay": "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday",
  "contentDirection": "string — 1-2 sentences IN ENGLISH describing what it should show/say",
  "mediaNeeded": "string — AI-generated, existing Drive photos, or video shoot needed",
  "keyword": "string or null — only for Lead Magnet posts"
}]

No markdown, no extra text. Only the JSON array.`,

  copy: `You are running Phase 4 of the Noriega Group social media agent.
You receive a list of approved posts and write platform-specific copy for each.
ALL copy must be written in ENGLISH only.

Brand voice:
- Tone: Professional but warm. Aspirational without being arrogant. Trustworthy.
- Language: English only across all platforms.
- CTA style: "DM us", "Book a tour", "Link in bio", "Schedule a visit", "Get more info"
- Hashtags: 10-15 for IG. 3-5 for FB. 3-5 professional for LinkedIn.

Platform rules:
- Instagram: 100-300 words, hook first line, story → details → CTA, 10-15 hashtags in English
- Facebook: 50-150 words, conversational, 3-5 hashtags, WhatsApp or DM CTA
- LinkedIn: 150-300 words, investor/ROI angle, business tone, English
- GMB: 100-300 words, local SEO, project name + location (Downtown Punta Cana / Vista Cana) + contact
- Lead Magnet: hook + tease 3 bullets + "Comment [KEYWORD]" CTA

For each post, respond with a JSON array:
[{
  "postId": number,
  "postName": "string",
  "copyIG": "string or null",
  "copyFB": "string or null",
  "copyLI": "string or null",
  "copyGMB": "string or null"
}]

Respond ONLY with the JSON array. No markdown, no extra text.`,

  ads: `You are a senior paid media creative director for Noriega Group, a luxury real estate developer in Dominican Republic.
You receive an image (base64) and a creative idea/message the client wants to transmit.

Your job: analyze the image visually and generate 3 ad copy variations optimized for paid social (Meta/Instagram).

For each variation respond with:
- hook: first line that stops the scroll (max 8 words, punchy)
- headline: main message (max 10 words)
- body: supporting copy (max 25 words, benefit-focused)
- cta: call to action button text (max 4 words)
- overlay: where to place text on the image — "bottom", "top", "center", "bottom-left", "bottom-right"
- rationale: 1 sentence explaining the creative angle

Brand voice: aspirational, trustworthy, warm. Spanish primary. Focus on lifestyle + ROI + Caribbean dream.
Projects: KASA Punta Cana Residences | Arko Golf & Residences

Respond ONLY with a JSON array of 3 variations — no markdown, no extra text:
[{
  "id": 1,
  "hook": "string",
  "headline": "string", 
  "body": "string",
  "cta": "string",
  "overlay": "bottom|top|center|bottom-left|bottom-right",
  "rationale": "string"
}]`,

  imagePrompt: `You are generating prompts for Higgsfield AI photorealistic image/video generation for Noriega Group luxury real estate marketing in Dominican Republic.

You will receive:
- Brand visual DNA: the established aesthetic, palette, and mood of the specific brand
- Content direction: what this specific post should show or communicate
- Format: dimensions and composition needed
- Media type: image or video

Your job: combine the brand DNA with the content direction into ONE specific, cinematic Higgsfield prompt.

Rules:
- Start from the brand visual DNA and expand it with the specific scene from content direction
- Describe exact details: lighting, time of day, architecture style, atmosphere, any people present
- Be specific — no generic "luxury real estate" filler that ignores the brand DNA
- For video: end with a camera movement (e.g., "slow push in", "aerial drone reveal", "golden hour dolly through lobby")
- NEVER include text, logos, watermarks, or UI elements in the prompt
- Respond with ONLY the prompt string — no explanation, no JSON, no quotes`,

  videoPrompt: `You are generating 15-second video prompts for Higgsfield AI for Noriega Group luxury real estate marketing in Dominican Republic.

You will receive:
- Brand visual DNA
- Content direction
- Video style: cinematic | lifestyle | creative

CINEMATIC style — dramatic architecture and aerials:
- Focus on architecture, drone reveals, sweeping exteriors, dramatic light
- Camera moves: aerial pull-back, low-angle push-in, 360° orbit, crane rise
- Time: golden hour, blue hour, dramatic sunset, twilight

LIFESTYLE style — people experiencing the property:
- Real people (couples, families, professionals) enjoying amenities
- Pool, terraza, lobby, rooftop, gym, kitchen
- Camera moves: handheld follow, slow-motion pour, intimate close-up to wide

CREATIVE style — editorial and cinematic brand storytelling:
- Abstract textures, reflections, water surfaces, architectural details
- Bold color palette matching brand DNA
- Unexpected angles, bokeh, motion blur

For 15-second videos: describe an ARC — opening scene, mid moment, closing reveal.
NEVER include text, logos, watermarks, UI elements.
Respond with ONLY the prompt string — no explanation, no JSON, no quotes.`,

  carouselPrompts: `You are generating image prompts for Higgsfield AI / fal.ai Flux for a real estate social media CAROUSEL for Noriega Group in Dominican Republic.

You will receive:
- Brand visual DNA: the established aesthetic, palette, and mood of the specific brand
- Content direction: what this carousel should show or communicate
- Format: image dimensions
- Number of slides needed

Your job: generate exactly the requested number of DISTINCT, cinematic image prompts — one per slide.

Rules:
- Slide 1 (COVER): The strongest, most visually impactful scene. This is the scroll-stopper hook.
- Middle slides (CONTENT): Each shows a different space, amenity, or angle. Tell a different part of the story per slide.
- Last slide (CTA): An inviting, aspirational wide exterior or lifestyle shot — feels like an invitation to live there.
- Each prompt must be a fully self-contained scene description. No references to "previous" or "next".
- Brand visual DNA must be present in EVERY prompt.
- NEVER include text, logos, watermarks, or UI elements in any prompt.

Respond ONLY with a JSON array of exactly N prompt strings — no markdown, no extra text:
["prompt 1", "prompt 2", ...]`,

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

  schedule: `You are running Phase 5 of the Noriega Group social media agent.
You receive a list of approved posts with their copy and generate an optimized posting schedule.

CRITICAL DATE RULE: The message will include "Today's date: YYYY-MM-DD". You MUST NOT schedule any post before that date. All scheduledDate values must be on or after today's date, distributed forward through the month.

Best posting times for Dominican Republic / Latin American audience (AST, UTC-4):
- Instagram Feed: Mon, Wed, Fri at 8am, 12pm, 7pm
- Instagram Stories: Daily at 8am, 1pm, 8pm
- Facebook: Tue, Thu, Sat at 9am, 12pm, 6pm
- LinkedIn: Tue, Wed, Thu at 9am, 12pm
- GMB: Mon, Thu at 10am

Rules:
- Max 2 posts per day per platform
- Stagger KASA and Arko (don't post same project twice same day)
- Stories can be daily
- Lead Magnet posts: always prime time (7pm or 8pm)
- Distribute posts evenly from today's date through the end of the month

Respond ONLY with a JSON array:
[{
  "postId": number,
  "postName": "string",
  "scheduledDate": "YYYY-MM-DD",
  "scheduledTime": "HH:MM",
  "platforms": ["IG","FB","LI","GMB"],
  "copyIG": "string or null",
  "copyFB": "string or null",
  "copyLI": "string or null",
  "copyGMB": "string or null"
}]

No markdown, no extra text. Only the JSON array.`,

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
    return text
  }

  return await withExponentialBackoff(callAnthropic, 5, 1000)
}

export function parseJSON<T>(raw: string): T {
  // 1. Strip markdown fences
  let cleanStr = raw.replace(/```(?:json)?/gi, '').trim()

  // 2. Extract the outermost JSON object or array
  const match = cleanStr.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
  if (match) cleanStr = match[0]

  // 3. Fix trailing commas
  cleanStr = cleanStr.replace(/,\s*([}\]])/g, '$1')

  // 4. Try parsing as-is
  try {
    return JSON.parse(cleanStr) as T
  } catch (_) {
    // 5. JSON likely truncated — attempt to close open structures
    let depth = 0
    let inString = false
    let escaped = false
    const opens: string[] = []
    for (const ch of cleanStr) {
      if (escaped)             { escaped = false; continue }
      if (ch === '\\' && inString) { escaped = true; continue }
      if (ch === '"')          { inString = !inString; continue }
      if (inString)            continue
      if (ch === '{' || ch === '[') opens.push(ch)
      if (ch === '}' || ch === ']') opens.pop()
    }
    // Close any open string first
    if (inString) cleanStr += '"'
    // Remove trailing comma before we close
    cleanStr = cleanStr.replace(/,\s*$/, '')
    // Close open structures in reverse order
    for (let i = opens.length - 1; i >= 0; i--) {
      cleanStr += opens[i] === '{' ? '}' : ']'
    }
    // Fix trailing commas again after patching
    cleanStr = cleanStr.replace(/,\s*([}\]])/g, '$1')

    try {
      return JSON.parse(cleanStr) as T
    } catch (err) {
      console.error('[parseJSON] Failed even after repair. Last 300 chars:', cleanStr.slice(-300))
      throw new Error('La IA generó un formato de datos incompleto o inválido. Intenta regenerarlo.')
    }
  }
}
