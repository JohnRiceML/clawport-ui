export const runtime = 'nodejs'

import { getOpenAIClient } from '@/lib/openai'

export async function POST(request: Request) {
  const openai = getOpenAIClient()
  try {
    const { text, voice } = await request.json()

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid "text" field' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice || 'alloy',
      input: text,
    })

    const buffer = Buffer.from(await response.arrayBuffer())

    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    console.error('TTS API error:', err)
    return new Response(
      JSON.stringify({ error: 'TTS failed. Make sure OpenClaw gateway is running.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
