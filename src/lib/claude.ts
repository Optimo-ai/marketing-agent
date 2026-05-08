import Anthropic from '@anthropic-ai/sdk'

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set in environment variables')
  return new Anthropic({ apiKey: key })
}

const SKILLS = {

  briefing: `RESPOND WITH ONLY JSON. NOTHING ELSE. NO TEXT BEFORE OR AFTER.
Each field: {month:string, year:number, contextoReferencia:string, desempenoAnuncios:string, actividadCompetencia:string, tendenciasContenido:string, noticiasSector:string, diarioObras:string, insightsClave:array}
Return: JSON object only.`,

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

  imagePrompt: `Generate ONE image prompt for luxury real estate. Cinematic, architectural, NO PEOPLE. Respond with ONLY the prompt string. Nothing else.`,

  videoPrompt: `Generate ONE 15-second video prompt. Avatar Sofia OR cinematic/lifestyle/creative style. NO text overlays. Respond with ONLY the prompt string. Nothing else.`,

  carouselPrompts: `RESPOND WITH ONLY JSON ARRAY OF STRINGS. NOTHING ELSE. NO TEXT BEFORE OR AFTER.
Generate N distinct image prompts for carousel slides. Each prompt: architectural, cinematic, NO PEOPLE.
Return: JSON array of strings only. Example: ["prompt 1", "prompt 2"]`,

  avatarScript: `RESPOND WITH ONLY JSON. NOTHING ELSE. NO TEXT BEFORE OR AFTER.
Write Sofia's 15-second script (35-45 words, conversational, hook+CTA) + Spanish subtitles (3-5 lines).
Return: {script_en:string, subtitles_es:array} only.`,

  editCopy: `Apply the instruction to the copy. Keep tone warm, aspirational. Respond with ONLY the revised copy. Nothing else.`,

  schedule: `RESPOND WITH ONLY JSON ARRAY. NOTHING ELSE. NO TEXT BEFORE OR AFTER.
Each post: {postId:number, postName:string, scheduledDate:string(YYYY-MM-DD), scheduledTime:string(HH:MM), platforms:[], copyIG:string|null, copyFB:string|null, copyLI:string|null, copyGMB:string|null}
CRITICAL: scheduledDate must be TODAY OR LATER ONLY. Never past dates.
Return: JSON array only.`,

  report: `RESPOND WITH ONLY JSON OBJECT. NOTHING ELSE. NO TEXT BEFORE OR AFTER.
Analyze real marketing data (Monday.com, GHL, Meta, Instagram, Facebook). Return: {score:0-100, executiveSummary:string, insights:array, wins:array, improvements:array, nextSteps:array}
Reference ONLY provided data. Never invent metrics.`,
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

export function parseJSON<T>(raw: string, fallback?: T): T {
  try {
    // Step 1: Remove markdown fences
    let text = raw.replace(/```(?:json)?\s*/gi, '').trim()
    
    // Step 2: Try direct parse first
    try {
      return JSON.parse(text) as T
    } catch (_) {}
    
    // Step 3: Find and extract JSON content
    const firstBracket = Math.max(
      text.lastIndexOf('['),
      text.lastIndexOf('{')
    )
    
    if (firstBracket === -1) {
      if (fallback !== undefined) {
        console.warn('[parseJSON] No JSON found, using fallback')
        return fallback
      }
      throw new Error('No JSON found in response')
    }
    
    text = text.substring(firstBracket)
    text = text.replace(/[^\]}]\s*$/g, '')
    
    try {
      return JSON.parse(text) as T
    } catch (_) {}
    
    // Step 4: Auto-close structures
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
    
    fixed = fixed.replace(/,\s*([}\]])/g, '$1')
    fixed = fixed.replace(/:\s*,/g, ': null,')
    fixed = fixed.replace(/,\s*$/, '')
    
    // Step 5: Final attempt
    try {
      return JSON.parse(fixed) as T
    } catch (parseErr) {
      // If all else fails and we have a fallback, use it
      if (fallback !== undefined) {
        console.error('[parseJSON] All recovery attempts failed, using fallback. Error:', String(parseErr).slice(0, 100))
        return fallback
      }
      
      console.error('[parseJSON] CRITICAL: No valid JSON and no fallback provided')
      console.error('[parseJSON] Original input (first 200 chars):', raw.slice(0, 200))
      console.error('[parseJSON] After fixes (last 300 chars):', fixed.slice(-300))
      throw new Error(`JSON parse failed: ${String(parseErr).slice(0, 100)}`)
    }
  } catch (error) {
    if (fallback !== undefined) {
      console.error('[parseJSON] Exception caught, using fallback:', error)
      return fallback
    }
    throw error
  }
}
