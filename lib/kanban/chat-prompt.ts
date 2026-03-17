import type { Agent, IntegrationItem } from '@/lib/types'

const MAX_TITLE = 500
const MAX_DESC = 5000
const MAX_RESULT = 10000

interface RawRelevantFile {
  id?: unknown
  name?: unknown
  url?: unknown
}

interface RawTicketLike {
  title?: unknown
  description?: unknown
  useSessionMemory?: unknown
  relevantFiles?: unknown
  status?: unknown
  priority?: unknown
  assigneeRole?: unknown
  workResult?: unknown
}

export interface SanitizedRelevantFile {
  name: string
  url: string
}

export interface SanitizedKanbanTicketContext {
  title: string
  description: string
  useSessionMemory: boolean
  relevantFiles: SanitizedRelevantFile[]
  status: string
  priority: string
  assigneeRole: string | null
  workResult: string | null
}

export function sanitizeKanbanTicketContext(rawTicket: unknown): SanitizedKanbanTicketContext | null {
  if (!rawTicket || typeof rawTicket !== 'object') return null

  const ticket = rawTicket as RawTicketLike
  const relevantFiles: SanitizedRelevantFile[] = Array.isArray(ticket.relevantFiles)
    ? (ticket.relevantFiles as RawRelevantFile[])
        .filter((f): f is RawRelevantFile & { name: string } => typeof f?.name === 'string')
        .slice(0, 20)
        .map((f) => ({
          name: String(f.name),
          url: typeof f.url === 'string' ? f.url : '',
        }))
    : []

  return {
    title: String(ticket.title || '').slice(0, MAX_TITLE),
    description: String(ticket.description || '').slice(0, MAX_DESC),
    useSessionMemory: ticket.useSessionMemory === true,
    relevantFiles,
    status: String(ticket.status || ''),
    priority: String(ticket.priority || ''),
    assigneeRole: typeof ticket.assigneeRole === 'string' ? ticket.assigneeRole : null,
    workResult: typeof ticket.workResult === 'string' ? ticket.workResult.slice(0, MAX_RESULT) : null,
  }
}

export interface AgentEnvironmentContext {
  tools: string[]
  integrations: {
    channels: IntegrationItem[]
    tools: IntegrationItem[]
  }
  /** Live Composio connected services (e.g. ['gmail', 'google_sheets', 'slack']) */
  composioApps?: string[]
}

function buildEnvironmentBlock(env: AgentEnvironmentContext | null): string {
  if (!env) return ''

  const parts: string[] = []

  if (env.tools.length > 0) {
    parts.push(`Your tools: ${env.tools.join(', ')}`)
  }

  const connectedTools = env.integrations.tools
    .filter(t => t.enabled !== false)
    .map(t => {
      const detail = t.summary.length > 0 ? ` (${t.summary.join(', ')})` : ''
      return `${t.id}${detail}`
    })
  const connectedChannels = env.integrations.channels
    .filter(c => c.enabled !== false)
    .map(c => {
      const detail = c.summary.length > 0 ? ` (${c.summary.join(', ')})` : ''
      return `${c.id}${detail}`
    })

  if (connectedTools.length > 0) {
    parts.push(`Connected integrations: ${connectedTools.join(', ')}`)
  }
  if (connectedChannels.length > 0) {
    parts.push(`Available channels: ${connectedChannels.join(', ')}`)
  }

  if (env.composioApps && env.composioApps.length > 0) {
    parts.push(`Composio connected services: ${env.composioApps.join(', ')}`)
  }

  if (parts.length === 0) return ''

  return `\n\nEnvironment:\n${parts.join('\n')}\nThese tools and integrations are already configured and available. Do not ask the user whether they are set up -- just use them.`
}

export function buildKanbanSystemPrompt(
  agent: Pick<Agent, 'name' | 'title' | 'soul'>,
  ticket: SanitizedKanbanTicketContext | null,
  environment?: AgentEnvironmentContext | null,
): string {
  const sessionMemoryRules = ticket?.useSessionMemory
    ? 'Session memory is enabled for this ticket. You may use relevant prior hidden session context if it helps continue the work, but restate enough context so the visible reply stands on its own.'
    : 'Treat each request as scoped only to the messages explicitly provided in this API call. Ignore any hidden or persistent session memory that is not present in those messages.\nIf the provided messages do not include a prior assistant reply, do not say "as I said above", "check my previous response", "already covered", or anything similar. Repeat the answer directly instead.'

  const ticketContext = ticket
    ? `You are working on ticket: "${ticket.title}".
Description: ${ticket.description || 'No description provided.'}
Status: ${ticket.status}
Priority: ${ticket.priority}
Your role: ${ticket.assigneeRole || 'unassigned'}${buildRelevantFilesBlock(ticket.relevantFiles)}${buildWorkContext(ticket.status, ticket.workResult)}

Help the user with this ticket. Stay in character as ${agent.name}, ${agent.title}. Be concise - 2-4 sentences unless detail is asked for. No em dashes.
${sessionMemoryRules}`
    : `You are ${agent.name}, ${agent.title}. Respond in character. Be concise. No em dashes.
Treat each request as scoped only to the messages explicitly provided in this API call. Ignore any hidden or persistent session memory that is not present in those messages.
If the provided messages do not include a prior assistant reply, do not say "as I said above", "check my previous response", "already covered", or anything similar. Repeat the answer directly instead.`

  const envBlock = buildEnvironmentBlock(environment ?? null)

  return agent.soul
    ? `${agent.soul}\n\n${ticketContext}${envBlock}`
    : `${ticketContext}${envBlock}`
}

function buildRelevantFilesBlock(files: SanitizedRelevantFile[]): string {
  if (files.length === 0) return ''

  const lines = files.map((f) => f.url ? `- "${f.name}" (${f.url})` : `- "${f.name}"`)
  return `\n\nRelevant files attached to this ticket:\n${lines.join('\n')}\nReference these files when relevant to the work.`
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
