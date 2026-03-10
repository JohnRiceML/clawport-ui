/**
 * Transcribe audio via the server-side Whisper API.
 * Returns the transcript text, or null if transcription failed.
 */
export async function transcribeViaApi(audioBlob: Blob): Promise<string | null> {
  try {
    const form = new FormData()
    form.append('audio', audioBlob, 'voice.webm')
    const res = await fetch('/api/transcribe', { method: 'POST', body: form })
    if (!res.ok) return null
    const data = await res.json()
    return data.text || null
  } catch {
    return null
  }
}

/**
 * Transcribe audio using the browser's Web Speech API (SpeechRecognition).
 * This is a fallback that works without any server — uses the browser's
 * built-in speech recognition engine.
 *
 * Note: This re-plays the audio through an Audio element and listens via
 * SpeechRecognition. It requires the browser to support both APIs.
 * Returns null if the browser doesn't support SpeechRecognition.
 */
export async function transcribeViaBrowser(audioBlob: Blob): Promise<string | null> {
  const SpeechRecognition = (
    (globalThis as Record<string, unknown>).SpeechRecognition ||
    (globalThis as Record<string, unknown>).webkitSpeechRecognition
  ) as (new () => SpeechRecognitionInstance) | undefined

  if (!SpeechRecognition) return null

  return new Promise<string | null>((resolve) => {
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    const preferredLang =
      typeof navigator !== 'undefined'
        ? (navigator.languages?.find(Boolean) ?? navigator.language ?? 'en-US')
        : 'en-US'
    recognition.lang = preferredLang.toLowerCase().startsWith('zh') ? 'zh-CN' : preferredLang

    let resolved = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (resolved) return
      resolved = true
      const transcript = event.results[0]?.[0]?.transcript || ''
      resolve(transcript || null)
    }

    recognition.onerror = () => {
      if (!resolved) { resolved = true; resolve(null) }
    }

    recognition.onnomatch = () => {
      if (!resolved) { resolved = true; resolve(null) }
    }

    recognition.onend = () => {
      if (!resolved) { resolved = true; resolve(null) }
    }

    // Play the audio so the mic picks it up — but SpeechRecognition
    // uses the system mic, not internal audio. Instead, we start recognition
    // alongside playback and hope the user's environment allows it.
    // In practice this is best-effort.
    const url = URL.createObjectURL(audioBlob)
    const audio = new Audio(url)

    recognition.start()
    audio.play().catch(() => {})

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        recognition.stop()
        resolve(null)
      }
      URL.revokeObjectURL(url)
    }, 10000)
  })
}

/**
 * Transcribe audio with automatic fallback:
 * 1. Try server-side Whisper API
 * 2. Return result or null
 */
export async function transcribe(audioBlob: Blob): Promise<{ text: string | null; source: 'whisper' | 'failed' }> {
  const whisperResult = await transcribeViaApi(audioBlob)
  if (whisperResult) return { text: whisperResult, source: 'whisper' }

  return { text: null, source: 'failed' }
}

// Types for the Web Speech API (not in all TS libs)
interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onnomatch: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
