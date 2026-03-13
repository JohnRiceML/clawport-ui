'use client'

import type { Agent } from './types'
import { generateId } from './id'

export type MediaType = 'image' | 'audio' | 'file'

export interface MediaAttachment {
  type: MediaType
  url: string
  name?: string
  mimeType?: string
  duration?: number
  waveform?: number[]
  size?: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  media?: MediaAttachment[]
  isStreaming?: boolean
}

export interface Conversation {
  agentId: string
  messages: Message[]
  unread: number
  lastActivity: number
}

export type ConversationStore = Record<string, Conversation>

const STORAGE_KEY = 'clawport-conversations'

export function loadConversations(): ConversationStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingStore: ConversationStore | null = null

export function flushSave(): void {
  if (pendingStore && typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingStore))
    } catch { /* storage full or unavailable */ }
    pendingStore = null
  }
}

// Flush on page unload to avoid data loss
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushSave)
}

export function saveConversations(store: ConversationStore): void {
  if (typeof window === 'undefined') return
  pendingStore = store
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(flushSave, 500)
}

export function getOrCreateConversation(store: ConversationStore, agent: Agent): Conversation {
  if (store[agent.id]) return store[agent.id]
  return {
    agentId: agent.id,
    messages: [{
      id: generateId(),
      role: 'assistant',
      content: `I'm ${agent.name}. ${agent.description} What do you need?`,
      timestamp: Date.now(),
    }],
    unread: 0,
    lastActivity: Date.now(),
  }
}

export function addMessage(store: ConversationStore, agentId: string, msg: Message): ConversationStore {
  const conv = store[agentId] || { agentId, messages: [], unread: 0, lastActivity: Date.now() }
  return {
    ...store,
    [agentId]: {
      ...conv,
      messages: [...conv.messages, msg],
      lastActivity: Date.now(),
      unread: msg.role === 'assistant' ? conv.unread + 1 : conv.unread,
    }
  }
}

export function markRead(store: ConversationStore, agentId: string): ConversationStore {
  if (!store[agentId]) return store
  return { ...store, [agentId]: { ...store[agentId], unread: 0 } }
}

export function updateLastMessage(store: ConversationStore, agentId: string, msgId: string, content: string, isStreaming: boolean): ConversationStore {
  const conv = store[agentId]
  if (!conv) return store
  const msgs = conv.messages.map(m => m.id === msgId ? { ...m, content, isStreaming } : m)
  return { ...store, [agentId]: { ...conv, messages: msgs } }
}

// ── Server sync types & helpers ──────────────────────────

/** Serializable message for server sync (mirrors StoredMessage from conversation-store) */
export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/** Convert a client Message to a StoredMessage (drops system messages) */
export function toStoredMessage(msg: Message): StoredMessage | null {
  if (msg.role === 'system') return null
  return { id: msg.id, role: msg.role, content: msg.content, timestamp: msg.timestamp }
}

/** Convert a StoredMessage back to a client Message */
export function fromStoredMessage(msg: StoredMessage): Message {
  return { id: msg.id, role: msg.role, content: msg.content, timestamp: msg.timestamp }
}

/** Fetch conversation messages from the server */
export async function fetchConversation(agentId: string): Promise<StoredMessage[]> {
  try {
    const res = await fetch(`/api/conversations/${encodeURIComponent(agentId)}`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

/** Sync messages to the server (fire-and-forget) */
export function syncToServer(agentId: string, messages: Message[]): void {
  const stored = messages.map(toStoredMessage).filter((m): m is StoredMessage => m !== null)
  if (stored.length === 0) return
  fetch(`/api/conversations/${encodeURIComponent(agentId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: stored }),
  }).catch(() => {})
}

/** Delete conversation on the server (fire-and-forget) */
export function deleteOnServer(agentId: string): void {
  fetch(`/api/conversations/${encodeURIComponent(agentId)}`, {
    method: 'DELETE',
  }).catch(() => {})
}

/** Fetch onboarded status from the server */
export async function fetchOnboarded(): Promise<boolean> {
  try {
    const res = await fetch('/api/onboarded')
    if (!res.ok) return false
    const data = await res.json()
    return data.onboarded === true
  } catch {
    return false
  }
}

/** Sync onboarded status to the server (fire-and-forget) */
export function syncOnboarded(value: boolean): void {
  fetch('/api/onboarded', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ onboarded: value }),
  }).catch(() => {})
}

export function parseMedia(content: string): MediaAttachment[] {
  const media: MediaAttachment[] = []

  const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\)]+\.(jpg|jpeg|png|gif|webp|svg)(\?[^\)]*)?)\)/gi
  let m: RegExpExecArray | null
  while ((m = imgRegex.exec(content)) !== null) {
    media.push({ type: 'image', url: m[2], name: m[1] || 'Image' })
  }

  const bareImgRegex = /(?<!\]\()https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)(\?\S*)?\b/gi
  while ((m = bareImgRegex.exec(content)) !== null) {
    const url = m[0]
    if (!media.find(x => x.url === url)) {
      media.push({ type: 'image', url })
    }
  }

  const audioRegex = /https?:\/\/\S+\.(mp3|wav|ogg|m4a|aac)(\?\S*)?\b/gi
  while ((m = audioRegex.exec(content)) !== null) {
    media.push({ type: 'audio', url: m[0], name: m[0].split('/').pop() })
  }

  return media
}
