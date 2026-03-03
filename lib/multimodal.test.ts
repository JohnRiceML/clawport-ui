import { describe, it, expect } from 'vitest'
import { buildApiContent } from './multimodal'
import type { Message, MediaAttachment } from './conversations'

function msg(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'hello',
    timestamp: 1000,
    ...overrides,
  }
}

function imageAttachment(overrides: Partial<MediaAttachment> = {}): MediaAttachment {
  return {
    type: 'image',
    url: 'data:image/png;base64,iVBORw0KGgoAAAA',
    name: 'photo.png',
    mimeType: 'image/png',
    ...overrides,
  }
}

function fileAttachment(overrides: Partial<MediaAttachment> = {}): MediaAttachment {
  return {
    type: 'file',
    url: 'data:application/pdf;base64,JVBERi0',
    name: 'report.pdf',
    mimeType: 'application/pdf',
    size: 245000,
    ...overrides,
  }
}

function audioAttachment(overrides: Partial<MediaAttachment> = {}): MediaAttachment {
  return {
    type: 'audio',
    url: 'data:audio/webm;base64,GkXfo59C',
    name: 'Voice message',
    mimeType: 'audio/webm',
    duration: 5,
    waveform: Array(50).fill(0.3),
    ...overrides,
  }
}

// --- plain text messages ---

describe('buildApiContent — plain text', () => {
  it('returns string content when no media is attached', () => {
    const result = buildApiContent(msg({ content: 'just text' }))
    expect(result).toBe('just text')
  })

  it('returns string content when media array is empty', () => {
    const result = buildApiContent(msg({ content: 'text', media: [] }))
    expect(result).toBe('text')
  })

  it('returns empty string for empty content with no media', () => {
    const result = buildApiContent(msg({ content: '' }))
    expect(result).toBe('')
  })
})

// --- image attachments ---

describe('buildApiContent — images', () => {
  it('converts a message with one image to content parts array', () => {
    const result = buildApiContent(msg({
      content: 'what is this?',
      media: [imageAttachment()],
    }))
    expect(Array.isArray(result)).toBe(true)
    const parts = result as Array<{ type: string }>
    expect(parts).toHaveLength(2)
    expect(parts[0]).toEqual({ type: 'text', text: 'what is this?' })
    expect(parts[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAA' } })
  })

  it('includes multiple images as separate image_url parts', () => {
    const result = buildApiContent(msg({
      content: 'compare these',
      media: [
        imageAttachment({ url: 'data:image/png;base64,AAA' }),
        imageAttachment({ url: 'data:image/png;base64,BBB' }),
      ],
    }))
    const parts = result as Array<{ type: string }>
    expect(parts).toHaveLength(3) // 1 text + 2 images
    expect(parts.filter(p => p.type === 'image_url')).toHaveLength(2)
  })

  it('handles image-only message with no text content', () => {
    const result = buildApiContent(msg({
      content: '',
      media: [imageAttachment()],
    }))
    const parts = result as Array<{ type: string }>
    // No text part since content is empty, just the image
    expect(parts).toHaveLength(1)
    expect(parts[0].type).toBe('image_url')
  })
})

// --- file attachments ---

describe('buildApiContent — files', () => {
  it('adds a text label for binary files (PDF)', () => {
    const result = buildApiContent(msg({
      content: 'here is a doc',
      media: [fileAttachment()],
    }))
    const parts = result as Array<{ type: string; text?: string }>
    expect(parts).toHaveLength(2)
    expect(parts[1].type).toBe('text')
    expect(parts[1].text).toContain('report.pdf')
    expect(parts[1].text).toContain('239 KB') // 245000 / 1024 ≈ 239
  })

  it('inlines text file content from base64 data URL', () => {
    const textContent = 'Hello, world!'
    const base64 = btoa(textContent)
    const result = buildApiContent(msg({
      content: 'check this file',
      media: [fileAttachment({
        name: 'notes.txt',
        mimeType: 'text/plain',
        url: `data:text/plain;base64,${base64}`,
      })],
    }))
    const parts = result as Array<{ type: string; text?: string }>
    expect(parts).toHaveLength(2)
    expect(parts[1].text).toContain('Hello, world!')
    expect(parts[1].text).toContain('Contents of notes.txt')
  })

  it('inlines JSON file based on extension even without text/ mimeType', () => {
    const jsonContent = '{"key": "value"}'
    const base64 = btoa(jsonContent)
    const result = buildApiContent(msg({
      content: '',
      media: [fileAttachment({
        name: 'config.json',
        mimeType: 'application/json',
        url: `data:application/json;base64,${base64}`,
      })],
    }))
    const parts = result as Array<{ type: string; text?: string }>
    expect(parts).toHaveLength(1)
    expect(parts[0].text).toContain('"key": "value"')
  })

  it('falls back to label when file has no name', () => {
    const result = buildApiContent(msg({
      content: '',
      media: [fileAttachment({ name: undefined })],
    }))
    const parts = result as Array<{ type: string; text?: string }>
    expect(parts[0].text).toContain('unknown')
  })
})

// --- audio attachments ---

describe('buildApiContent — audio', () => {
  it('returns plain string for audio-only message (transcript from Whisper)', () => {
    const result = buildApiContent(msg({
      content: 'Hello this is my transcribed message',
      media: [audioAttachment()],
    }))
    // Audio is skipped and no other non-text parts exist, so return plain string
    // to avoid wrapping in ContentPart[] which the gateway may not handle
    expect(result).toBe('Hello this is my transcribed message')
  })

  it('returns plain string when audio is the only attachment', () => {
    const result = buildApiContent(msg({
      content: 'transcribed words',
      media: [audioAttachment()],
    }))
    expect(typeof result).toBe('string')
    expect(result).toBe('transcribed words')
  })
})

// --- mixed media ---

describe('buildApiContent — mixed media', () => {
  it('handles image + file together', () => {
    const result = buildApiContent(msg({
      content: 'look at both',
      media: [
        imageAttachment(),
        fileAttachment(),
      ],
    }))
    const parts = result as Array<{ type: string }>
    expect(parts).toHaveLength(3) // text + image + file label
    expect(parts[0].type).toBe('text')
    expect(parts[1].type).toBe('image_url')
    expect(parts[2].type).toBe('text')
  })

  it('handles image + audio (audio skipped, text preserved)', () => {
    const result = buildApiContent(msg({
      content: 'here is what I see',
      media: [
        imageAttachment(),
        audioAttachment(),
      ],
    }))
    const parts = result as Array<{ type: string }>
    expect(parts).toHaveLength(2) // text + image (audio skipped)
    expect(parts[0].type).toBe('text')
    expect(parts[1].type).toBe('image_url')
  })
})
