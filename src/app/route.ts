import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, project } = await req.json()
    
    if (!imageBase64 || !project) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está configurada')

    const systemPrompt = `Eres un copywriter experto para la marca ${project}.
Genera 5 opciones de copy de UNA SOLA LÍNEA (máximo 6 palabras) para una Instagram Story basada en la imagen.
Las frases deben ser atractivas, modernas y estar en español.
Devuelve SOLO un array JSON de strings, sin markdown extra.
Ejemplo: ["Vive la exclusividad", "Tu nuevo hogar te espera", "El lujo que mereces", "Invierte con inteligencia", "Ubicación premium"]`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
              { type: 'text', text: 'Genera las frases basadas en esta imagen.' }
            ]
          }
        ]
      })
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      throw new Error(`Claude API error: ${err}`)
    }

    const claudeData = await claudeRes.json()
    const content = claudeData.content?.[0]?.text || '[]'
    
    let copies: string[] = []
    try {
      const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim()
      copies = JSON.parse(cleaned)
    } catch (e) {
      // Fallback si no llega como JSON perfecto
      copies = content.split('\n').map((l: string) => l.replace(/^- /, '').replace(/^"|"$/g, '').trim()).filter((l: string) => l.length > 0 && l.length < 50)
    }

    return NextResponse.json({ copies: copies.slice(0, 5) })
  } catch (err: any) {
    console.error('[stories] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}