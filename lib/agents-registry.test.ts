// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'fs'
import { loadRegistry, clearRegistryCache } from './agents-registry'

// Mock all FS + child_process so loadRegistry() falls through to bundled JSON
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(() => false),
  readdirSync: vi.fn(() => []),
}))
vi.mock('child_process', () => ({
  execSync: vi.fn(() => '[]'),
}))

const existsSyncMock = vi.mocked(existsSync)

describe('loadRegistry cache', () => {
  beforeEach(() => {
    clearRegistryCache()
    existsSyncMock.mockClear()
    vi.useFakeTimers()
    // Set WORKSPACE_PATH so loadRegistry actually does FS work
    vi.stubEnv('WORKSPACE_PATH', '/tmp/fake-workspace')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('returns the same result on second call within TTL (cache hit)', () => {
    const first = loadRegistry()
    expect(first.length).toBeGreaterThan(0)

    const callsAfterFirst = existsSyncMock.mock.calls.length
    expect(callsAfterFirst).toBeGreaterThan(0) // sanity: first call did FS work

    const second = loadRegistry()

    // Cache hit -- no additional filesystem calls
    expect(existsSyncMock.mock.calls.length).toBe(callsAfterFirst)
    expect(second).toBe(first)
  })

  it('returns fresh result after TTL expires (cache miss)', () => {
    loadRegistry()
    const callsAfterFirst = existsSyncMock.mock.calls.length

    // Advance past the 5s TTL
    vi.advanceTimersByTime(5001)
    loadRegistry()

    // Cache miss -- filesystem was consulted again
    expect(existsSyncMock.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })

  it('returns cached result just before TTL expires', () => {
    const first = loadRegistry()
    const callsAfterFirst = existsSyncMock.mock.calls.length

    // Advance to just before expiry
    vi.advanceTimersByTime(4999)
    const second = loadRegistry()

    expect(existsSyncMock.mock.calls.length).toBe(callsAfterFirst)
    expect(second).toBe(first)
  })

  it('clearRegistryCache forces a fresh load', () => {
    loadRegistry()
    const callsAfterFirst = existsSyncMock.mock.calls.length

    clearRegistryCache()
    loadRegistry()

    // Cache was cleared -- filesystem consulted again
    expect(existsSyncMock.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })
})
