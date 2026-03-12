import { describe, expect, it } from 'vitest'
import { humanizeKanbanChatError, readKanbanChatErrorResponse } from './chat-errors'

describe('humanizeKanbanChatError', () => {
  it('maps ENOENT errors to a user-facing file message', () => {
    expect(humanizeKanbanChatError('ENOENT: no such file or directory')).toBe(
      'Agent failed while reading a required file.'
    )
  })

  it('maps gateway failures to the gateway message', () => {
    expect(humanizeKanbanChatError('fetch failed')).toBe(
      'Chat failed. Make sure OpenClaw gateway is running.'
    )
  })

  it('falls back to the status code when no message exists', () => {
    expect(humanizeKanbanChatError('', 502)).toBe('Error getting response (502).')
  })
})

describe('readKanbanChatErrorResponse', () => {
  it('prefers the JSON error payload', async () => {
    const response = new Response(JSON.stringify({ error: 'ENOENT: missing file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })

    await expect(readKanbanChatErrorResponse(response)).resolves.toBe(
      'Agent failed while reading a required file.'
    )
  })

  it('falls back to text responses', async () => {
    const response = new Response('plain failure', { status: 500 })

    await expect(readKanbanChatErrorResponse(response)).resolves.toBe('plain failure')
  })
})
