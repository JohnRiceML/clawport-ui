'use client'

import type { KanbanTicket, TeamRole } from './types'
import { generateId } from '../id'
import { humanizeKanbanChatError, readKanbanChatErrorResponse } from './chat-errors'

export type WorkDisposition = 'completed' | 'needs_input' | 'working'

/* ── Role-specific work prompts ──────────────────────── */

const ROLE_PROMPTS: Record<TeamRole, string> = {
  'lead-dev': `You are working this ticket as the Lead Dev. Provide:
1. Technical breakdown of the work needed
2. Implementation plan with clear steps
3. Key technical decisions or trade-offs
4. Dependencies or blockers to flag

Be specific and actionable. Reference concrete files, APIs, or patterns where relevant.`,

  'ux-ui': `You are working this ticket as the UX/UI Lead. Provide:
1. Design review and recommendations
2. User flow walkthrough
3. Accessibility considerations (WCAG)
4. Visual/interaction suggestions

Focus on the user experience. Call out any usability concerns or improvements.`,

  'qa': `You are working this ticket as QA. Provide:
1. Test scenarios (happy path + edge cases)
2. Acceptance criteria checklist
3. Potential regression areas
4. Edge cases and boundary conditions to verify

Be thorough. Think about what could break and how to verify it works.`,
}

const FALLBACK_PROMPT = `You are working this ticket. Provide:
1. Analysis of what needs to be done
2. Recommended approach
3. Key considerations or risks
4. Next steps

Be concise and actionable.`

const WORKFLOW_STATUS_INSTRUCTIONS = `

Start the first line exactly as one of:
- Workflow status: completed
- Workflow status: needs_input
- Workflow status: working

Use:
- completed: only when the task is actually done and ready for review
- needs_input: only when you need human input, approval, or clarification
- working: when you made progress but the task is not complete yet

After that first line, give the actual update for the ticket.`

export function getWorkPrompt(ticket: KanbanTicket): string {
  const rolePrompt = ticket.assigneeRole
    ? ROLE_PROMPTS[ticket.assigneeRole] ?? FALLBACK_PROMPT
    : FALLBACK_PROMPT

  const filesBlock = ticket.relevantFiles.length > 0
    ? `\nRelevant files:\n${ticket.relevantFiles.map((f) => f.url ? `- "${f.name}" (${f.url})` : `- "${f.name}"`).join('\n')}`
    : ''

  return `${rolePrompt}${WORKFLOW_STATUS_INSTRUCTIONS}

Ticket: ${ticket.title}
${ticket.description ? `Description: ${ticket.description}` : 'No description provided.'}
Priority: ${ticket.priority}${filesBlock}`
}

export function parseWorkDisposition(rawContent: string): {
  disposition: WorkDisposition
  content: string
} {
  const trimmed = rawContent.trim()
  const statusMatch = trimmed.match(/^workflow status:\s*(completed|needs_input|working)\s*$/im)

  if (statusMatch) {
    const disposition = statusMatch[1].toLowerCase() as WorkDisposition
    const content = trimmed
      .replace(/^workflow status:\s*(completed|needs_input|working)\s*$/im, '')
      .trim()
    return { disposition, content: content || trimmed }
  }

  return {
    disposition: inferWorkDisposition(trimmed),
    content: trimmed,
  }
}

function inferWorkDisposition(content: string): WorkDisposition {
  if (/\b(need[s]? your input|need[s]? input|need[s]? approval|please confirm|can you provide|could you provide|waiting for you|which one|what should|confirm whether)\b/i.test(content)) {
    return 'needs_input'
  }

  if (/\b(completed|complete|finished|done|all set|ready for review|successfully (?:updated|processed|completed)|task is complete)\b/i.test(content)) {
    return 'completed'
  }

  return 'working'
}

/* ── Execute work via chat API ───────────────────────── */

interface WorkResult {
  success: boolean
  content: string
  error?: string
}

const WORK_TIMEOUT_MS = 120_000 // 2 minutes
const EMPTY_RUNTIME_RESPONSE_ERROR = 'Agent runtime did not return a response.'

export async function executeWork(
  agentId: string,
  ticket: KanbanTicket,
  onChunk?: (chunk: string) => void,
  externalSignal?: AbortSignal,
): Promise<WorkResult> {
  const prompt = getWorkPrompt(ticket)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), WORK_TIMEOUT_MS)

    // Forward external abort (e.g. component unmount) to our controller
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId)
        return { success: false, content: '', error: 'Cancelled' }
      }
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    const res = await fetch(`/api/kanban/chat/${agentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        ticket: {
          title: ticket.title,
          description: ticket.description,
          useSessionMemory: ticket.useSessionMemory,
          relevantFiles: ticket.relevantFiles,
          status: ticket.status,
          priority: ticket.priority,
          assigneeRole: ticket.assigneeRole,
          workResult: ticket.workResult,
        },
      }),
    })

    if (!res.ok) {
      clearTimeout(timeoutId)
      return {
        success: false,
        content: '',
        error: await readKanbanChatErrorResponse(res),
      }
    }

    if (!res.body) {
      clearTimeout(timeoutId)
      return { success: false, content: '', error: EMPTY_RUNTIME_RESPONSE_ERROR }
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const chunk = JSON.parse(line.slice(6))
              if (chunk.error) {
                return {
                  success: false,
                  content: fullContent,
                  error: humanizeKanbanChatError(chunk.error),
                }
              }
              if (chunk.content) {
                fullContent += chunk.content
                onChunk?.(chunk.content)
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      }
    } finally {
      clearTimeout(timeoutId)
    }

    if (!fullContent.trim()) {
      return { success: false, content: '', error: EMPTY_RUNTIME_RESPONSE_ERROR }
    }

    return { success: true, content: fullContent }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, content: '', error: 'Agent work timed out' }
    }
    return {
      success: false,
      content: '',
      error: humanizeKanbanChatError(err),
    }
  }
}

/* ── Persist work chat to filesystem via API ─────────── */

export async function persistWorkChat(
  ticketId: string,
  prompt: string,
  response: string,
): Promise<boolean> {
  const now = Date.now()
  const messages = [
    { id: generateId(), role: 'user' as const, content: prompt, timestamp: now },
    { id: generateId(), role: 'assistant' as const, content: response, timestamp: now + 1 },
  ]

  try {
    const res = await fetch(`/api/kanban/chat-history/${ticketId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    })
    return res.ok
  } catch {
    return false
  }
}
