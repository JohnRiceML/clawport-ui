export const runtime = 'nodejs'

import { getAgent } from '@/lib/agents'
import { getOpenAIClient } from '@/lib/openai'
import type OpenAI from 'openai'

const MAX_TITLE = 500
const MAX_DESC = 5000
const MAX_RESULT = 10000

function isValidMessage(m: unknown): m is { role: 'user' | 'assistant'; content: string } {
  if (!m || typeof m !== 'object') return false
  const msg = m as Record<string, unknown>
  return (
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string' &&
    msg.content.length > 0
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const openai = getOpenAIClient()
  const { id } = await params
  const agent = await getAgent(id)

  if (!agent) {
    return new Response(JSON.stringify({ error: 'Agent not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { messages?: unknown; ticket?: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const rawMessages = body.messages
  if (!Array.isArray(rawMessages) || !rawMessages.every(isValidMessage)) {
    return new Response(
      JSON.stringify({ error: 'messages must be an array of {role, content} objects' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
  const messages = rawMessages as { role: 'user' | 'assistant'; content: string }[]

  // Sanitize and truncate ticket fields
  const rawTicket = body.ticket as Record<string, unknown> | undefined
  const ticket = rawTicket
    ? {
        title: String(rawTicket.title || '').slice(0, MAX_TITLE),
        description: String(rawTicket.description || '').slice(0, MAX_DESC),
        status: String(rawTicket.status || ''),
        priority: String(rawTicket.priority || ''),
        assigneeRole: typeof rawTicket.assigneeRole === 'string' ? rawTicket.assigneeRole : null,
        workResult: typeof rawTicket.workResult === 'string' ? rawTicket.workResult.slice(0, MAX_RESULT) : null,
      }
    : null

  // Build system prompt with ticket context
  const workContext = ticket?.workResult
    ? `\n\nYou already completed work on this ticket. Here is what you produced:\n${ticket.workResult}\n\nReference this work when answering follow-up questions. Build on it, don't repeat it unless asked.`
    : ''

  const ticketContext = ticket
    ? `You are working on ticket: "${ticket.title}".
Description: ${ticket.description || 'No description provided.'}
Status: ${ticket.status}
Priority: ${ticket.priority}
Your role: ${ticket.assigneeRole || 'unassigned'}${workContext}

Help the user with this ticket. Stay in character as ${agent.name}, ${agent.title}. Be concise — 2-4 sentences unless detail is asked for. No em dashes.`
    : `You are ${agent.name}, ${agent.title}. Respond in character. Be concise. No em dashes.`

  const systemPrompt = agent.soul
    ? `${agent.soul}\n\n${ticketContext}`
    : ticketContext

  try {
    const stream = await openai.chat.completions.create({
      model: agent.model || 'claude-sonnet-4-6',
      stream: true,
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ] as OpenAI.ChatCompletionMessageParam[],
    })

    const streamBody = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              )
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Stream interrupted'
          console.error(`Kanban chat stream error [agentId=${id}]:`, errMsg)
          // Signal error to client before closing
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
          )
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(streamBody, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Kanban chat API error [agentId=${id}]:`, errMsg)
    return new Response(
      JSON.stringify({ error: 'Chat failed. Make sure OpenClaw gateway is running.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
