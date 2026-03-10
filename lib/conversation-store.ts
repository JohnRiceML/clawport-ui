import { readFileSync, appendFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import path from 'path'
import { requireEnv } from '@/lib/env'

/** Serializable chat message (no isStreaming, no media blobs — UI-only fields) */
export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/** Lightweight metadata returned when listing all conversations */
export interface ConversationMeta {
  agentId: string
  lastActivity: number
  messageCount: number
  lastMessage: string | null
}

/** Derive the conversations directory from WORKSPACE_PATH */
function getConversationsDir(): string {
  return path.resolve(requireEnv('WORKSPACE_PATH'), '..', 'clawport', 'conversations')
}

/**
 * Parse a single JSONL line into a StoredMessage.
 * Returns null if the line can't be parsed or is missing required fields.
 */
function parseLine(line: string): StoredMessage | null {
  if (!line.trim()) return null
  try {
    const obj = JSON.parse(line)
    if (typeof obj.id !== 'string' || !obj.id) return null
    if (obj.role !== 'user' && obj.role !== 'assistant') return null
    if (typeof obj.content !== 'string') return null
    return {
      id: obj.id,
      role: obj.role,
      content: obj.content,
      timestamp: typeof obj.timestamp === 'number' ? obj.timestamp : 0,
    }
  } catch {
    return null
  }
}

/**
 * Read all messages for an agent conversation from its JSONL file.
 * Returns StoredMessage[] sorted oldest-first by timestamp.
 */
export function getConversation(agentId: string): StoredMessage[] {
  const dir = getConversationsDir()
  const filePath = path.join(dir, `${agentId}.jsonl`)

  if (!existsSync(filePath)) return []

  try {
    const content = readFileSync(filePath, 'utf-8')
    const messages: StoredMessage[] = []
    for (const line of content.split('\n')) {
      const msg = parseLine(line)
      if (msg) messages.push(msg)
    }
    messages.sort((a, b) => a.timestamp - b.timestamp)
    return messages
  } catch {
    return []
  }
}

/**
 * Append messages to an agent's JSONL file.
 * Creates the directory and file if they don't exist.
 * Deduplicates by message ID to prevent duplicates on retry.
 */
export function appendMessages(agentId: string, messages: StoredMessage[]): void {
  const dir = getConversationsDir()
  mkdirSync(dir, { recursive: true })

  const filePath = path.join(dir, `${agentId}.jsonl`)

  let newMessages = messages
  if (existsSync(filePath)) {
    const existing = getConversation(agentId)
    const existingIds = new Set(existing.map(m => m.id))
    newMessages = messages.filter(m => !existingIds.has(m.id))
    if (newMessages.length === 0) return
  }

  const lines = newMessages.map(m => JSON.stringify({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
  }))

  appendFileSync(filePath, lines.join('\n') + '\n', 'utf-8')
}

/**
 * Clear an agent's conversation by removing the JSONL file.
 */
export function clearConversation(agentId: string): void {
  const dir = getConversationsDir()
  const filePath = path.join(dir, `${agentId}.jsonl`)

  if (existsSync(filePath)) {
    writeFileSync(filePath, '', 'utf-8')
  }
}

/**
 * List metadata for all stored conversations by scanning the conversations directory.
 */
export function listConversations(): ConversationMeta[] {
  const dir = getConversationsDir()
  if (!existsSync(dir)) return []

  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.jsonl'))
    return files.map(f => {
      const agentId = f.replace('.jsonl', '')
      const messages = getConversation(agentId)
      const last = messages.length > 0 ? messages[messages.length - 1] : null
      return {
        agentId,
        lastActivity: last ? last.timestamp : 0,
        messageCount: messages.length,
        lastMessage: last ? last.content.slice(0, 100) : null,
      }
    }).filter(m => m.messageCount > 0)
  } catch {
    return []
  }
}
