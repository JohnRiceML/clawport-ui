import { describe, expect, it } from 'vitest'
import { buildKanbanSystemPrompt, sanitizeKanbanTicketContext } from './chat-prompt'

describe('sanitizeKanbanTicketContext', () => {
  it('returns null for non-object ticket values', () => {
    expect(sanitizeKanbanTicketContext(null)).toBeNull()
    expect(sanitizeKanbanTicketContext('ticket')).toBeNull()
  })

  it('sanitizes and truncates ticket fields', () => {
    const ticket = sanitizeKanbanTicketContext({
      title: 'x'.repeat(600),
      description: 'd'.repeat(6000),
      useSessionMemory: true,
      status: 'todo',
      priority: 'medium',
      assigneeRole: 'qa',
      workResult: 'r'.repeat(11000),
    })

    expect(ticket).not.toBeNull()
    expect(ticket?.title).toHaveLength(500)
    expect(ticket?.description).toHaveLength(5000)
    expect(ticket?.workResult).toHaveLength(10000)
    expect(ticket?.assigneeRole).toBe('qa')
    expect(ticket?.useSessionMemory).toBe(true)
  })
})

describe('buildKanbanSystemPrompt', () => {
  const agent = {
    name: 'Legal Lead',
    title: 'Legal',
    soul: 'Stay precise.',
  }

  it('includes guardrails against hidden session references', () => {
    const prompt = buildKanbanSystemPrompt(agent, sanitizeKanbanTicketContext({
      title: 'Find legal',
      description: 'Find recent Ninth Circuit cases.',
      useSessionMemory: false,
      status: 'todo',
      priority: 'medium',
    }))

    expect(prompt).toContain('Ignore any hidden or persistent session memory')
    expect(prompt).toContain('do not say "as I said above"')
    expect(prompt).toContain('Repeat the answer directly instead.')
  })

  it('includes prior work result when present', () => {
    const prompt = buildKanbanSystemPrompt(agent, sanitizeKanbanTicketContext({
      title: 'Find legal',
      description: 'Find recent Ninth Circuit cases.',
      useSessionMemory: false,
      status: 'review',
      priority: 'medium',
      workResult: 'Collected three likely cases.',
    }))

    expect(prompt).toContain('You already completed work on this ticket.')
    expect(prompt).toContain('Collected three likely cases.')
  })

  it('describes in-progress work neutrally', () => {
    const prompt = buildKanbanSystemPrompt(agent, sanitizeKanbanTicketContext({
      title: 'Find legal',
      description: 'Continue prior work.',
      useSessionMemory: false,
      status: 'in-progress',
      priority: 'medium',
      workResult: 'Fetched batch 1 and saved the next page token.',
    }))

    expect(prompt).toContain('You already made progress on this ticket.')
    expect(prompt).not.toContain('You already completed work on this ticket.')
  })

  it('builds a non-ticket prompt when no ticket is provided', () => {
    const prompt = buildKanbanSystemPrompt(agent, null)

    expect(prompt).toContain('You are Legal Lead, Legal.')
    expect(prompt).toContain('Ignore any hidden or persistent session memory')
  })

  it('allows session memory when the ticket flag is enabled', () => {
    const prompt = buildKanbanSystemPrompt(agent, sanitizeKanbanTicketContext({
      title: 'Find legal',
      description: 'Continue prior work.',
      useSessionMemory: true,
      status: 'todo',
      priority: 'medium',
    }))

    expect(prompt).toContain('Session memory is enabled for this ticket.')
    expect(prompt).not.toContain('Ignore any hidden or persistent session memory')
  })
})
