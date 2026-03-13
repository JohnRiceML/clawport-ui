import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  addMessage,
  markRead,
  updateLastMessage,
  parseMedia,
  getOrCreateConversation,
  loadConversations,
  saveConversations,
  flushSave,
  type Message,
  type ConversationStore,
  type Conversation,
} from './conversations'
import type { Agent } from './types'

// --- helpers ---

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: overrides.id ?? 'msg-1',
    role: overrides.role ?? 'user',
    content: overrides.content ?? 'hello',
    timestamp: overrides.timestamp ?? 1000,
    ...overrides,
  }
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    agentId: overrides.agentId ?? 'vera',
    messages: overrides.messages ?? [],
    unread: overrides.unread ?? 0,
    lastActivity: overrides.lastActivity ?? 1000,
  }
}

function makeStore(entries: Record<string, Partial<Conversation>> = {}): ConversationStore {
  const store: ConversationStore = {}
  for (const [id, overrides] of Object.entries(entries)) {
    store[id] = makeConversation({ agentId: id, ...overrides })
  }
  return store
}

const fakeAgent: Agent = {
  id: 'vera',
  name: 'VERA',
  title: 'Chief Strategy Officer',
  reportsTo: 'jarvis',
  directReports: ['robin'],
  soulPath: null,
  soul: null,
  voiceId: null,
  color: '#a855f7',
  emoji: '?',
  tools: [],
  crons: [],
  model: null,
  memoryPath: null,
  description: 'CSO. Decides what gets built.',
}

// --- addMessage ---

describe('addMessage', () => {
  it('appends a user message without incrementing unread', () => {
    const store = makeStore({ vera: { messages: [] } })
    const msg = makeMessage({ role: 'user' })
    const result = addMessage(store, 'vera', msg)

    expect(result.vera.messages).toHaveLength(1)
    expect(result.vera.messages[0]).toEqual(msg)
    expect(result.vera.unread).toBe(0)
  })

  it('appends an assistant message and increments unread', () => {
    const store = makeStore({ vera: { messages: [], unread: 2 } })
    const msg = makeMessage({ role: 'assistant' })
    const result = addMessage(store, 'vera', msg)

    expect(result.vera.messages).toHaveLength(1)
    expect(result.vera.unread).toBe(3)
  })

  it('creates a new conversation entry when agentId not in store', () => {
    const store: ConversationStore = {}
    const msg = makeMessage({ role: 'user' })
    const result = addMessage(store, 'pulse', msg)

    expect(result.pulse).toBeDefined()
    expect(result.pulse.agentId).toBe('pulse')
    expect(result.pulse.messages).toHaveLength(1)
  })

  it('does not mutate the original store (immutability)', () => {
    const store = makeStore({ vera: { messages: [] } })
    const msg = makeMessage()
    const result = addMessage(store, 'vera', msg)

    expect(result).not.toBe(store)
    expect(result.vera).not.toBe(store.vera)
    expect(store.vera.messages).toHaveLength(0)
  })

  it('preserves other agents in the store', () => {
    const store = makeStore({
      vera: { messages: [] },
      pulse: { messages: [makeMessage({ id: 'existing' })] },
    })
    const msg = makeMessage()
    const result = addMessage(store, 'vera', msg)

    expect(result.pulse.messages).toHaveLength(1)
    expect(result.pulse.messages[0].id).toBe('existing')
  })
})

// --- markRead ---

describe('markRead', () => {
  it('resets unread to 0', () => {
    const store = makeStore({ vera: { unread: 5 } })
    const result = markRead(store, 'vera')
    expect(result.vera.unread).toBe(0)
  })

  it('returns the same store reference when agentId is missing', () => {
    const store = makeStore({})
    const result = markRead(store, 'nonexistent')
    expect(result).toBe(store)
  })

  it('does not mutate the original store', () => {
    const store = makeStore({ vera: { unread: 3 } })
    const result = markRead(store, 'vera')
    expect(store.vera.unread).toBe(3)
    expect(result.vera.unread).toBe(0)
  })
})

// --- updateLastMessage ---

describe('updateLastMessage', () => {
  it('updates the matching message content and streaming flag', () => {
    const store = makeStore({
      vera: {
        messages: [
          makeMessage({ id: 'msg-1', content: 'old', isStreaming: true }),
        ],
      },
    })

    const result = updateLastMessage(store, 'vera', 'msg-1', 'new content', false)
    expect(result.vera.messages[0].content).toBe('new content')
    expect(result.vera.messages[0].isStreaming).toBe(false)
  })

  it('does not touch messages with different ids', () => {
    const store = makeStore({
      vera: {
        messages: [
          makeMessage({ id: 'msg-1', content: 'keep me' }),
          makeMessage({ id: 'msg-2', content: 'update me' }),
        ],
      },
    })

    const result = updateLastMessage(store, 'vera', 'msg-2', 'updated', false)
    expect(result.vera.messages[0].content).toBe('keep me')
    expect(result.vera.messages[1].content).toBe('updated')
  })

  it('returns same store when agentId not found', () => {
    const store = makeStore({})
    const result = updateLastMessage(store, 'nonexistent', 'msg-1', 'x', false)
    expect(result).toBe(store)
  })

  it('returns store unchanged when msgId not found (no crash)', () => {
    const store = makeStore({
      vera: { messages: [makeMessage({ id: 'msg-1', content: 'original' })] },
    })
    const result = updateLastMessage(store, 'vera', 'no-such-id', 'x', false)
    expect(result.vera.messages[0].content).toBe('original')
  })
})

// --- getOrCreateConversation ---

describe('getOrCreateConversation', () => {
  it('returns existing conversation when it exists in store', () => {
    const existing = makeConversation({ agentId: 'vera', unread: 7 })
    const store: ConversationStore = { vera: existing }

    const result = getOrCreateConversation(store, fakeAgent)
    expect(result).toBe(existing)
    expect(result.unread).toBe(7)
  })

  it('creates a new conversation with a greeting when not in store', () => {
    const store: ConversationStore = {}
    const result = getOrCreateConversation(store, fakeAgent)

    expect(result.agentId).toBe('vera')
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].role).toBe('assistant')
    expect(result.messages[0].content).toContain('VERA')
    expect(result.unread).toBe(0)
  })
})

// --- parseMedia ---

describe('parseMedia', () => {
  it('extracts markdown image links', () => {
    const content = 'Check this out: ![diagram](https://example.com/img.png)'
    const media = parseMedia(content)
    expect(media).toHaveLength(1)
    expect(media[0].type).toBe('image')
    expect(media[0].url).toBe('https://example.com/img.png')
    expect(media[0].name).toBe('diagram')
  })

  it('extracts bare image URLs', () => {
    const content = 'See https://example.com/photo.jpg for reference'
    const media = parseMedia(content)
    expect(media).toHaveLength(1)
    expect(media[0].type).toBe('image')
    expect(media[0].url).toBe('https://example.com/photo.jpg')
  })

  it('does not duplicate an image that appears in both markdown and bare form', () => {
    const content = '![pic](https://example.com/pic.png) and also https://example.com/pic.png'
    const media = parseMedia(content)
    // The markdown image regex captures it first, bare regex should skip the duplicate
    const imageMedia = media.filter(m => m.type === 'image')
    expect(imageMedia).toHaveLength(1)
  })

  it('extracts audio URLs', () => {
    const content = 'Listen: https://example.com/sound.mp3'
    const media = parseMedia(content)
    expect(media).toHaveLength(1)
    expect(media[0].type).toBe('audio')
    expect(media[0].url).toBe('https://example.com/sound.mp3')
  })

  it('extracts multiple media types from one message', () => {
    const content = [
      '![chart](https://example.com/chart.png)',
      'https://example.com/recording.wav',
      'https://example.com/bg.webp',
    ].join('\n')
    const media = parseMedia(content)
    expect(media).toHaveLength(3)
    expect(media.map(m => m.type)).toEqual(['image', 'image', 'audio'])
  })

  it('handles image URLs with query strings', () => {
    const content = '![thumb](https://cdn.example.com/img.jpg?w=300&h=200)'
    const media = parseMedia(content)
    expect(media).toHaveLength(1)
    expect(media[0].url).toBe('https://cdn.example.com/img.jpg?w=300&h=200')
  })

  it('returns empty array when no media is present', () => {
    const content = 'Just a plain text message with no links'
    const media = parseMedia(content)
    expect(media).toHaveLength(0)
  })

  it('returns empty array for empty string', () => {
    expect(parseMedia('')).toHaveLength(0)
  })

  it('handles multiple audio formats', () => {
    const content = [
      'https://example.com/a.wav',
      'https://example.com/b.ogg',
      'https://example.com/c.m4a',
      'https://example.com/d.aac',
    ].join(' ')
    const media = parseMedia(content)
    expect(media).toHaveLength(4)
    expect(media.every(m => m.type === 'audio')).toBe(true)
  })
})

// --- loadConversations / saveConversations (localStorage) ---

describe('loadConversations', () => {
  beforeEach(() => {
    // jsdom provides localStorage
    localStorage.clear()
  })

  it('returns empty object when nothing stored', () => {
    const result = loadConversations()
    expect(result).toEqual({})
  })

  it('returns parsed data when valid JSON is stored', () => {
    const data: ConversationStore = {
      vera: makeConversation({ agentId: 'vera' }),
    }
    localStorage.setItem('clawport-conversations', JSON.stringify(data))
    const result = loadConversations()
    expect(result.vera.agentId).toBe('vera')
  })

  it('returns empty object when localStorage contains invalid JSON', () => {
    localStorage.setItem('clawport-conversations', 'not-json!!')
    const result = loadConversations()
    expect(result).toEqual({})
  })
})

describe('saveConversations', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists store to localStorage', () => {
    const data: ConversationStore = {
      vera: makeConversation({ agentId: 'vera' }),
    }
    saveConversations(data)
    flushSave() // flush the debounced write for synchronous test assertion
    const raw = localStorage.getItem('clawport-conversations')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).vera.agentId).toBe('vera')
  })
})
