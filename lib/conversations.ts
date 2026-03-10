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

export function saveConversations(store: ConversationStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {}
}

export function getOrCreateConversation(store: ConversationStore, agent: Agent): Conversation {
  if (store[agent.id]) return store[agent.id]
  return {
    agentId: agent.id,
    messages: [{
      id: generateId(),
      role: 'assistant',
      content: `我是 ${agent.name}。${agent.description ?? ''} 你需要我做什么？`,
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

export function parseMedia(content: string): MediaAttachment[] {
  const media: MediaAttachment[] = []

  const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\)]+\.(jpg|jpeg|png|gif|webp|svg)(\?[^\)]*)?)\)/gi
  let m: RegExpExecArray | null
  while ((m = imgRegex.exec(content)) !== null) {
    media.push({ type: 'image', url: m[2], name: m[1] || '图片' })
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
