// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MemoryFileInfo } from './types'

const { mockExistsSync, mockReadFileSync, mockStatSync, mockReaddirSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockStatSync: vi.fn(),
  mockReaddirSync: vi.fn(),
}))

const { mockExecSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
}))

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  statSync: mockStatSync,
  readdirSync: mockReaddirSync,
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    statSync: mockStatSync,
    readdirSync: mockReaddirSync,
  },
}))

vi.mock('child_process', () => ({
  execSync: mockExecSync,
  default: { execSync: mockExecSync },
}))

import { getMemoryFiles, getMemoryConfig, getMemoryStatus, computeMemoryStats } from './memory'

const WS = '/tmp/test-workspace'

function fakeStat(size: number, mtime?: Date) {
  return {
    size,
    mtime: mtime ?? new Date('2026-03-01T12:00:00Z'),
    isFile: () => true,
  }
}

// ── getMemoryFiles ──────────────────────────────────────────────

describe('getMemoryFiles', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetAllMocks()
    vi.stubEnv('WORKSPACE_PATH', WS)
  })

  it('throws when WORKSPACE_PATH is missing', async () => {
    vi.stubEnv('WORKSPACE_PATH', '')
    await expect(getMemoryFiles()).rejects.toThrow('Missing required environment variable')
  })

  it('discovers root MEMORY.md', async () => {
    mockExistsSync.mockImplementation((p: string) => p === `${WS}/MEMORY.md`)
    mockReadFileSync.mockReturnValue('# Memory')
    mockStatSync.mockReturnValue(fakeStat(1024))

    const files = await getMemoryFiles()
    expect(files).toHaveLength(1)
    expect(files[0].label).toBe('Long-Term Memory')
    expect(files[0].relativePath).toBe('MEMORY.md')
    expect(files[0].category).toBe('evergreen')
    expect(files[0].sizeBytes).toBe(1024)
  })

  it('discovers files in memory/ directory', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['team-memory.md', '2026-03-01.md'])
    mockReadFileSync.mockReturnValue('content')
    mockStatSync.mockReturnValue(fakeStat(500))

    const files = await getMemoryFiles()
    // Root MEMORY.md + 2 memory dir files
    expect(files).toHaveLength(3)
  })

  it('categorizes daily logs correctly', async () => {
    mockExistsSync.mockImplementation((p: string) => p === `${WS}/memory`)
    mockReaddirSync.mockReturnValue(['2026-03-01.md'])
    mockReadFileSync.mockReturnValue('log content')
    mockStatSync.mockReturnValue(fakeStat(200))

    const files = await getMemoryFiles()
    const daily = files.find(f => f.relativePath === 'memory/2026-03-01.md')
    expect(daily?.category).toBe('daily')
    expect(daily?.label).toContain('Daily Log')
  })

  it('categorizes non-dated files as evergreen', async () => {
    mockExistsSync.mockImplementation((p: string) => p === `${WS}/memory`)
    mockReaddirSync.mockReturnValue(['team-memory.md'])
    mockReadFileSync.mockReturnValue('team stuff')
    mockStatSync.mockReturnValue(fakeStat(300))

    const files = await getMemoryFiles()
    const file = files.find(f => f.relativePath === 'memory/team-memory.md')
    expect(file?.category).toBe('evergreen')
    expect(file?.label).toBe('Team Memory')
  })

  it('labels today\'s daily log specially', async () => {
    const today = new Date().toISOString().slice(0, 10)
    mockExistsSync.mockImplementation((p: string) => p === `${WS}/memory`)
    mockReaddirSync.mockReturnValue([`${today}.md`])
    mockReadFileSync.mockReturnValue('today')
    mockStatSync.mockReturnValue(fakeStat(100))

    const files = await getMemoryFiles()
    expect(files[0].label).toBe('Daily Log (Today)')
  })

  it('labels yesterday\'s daily log specially', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    mockExistsSync.mockImplementation((p: string) => p === `${WS}/memory`)
    mockReaddirSync.mockReturnValue([`${yesterday}.md`])
    mockReadFileSync.mockReturnValue('yesterday')
    mockStatSync.mockReturnValue(fakeStat(100))

    const files = await getMemoryFiles()
    expect(files[0].label).toBe('Daily Log (Yesterday)')
  })

  it('skips directories inside memory/', async () => {
    mockExistsSync.mockImplementation((p: string) => p === `${WS}/memory`)
    mockReaddirSync.mockReturnValue(['subdir'])
    // subdir has no .md/.json extension, so it's skipped
    const files = await getMemoryFiles()
    expect(files).toHaveLength(0)
  })

  it('skips non-md/json files', async () => {
    mockExistsSync.mockImplementation((p: string) => p === `${WS}/memory`)
    mockReaddirSync.mockReturnValue(['image.png', 'notes.txt'])
    const files = await getMemoryFiles()
    expect(files).toHaveLength(0)
  })

  it('handles missing memory/ directory gracefully', async () => {
    mockExistsSync.mockReturnValue(false)
    const files = await getMemoryFiles()
    expect(files).toHaveLength(0)
  })

  it('sorts evergreen before daily', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['2026-03-01.md', 'team-memory.md'])
    mockReadFileSync.mockReturnValue('content')
    mockStatSync.mockReturnValue(fakeStat(100))

    const files = await getMemoryFiles()
    const categories = files.map(f => f.category)
    const firstDaily = categories.indexOf('daily')
    const lastEvergreen = categories.lastIndexOf('evergreen')
    if (firstDaily >= 0 && lastEvergreen >= 0) {
      expect(lastEvergreen).toBeLessThan(firstDaily)
    }
  })

  it('includes JSON files', async () => {
    mockExistsSync.mockImplementation((p: string) => p === `${WS}/memory`)
    mockReaddirSync.mockReturnValue(['team-intel.json'])
    mockReadFileSync.mockReturnValue('{}')
    mockStatSync.mockReturnValue(fakeStat(50))

    const files = await getMemoryFiles()
    expect(files).toHaveLength(1)
    expect(files[0].relativePath).toBe('memory/team-intel.json')
    expect(files[0].label).toBe('Team Intel')
  })
})

// ── getMemoryConfig ─────────────────────────────────────────────

describe('getMemoryConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetAllMocks()
    vi.stubEnv('WORKSPACE_PATH', WS)
  })

  it('returns defaults when openclaw.json does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    const config = getMemoryConfig()
    expect(config.configFound).toBe(false)
    expect(config.memorySearch.hybrid.vectorWeight).toBe(0.7)
    expect(config.memorySearch.hybrid.textWeight).toBe(0.3)
    expect(config.memorySearch.hybrid.temporalDecay.halfLifeDays).toBe(30)
    expect(config.memoryFlush.softThresholdTokens).toBe(80000)
  })

  it('reads config from openclaw.json', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      agents: {
        defaults: {
          memorySearch: {
            enabled: true,
            provider: 'openai',
            model: 'text-embedding-3-small',
            hybrid: {
              vectorWeight: 0.8,
              textWeight: 0.2,
              temporalDecay: { enabled: false, halfLifeDays: 60 },
            },
          },
          compaction: {
            memoryFlush: { enabled: true, softThresholdTokens: 100000 },
          },
        },
      },
    }))

    const config = getMemoryConfig()
    expect(config.configFound).toBe(true)
    expect(config.memorySearch.enabled).toBe(true)
    expect(config.memorySearch.provider).toBe('openai')
    expect(config.memorySearch.hybrid.vectorWeight).toBe(0.8)
    expect(config.memorySearch.hybrid.temporalDecay.enabled).toBe(false)
    expect(config.memorySearch.hybrid.temporalDecay.halfLifeDays).toBe(60)
    expect(config.memoryFlush.enabled).toBe(true)
    expect(config.memoryFlush.softThresholdTokens).toBe(100000)
  })

  it('fills missing nested keys with defaults', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      agents: { defaults: { memorySearch: { enabled: true } } },
    }))

    const config = getMemoryConfig()
    expect(config.configFound).toBe(true)
    expect(config.memorySearch.enabled).toBe(true)
    // Nested defaults preserved
    expect(config.memorySearch.hybrid.vectorWeight).toBe(0.7)
    expect(config.memorySearch.hybrid.mmr.lambda).toBe(0.7)
    expect(config.memorySearch.cache.maxEntries).toBe(256)
  })

  it('returns configFound=false when memorySearch key is absent', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      agents: { defaults: { model: { primary: 'anthropic/claude-sonnet-4-6' } } },
    }))

    const config = getMemoryConfig()
    expect(config.configFound).toBe(false)
  })

  it('handles malformed JSON gracefully', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('not valid {json')

    const config = getMemoryConfig()
    expect(config.configFound).toBe(false)
    expect(config.memorySearch.hybrid.vectorWeight).toBe(0.7)
  })

  it('handles empty agents.defaults gracefully', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({ agents: {} }))

    const config = getMemoryConfig()
    expect(config.configFound).toBe(false)
    expect(config.memorySearch.enabled).toBe(false)
  })
})

// ── getMemoryStatus ─────────────────────────────────────────────

describe('getMemoryStatus', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetAllMocks()
    vi.stubEnv('WORKSPACE_PATH', WS)
    vi.stubEnv('OPENCLAW_BIN', '/usr/local/bin/openclaw')
  })

  it('parses valid JSON status', () => {
    mockExecSync.mockReturnValue(JSON.stringify([{
      agentId: 'main',
      status: {
        files: 9,
        chunks: 42,
        dirty: false,
        provider: 'openai',
        vector: { available: true },
      },
    }]))

    const status = getMemoryStatus()
    expect(status.indexed).toBe(true)
    expect(status.totalEntries).toBe(42)
    expect(status.vectorAvailable).toBe(true)
    expect(status.embeddingProvider).toBe('openai')
  })

  it('falls back to raw text for non-JSON output', () => {
    mockExecSync.mockReturnValue('Memory index: 42 entries, last indexed 2h ago')

    const status = getMemoryStatus()
    expect(status.indexed).toBe(false)
    expect(status.raw).toBe('Memory index: 42 entries, last indexed 2h ago')
  })

  it('handles CLI timeout gracefully', () => {
    mockExecSync.mockImplementation(() => { throw new Error('ETIMEDOUT') })

    const status = getMemoryStatus()
    expect(status.indexed).toBe(false)
    expect(status.raw).toBe('Memory status unavailable')
  })

  it('handles missing OPENCLAW_BIN gracefully', () => {
    vi.stubEnv('OPENCLAW_BIN', '')

    const status = getMemoryStatus()
    expect(status.indexed).toBe(false)
    expect(status.raw).toBe('Memory status unavailable')
  })

  it('handles missing fields in JSON response', () => {
    mockExecSync.mockReturnValue(JSON.stringify([{
      agentId: 'main',
      status: { files: 1, chunks: 1, dirty: false },
    }]))

    const status = getMemoryStatus()
    expect(status.indexed).toBe(true)
    expect(status.lastIndexed).toBeNull()
    expect(status.totalEntries).toBe(1)
  })

  it('reports not indexed when agent has dirty files', () => {
    mockExecSync.mockReturnValue(JSON.stringify([{
      agentId: 'main',
      status: { files: 9, chunks: 13, dirty: true, provider: 'gemini' },
    }]))

    const status = getMemoryStatus()
    expect(status.indexed).toBe(false)
  })

  it('aggregates entries across multiple agents', () => {
    mockExecSync.mockReturnValue(JSON.stringify([
      { agentId: 'main', status: { files: 9, chunks: 13, dirty: false, provider: 'gemini', vector: { available: true } } },
      { agentId: 'courier', status: { files: 2, chunks: 2, dirty: false } },
    ]))

    const status = getMemoryStatus()
    expect(status.indexed).toBe(true)
    expect(status.totalEntries).toBe(15)
  })
})

// ── computeMemoryStats ──────────────────────────────────────────

describe('computeMemoryStats', () => {
  it('computes stats for mixed files', () => {
    const files: MemoryFileInfo[] = [
      { label: 'LTM', path: '/ws/MEMORY.md', relativePath: 'MEMORY.md', content: '', lastModified: '2026-03-01T12:00:00Z', sizeBytes: 1000, category: 'evergreen' },
      { label: 'Team', path: '/ws/memory/team-memory.md', relativePath: 'memory/team-memory.md', content: '', lastModified: '2026-03-01T12:00:00Z', sizeBytes: 500, category: 'evergreen' },
      { label: 'Daily', path: '/ws/memory/2026-03-01.md', relativePath: 'memory/2026-03-01.md', content: '', lastModified: '2026-03-01T12:00:00Z', sizeBytes: 200, category: 'daily' },
      { label: 'Daily', path: '/ws/memory/2026-02-28.md', relativePath: 'memory/2026-02-28.md', content: '', lastModified: '2026-02-28T12:00:00Z', sizeBytes: 300, category: 'daily' },
    ]

    const stats = computeMemoryStats(files)
    expect(stats.totalFiles).toBe(4)
    expect(stats.totalSizeBytes).toBe(2000)
    expect(stats.dailyLogCount).toBe(2)
    expect(stats.evergreenCount).toBe(2)
    expect(stats.oldestDaily).toBe('2026-02-28')
    expect(stats.newestDaily).toBe('2026-03-01')
  })

  it('returns nulls for empty input', () => {
    const stats = computeMemoryStats([])
    expect(stats.totalFiles).toBe(0)
    expect(stats.totalSizeBytes).toBe(0)
    expect(stats.dailyLogCount).toBe(0)
    expect(stats.evergreenCount).toBe(0)
    expect(stats.oldestDaily).toBeNull()
    expect(stats.newestDaily).toBeNull()
    expect(stats.dailyTimeline).toHaveLength(30)
    expect(stats.dailyTimeline.every(d => d === null)).toBe(true)
  })

  it('handles all-evergreen files', () => {
    const files: MemoryFileInfo[] = [
      { label: 'LTM', path: '/ws/MEMORY.md', relativePath: 'MEMORY.md', content: '', lastModified: '2026-03-01T12:00:00Z', sizeBytes: 1000, category: 'evergreen' },
    ]

    const stats = computeMemoryStats(files)
    expect(stats.dailyLogCount).toBe(0)
    expect(stats.evergreenCount).toBe(1)
    expect(stats.oldestDaily).toBeNull()
    expect(stats.newestDaily).toBeNull()
  })

  it('builds 30-day timeline with gaps', () => {
    const today = new Date().toISOString().slice(0, 10)
    const files: MemoryFileInfo[] = [
      { label: 'Today', path: `/ws/memory/${today}.md`, relativePath: `memory/${today}.md`, content: '', lastModified: `${today}T12:00:00Z`, sizeBytes: 400, category: 'daily' },
    ]

    const stats = computeMemoryStats(files)
    expect(stats.dailyTimeline).toHaveLength(30)
    // Last entry should be today's
    const lastEntry = stats.dailyTimeline[29]
    expect(lastEntry).not.toBeNull()
    expect(lastEntry!.date).toBe(today)
    expect(lastEntry!.sizeBytes).toBe(400)
    // Other entries should be null (gaps)
    expect(stats.dailyTimeline.slice(0, 29).filter(d => d !== null).length).toBe(0)
  })

  it('sums sizes correctly', () => {
    const files: MemoryFileInfo[] = [
      { label: 'A', path: '/a.md', relativePath: 'a.md', content: '', lastModified: '', sizeBytes: 100, category: 'evergreen' },
      { label: 'B', path: '/b.md', relativePath: 'b.md', content: '', lastModified: '', sizeBytes: 200, category: 'evergreen' },
      { label: 'C', path: '/c.md', relativePath: 'c.md', content: '', lastModified: '', sizeBytes: 300, category: 'daily' },
    ]

    const stats = computeMemoryStats(files)
    expect(stats.totalSizeBytes).toBe(600)
  })
})
