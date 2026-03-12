import type { Agent } from '@/lib/types'

const MAX_TITLE = 500
const MAX_DESC = 5000
const MAX_RESULT = 10000

interface RawTicketLike {
  title?: unknown
  description?: unknown
  useSessionMemory?: unknown
  status?: unknown
  priority?: unknown
  assigneeRole?: unknown
  workResult?: unknown
}

export interface SanitizedKanbanTicketContext {
  title: string
  description: string
  useSessionMemory: boolean
  status: string
  priority: string
  assigneeRole: string | null
  workResult: string | null
}

export function sanitizeKanbanTicketContext(rawTicket: unknown): SanitizedKanbanTicketContext | null {
  if (!rawTicket || typeof rawTicket !== 'object') return null

  const ticket = rawTicket as RawTicketLike
  return {
    title: String(ticket.title || '').slice(0, MAX_TITLE),
    description: String(ticket.description || '').slice(0, MAX_DESC),
    useSessionMemory: ticket.useSessionMemory === true,
    status: String(ticket.status || ''),
    priority: String(ticket.priority || ''),
    assigneeRole: typeof ticket.assigneeRole === 'string' ? ticket.assigneeRole : null,
    workResult: typeof ticket.workResult === 'string' ? ticket.workResult.slice(0, MAX_RESULT) : null,
  }
}

export function buildKanbanSystemPrompt(
  agent: Pick<Agent, 'name' | 'title' | 'soul'>,
  ticket: SanitizedKanbanTicketContext | null,
): string {
  const sessionMemoryRules = ticket?.useSessionMemory
    ? 'Session memory is enabled for this ticket. You may use relevant prior hidden session context if it helps continue the work, but restate enough context so the visible reply stands on its own.'
    : 'Treat each request as scoped only to the messages explicitly provided in this API call. Ignore any hidden or persistent session memory that is not present in those messages.\nIf the provided messages do not include a prior assistant reply, do not say "as I said above", "check my previous response", "already covered", or anything similar. Repeat the answer directly instead.'

  const ticketContext = ticket
    ? `You are working on ticket: "${ticket.title}".
Description: ${ticket.description || 'No description provided.'}
Status: ${ticket.status}
Priority: ${ticket.priority}
Your role: ${ticket.assigneeRole || 'unassigned'}${buildWorkContext(ticket.status, ticket.workResult)}

Help the user with this ticket. Stay in character as ${agent.name}, ${agent.title}. Be concise - 2-4 sentences unless detail is asked for. No em dashes.
${sessionMemoryRules}`
    : `You are ${agent.name}, ${agent.title}. Respond in character. Be concise. No em dashes.
Treat each request as scoped only to the messages explicitly provided in this API call. Ignore any hidden or persistent session memory that is not present in those messages.
If the provided messages do not include a prior assistant reply, do not say "as I said above", "check my previous response", "already covered", or anything similar. Repeat the answer directly instead.`

  return agent.soul
    ? `${agent.soul}\n\n${ticketContext}`
    : ticketContext
}

function buildWorkContext(status: string, workResult: string | null): string {
  if (!workResult) return ''

  return `\n\n${buildWorkLeadIn(status)}\n${workResult}\n\nReference this work when answering follow-up questions. Build on it, don't repeat it unless asked.`
}

function buildWorkLeadIn(status: string): string {
  if (status === 'done' || status === 'review') {
    return 'You already completed work on this ticket. Here is what you produced:'
  }

  return 'You already made progress on this ticket. Here is the latest visible work:'
}
