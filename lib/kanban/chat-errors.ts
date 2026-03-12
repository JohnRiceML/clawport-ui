const DEFAULT_KANBAN_CHAT_ERROR = 'Error getting response.'

export function humanizeKanbanChatError(error: unknown, status?: number): string {
  const raw = typeof error === 'string'
    ? error.trim()
    : error instanceof Error
      ? error.message.trim()
      : ''

  if (!raw) {
    return status ? `Error getting response (${status}).` : DEFAULT_KANBAN_CHAT_ERROR
  }

  if (/enoent/i.test(raw)) {
    return 'Agent failed while reading a required file.'
  }

  if (/aborterror|aborted|timed out/i.test(raw)) {
    return 'Agent response timed out.'
  }

  if (/gateway|econnrefused|fetch failed|network|socket hang up/i.test(raw)) {
    return 'Chat failed. Make sure OpenClaw gateway is running.'
  }

  return raw
}

export async function readKanbanChatErrorResponse(response: Response): Promise<string> {
  try {
    const body = await response.clone().json() as { error?: unknown }
    if (typeof body.error === 'string') {
      return humanizeKanbanChatError(body.error, response.status)
    }
  } catch {
    // Fall through to text parsing.
  }

  try {
    const text = await response.text()
    return humanizeKanbanChatError(text, response.status)
  } catch {
    return humanizeKanbanChatError('', response.status)
  }
}
