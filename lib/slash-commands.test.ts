import { describe, it, expect } from 'vitest'
import {
  isSlashInput,
  parseSlashCommand,
  matchCommands,
  executeCommand,
  COMMANDS,
} from './slash-commands'
import type { Agent } from './types'

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'test-agent',
    name: 'TestBot',
    title: 'Test Agent',
    reportsTo: null,
    directReports: [],
    soulPath: null,
    soul: null,
    voiceId: null,
    color: '#ff0000',
    emoji: '🤖',
    tools: [],
    crons: [],
    model: null,
    memoryPath: null,
    description: 'A test agent for unit tests.',
    ...overrides,
  }
}

/* ── isSlashInput ─────────────────────────────────────── */

describe('isSlashInput', () => {
  it('returns true for input starting with /', () => {
    expect(isSlashInput('/help')).toBe(true)
  })

  it('returns true for input with leading whitespace before /', () => {
    expect(isSlashInput('  /clear')).toBe(true)
  })

  it('returns true for bare /', () => {
    expect(isSlashInput('/')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(isSlashInput('')).toBe(false)
  })

  it('returns false for regular text', () => {
    expect(isSlashInput('hello world')).toBe(false)
  })

  it('returns false for slash in middle of text', () => {
    expect(isSlashInput('use /help command')).toBe(false)
  })
})

/* ── parseSlashCommand ────────────────────────────────── */

describe('parseSlashCommand', () => {
  it('parses a known command', () => {
    expect(parseSlashCommand('/help')).toEqual({ command: '/help', args: '' })
  })

  it('parses a command with args', () => {
    expect(parseSlashCommand('/help extra stuff')).toEqual({ command: '/help', args: 'extra stuff' })
  })

  it('is case insensitive', () => {
    expect(parseSlashCommand('/CLEAR')).toEqual({ command: '/clear', args: '' })
  })

  it('handles leading whitespace', () => {
    expect(parseSlashCommand('  /soul')).toEqual({ command: '/soul', args: '' })
  })

  it('returns null for unknown command', () => {
    expect(parseSlashCommand('/unknown')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseSlashCommand('')).toBeNull()
  })

  it('returns null for non-slash input', () => {
    expect(parseSlashCommand('hello')).toBeNull()
  })

  it('parses all registered commands', () => {
    for (const cmd of COMMANDS) {
      const result = parseSlashCommand(cmd.name)
      expect(result).not.toBeNull()
      expect(result!.command).toBe(cmd.name)
    }
  })
})

/* ── matchCommands ────────────────────────────────────── */

describe('matchCommands', () => {
  it('returns all commands for bare /', () => {
    const matches = matchCommands('/')
    expect(matches).toHaveLength(COMMANDS.length)
  })

  it('filters by partial match', () => {
    const matches = matchCommands('/cl')
    expect(matches).toHaveLength(1)
    expect(matches[0].name).toBe('/clear')
  })

  it('returns multiple matches when prefix matches several', () => {
    const matches = matchCommands('/c')
    expect(matches.length).toBeGreaterThanOrEqual(2) // /clear, /crons
    expect(matches.map(m => m.name)).toContain('/clear')
    expect(matches.map(m => m.name)).toContain('/crons')
  })

  it('returns exact match', () => {
    const matches = matchCommands('/help')
    expect(matches).toHaveLength(1)
    expect(matches[0].name).toBe('/help')
  })

  it('returns empty for non-matching input', () => {
    expect(matchCommands('/xyz')).toHaveLength(0)
  })

  it('returns empty for non-slash input', () => {
    expect(matchCommands('hello')).toHaveLength(0)
  })

  it('returns empty for empty string', () => {
    expect(matchCommands('')).toHaveLength(0)
  })

  it('is case insensitive', () => {
    const matches = matchCommands('/HEL')
    expect(matches).toHaveLength(1)
    expect(matches[0].name).toBe('/help')
  })
})

/* ── executeCommand ───────────────────────────────────── */

describe('executeCommand', () => {
  const agent = makeAgent({
    name: 'VERA',
    title: 'Chief Strategy Officer',
    description: 'Oversees strategic planning.',
    tools: ['web-search', 'file-read'],
    soul: '# VERA\nI am the strategy lead.',
    memoryPath: '/memory/vera',
    crons: [
      {
        id: 'daily-report',
        name: 'Daily Report',
        schedule: '0 8 * * *',
        scheduleDescription: 'Daily at 8 AM',
        timezone: 'US/Eastern',
        status: 'ok',
        lastRun: '2025-01-01',
        nextRun: '2025-01-02',
        lastError: null,
        agentId: 'vera',
        description: 'Generate daily report',
        enabled: true,
        delivery: null,
        lastDurationMs: 5000,
        consecutiveErrors: 0,
        lastDeliveryStatus: null,
      },
    ],
  })

  it('/clear returns action', () => {
    const result = executeCommand('/clear', agent)
    expect(result.content).toBe('Conversation cleared.')
    expect(result.action).toBe('clear')
  })

  it('/help lists all commands', () => {
    const result = executeCommand('/help', agent)
    for (const cmd of COMMANDS) {
      expect(result.content).toContain(cmd.name)
      expect(result.content).toContain(cmd.description)
    }
  })

  it('/info shows agent profile', () => {
    const result = executeCommand('/info', agent)
    expect(result.content).toContain('VERA')
    expect(result.content).toContain('Chief Strategy Officer')
    expect(result.content).toContain('web-search')
    expect(result.content).toContain('Memory: /memory/vera')
  })

  it('/info shows "none" when agent has no tools', () => {
    const bare = makeAgent()
    const result = executeCommand('/info', bare)
    expect(result.content).toContain('Tools: none')
  })

  it('/info shows "not configured" when no memory path', () => {
    const bare = makeAgent()
    const result = executeCommand('/info', bare)
    expect(result.content).toContain('Memory: not configured')
  })

  it('/soul shows SOUL.md content', () => {
    const result = executeCommand('/soul', agent)
    expect(result.content).toBe('# VERA\nI am the strategy lead.')
  })

  it('/soul handles missing SOUL.md', () => {
    const bare = makeAgent()
    const result = executeCommand('/soul', bare)
    expect(result.content).toContain('No SOUL.md found')
  })

  it('/tools lists tools', () => {
    const result = executeCommand('/tools', agent)
    expect(result.content).toContain('web-search')
    expect(result.content).toContain('file-read')
  })

  it('/tools handles no tools', () => {
    const bare = makeAgent()
    const result = executeCommand('/tools', bare)
    expect(result.content).toContain('no tools configured')
  })

  it('/crons lists scheduled jobs', () => {
    const result = executeCommand('/crons', agent)
    expect(result.content).toContain("scheduled jobs")
    expect(result.content).toContain('Daily Report')
    expect(result.content).toContain('Daily at 8 AM')
    expect(result.content).toContain('ok')
  })

  it('/crons shows disabled status for disabled jobs', () => {
    const agentWithDisabled = makeAgent({
      crons: [{
        id: 'test',
        name: 'Test Job',
        schedule: '0 0 * * *',
        scheduleDescription: 'Daily at midnight',
        timezone: null,
        status: 'ok',
        lastRun: null,
        nextRun: null,
        lastError: null,
        agentId: null,
        description: null,
        enabled: false,
        delivery: null,
        lastDurationMs: null,
        consecutiveErrors: 0,
        lastDeliveryStatus: null,
      }],
    })
    const result = executeCommand('/crons', agentWithDisabled)
    expect(result.content).toContain('disabled')
  })

  it('/crons handles no scheduled jobs', () => {
    const bare = makeAgent()
    const result = executeCommand('/crons', bare)
    expect(result.content).toContain('no scheduled jobs')
  })

  it('unknown command returns error message', () => {
    const result = executeCommand('/bogus', agent)
    expect(result.content).toContain('Unknown command')
  })
})
