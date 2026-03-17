// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { extractJson } from './cli-utils'

describe('extractJson', () => {
  it('parses clean JSON array', () => {
    const result = extractJson('[{"id":"main"}]')
    expect(result).toEqual([{ id: 'main' }])
  })

  it('parses clean JSON object', () => {
    const result = extractJson('{"name":"test"}')
    expect(result).toEqual({ name: 'test' })
  })

  it('strips validation warnings before JSON array', () => {
    const raw = `agents.defaults.memorySearch.query.hybrid: Unrecognized keys: "mmr", "temporalDecay"
commands: Unrecognized key: "ownerDisplay"
hooks: Unrecognized key: "allowedAgentIds"
[{"id":"main","workspace":"/home/user/.openclaw/workspace"}]`
    const result = extractJson(raw)
    expect(result).toEqual([{ id: 'main', workspace: '/home/user/.openclaw/workspace' }])
  })

  it('strips validation warnings before JSON object', () => {
    const raw = `gateway: Unrecognized key: "allowRealIpFallback"
{"jobs":[{"name":"daily-report"}]}`
    const result = extractJson(raw) as Record<string, unknown>
    expect(result.jobs).toEqual([{ name: 'daily-report' }])
  })

  it('handles whitespace before JSON', () => {
    const result = extractJson('  \n  [1,2,3]')
    expect(result).toEqual([1, 2, 3])
  })

  it('throws on output with no JSON', () => {
    expect(() => extractJson('no json here')).toThrow('No JSON found')
  })

  it('throws on empty string', () => {
    expect(() => extractJson('')).toThrow()
  })
})
