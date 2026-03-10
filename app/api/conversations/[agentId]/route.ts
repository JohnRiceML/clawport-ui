import { NextRequest } from 'next/server'
import { getConversation, appendMessages, clearConversation, StoredMessage } from '@/lib/conversation-store'
import { apiErrorResponse } from '@/lib/api-error'

const AGENT_ID_RE = /^[a-zA-Z0-9_-]+$/

function isValidMessage(m: unknown): m is StoredMessage {
  if (!m || typeof m !== 'object') return false
  const msg = m as Record<string, unknown>
  return (
    typeof msg.id === 'string' && msg.id.length > 0 &&
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string' &&
    (typeof msg.timestamp === 'number' || msg.timestamp === undefined)
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params
    if (!AGENT_ID_RE.test(agentId)) {
      return Response.json({ error: 'Invalid agent ID' }, { status: 400 })
    }
    const messages = getConversation(agentId)
    return Response.json(messages)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load conversation')
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params
    if (!AGENT_ID_RE.test(agentId)) {
      return Response.json({ error: 'Invalid agent ID' }, { status: 400 })
    }

    const body = await req.json()
    const messages: unknown[] = body.messages

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'messages array required' }, { status: 400 })
    }

    if (!messages.every(isValidMessage)) {
      return Response.json({ error: 'Invalid message format: each message needs id, role (user|assistant), and content' }, { status: 400 })
    }

    appendMessages(agentId, messages)
    return Response.json({ ok: true })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to save messages')
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params
    if (!AGENT_ID_RE.test(agentId)) {
      return Response.json({ error: 'Invalid agent ID' }, { status: 400 })
    }
    clearConversation(agentId)
    return Response.json({ ok: true })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to clear conversation')
  }
}
