// @vitest-environment node
/**
 * Setup Scenarios — Tests how ClawPort behaves for fresh users vs existing users.
 *
 * These tests simulate the full resolution chain for each subsystem:
 *   - Agent registry (bundled fallback → auto-discovery → user override)
 *   - Memory (empty workspace → populated workspace)
 *   - Crons (CLI unavailable → CLI returns data)
 *   - Pipelines (no config → pipelines.json present)
 *   - Environment (missing vars → all vars present)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────────────

const { mockReadFileSync, mockExistsSync, mockStatSync, mockReaddirSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockStatSync: vi.fn(),
  mockReaddirSync: vi.fn(),
}))

const { mockExecSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
}))

const { bundledAgents } = vi.hoisted(() => ({
  bundledAgents: [
    {
      id: 'example',
      name: 'Example',
      title: 'Demo Agent',
      reportsTo: null,
      directReports: [],
      soulPath: 'SOUL.md',
      voiceId: null,
      color: '#f5c518',
      emoji: 'E',
      tools: ['read', 'write'],
      memoryPath: null,
      description: 'Bundled example agent.',
    },
  ],
}))

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
  statSync: mockStatSync,
  readdirSync: mockReaddirSync,
  default: {
    readFileSync: mockReadFileSync,
    existsSync: mockExistsSync,
    statSync: mockStatSync,
    readdirSync: mockReaddirSync,
  },
}))

vi.mock('child_process', () => ({
  execSync: mockExecSync,
  default: { execSync: mockExecSync },
}))

vi.mock('@/lib/agents.json', () => ({
  default: bundledAgents,
}))

// ── Imports (after mocks) ─────────────────────────────────────────

import { getAgents } from './agents'
import { loadRegistry } from './agents-registry'
import { getMemoryFiles, getMemoryConfig, getMemoryStatus, computeMemoryStats } from './memory'
import { requireEnv } from './env'
import { loadPipelines } from './cron-pipelines.server'

// ── Helpers ───────────────────────────────────────────────────────

const WS = '/home/user/.openclaw/workspace'

function fakeStat(size: number, mtime?: Date) {
  return {
    size,
    mtime: mtime ?? new Date('2026-03-01T12:00:00Z'),
    isFile: () => true,
  }
}

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 1: FRESH USER — No OpenClaw installation at all
// ═══════════════════════════════════════════════════════════════════

describe('Fresh user (no OpenClaw installed)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    // Fresh user: no env vars set, no files on disk
    mockExistsSync.mockReturnValue(false)
    mockReaddirSync.mockReturnValue([])
  })

  describe('environment', () => {
    it('requireEnv throws for WORKSPACE_PATH', () => {
      expect(() => requireEnv('WORKSPACE_PATH')).toThrow('Missing required environment variable')
    })

    it('requireEnv throws for OPENCLAW_BIN', () => {
      expect(() => requireEnv('OPENCLAW_BIN')).toThrow('Missing required environment variable')
    })

    it('requireEnv throws for OPENCLAW_GATEWAY_TOKEN', () => {
      expect(() => requireEnv('OPENCLAW_GATEWAY_TOKEN')).toThrow('Missing required environment variable')
    })
  })

  describe('agent registry', () => {
    it('falls back to bundled agents when no WORKSPACE_PATH', async () => {
      vi.stubEnv('WORKSPACE_PATH', '')
      const agents = await getAgents()
      expect(agents.length).toBe(bundledAgents.length)
      expect(agents[0].id).toBe('example')
      expect(agents[0].name).toBe('Example')
    })

    it('bundled agents have soul=null (no workspace to read from)', async () => {
      vi.stubEnv('WORKSPACE_PATH', '')
      const agents = await getAgents()
      for (const agent of agents) {
        expect(agent.soul).toBeNull()
      }
    })

    it('bundled agents have empty crons array', async () => {
      vi.stubEnv('WORKSPACE_PATH', '')
      const agents = await getAgents()
      for (const agent of agents) {
        expect(agent.crons).toEqual([])
      }
    })
  })

  describe('memory', () => {
    it('getMemoryFiles throws without WORKSPACE_PATH', async () => {
      vi.stubEnv('WORKSPACE_PATH', '')
      await expect(getMemoryFiles()).rejects.toThrow('Missing required environment variable')
    })

    it('getMemoryConfig throws without WORKSPACE_PATH', () => {
      vi.stubEnv('WORKSPACE_PATH', '')
      expect(() => getMemoryConfig()).toThrow('Missing required environment variable')
    })

    it('getMemoryStatus returns defaults without OPENCLAW_BIN', () => {
      vi.stubEnv('OPENCLAW_BIN', '')
      const status = getMemoryStatus()
      expect(status.indexed).toBe(false)
      expect(status.raw).toBe('Memory status unavailable')
    })
  })

  describe('pipelines', () => {
    it('loadPipelines returns empty array without WORKSPACE_PATH', () => {
      vi.stubEnv('WORKSPACE_PATH', '')
      const pipelines = loadPipelines()
      expect(pipelines).toEqual([])
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 2: PARTIAL USER — OpenClaw installed, setup not run yet
// ═══════════════════════════════════════════════════════════════════

describe('Partial user (OpenClaw installed, no ClawPort config)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.stubEnv('WORKSPACE_PATH', WS)
    vi.stubEnv('OPENCLAW_BIN', '/usr/local/bin/openclaw')
    vi.stubEnv('OPENCLAW_GATEWAY_TOKEN', 'tok_test_12345')
    mockExistsSync.mockReturnValue(false)
    mockReaddirSync.mockReturnValue([])
  })

  describe('agent registry — empty workspace', () => {
    it('no agents/ dir and no SOUL.md → uses bundled fallback', async () => {
      const agents = await getAgents()
      expect(agents.length).toBe(bundledAgents.length)
      expect(agents[0].id).toBe('example')
    })

    it('empty agents/ dir → uses bundled fallback', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (p === `${WS}/agents`) return true
        return false
      })
      mockReaddirSync.mockReturnValue([])

      const registry = loadRegistry()
      expect(registry.length).toBe(bundledAgents.length)
    })
  })

  describe('agent registry — workspace with only root SOUL.md', () => {
    it('root SOUL.md only → discovers single root orchestrator', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (p === `${WS}/clawport/agents.json`) return false
        if (p === `${WS}/SOUL.md`) return true
        if (p === `${WS}/IDENTITY.md`) return false
        if (p === `${WS}/agents`) return true
        return false
      })
      mockReaddirSync.mockReturnValue([])
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === `${WS}/SOUL.md`) return '# SOUL.md — MyAssistant\nI am helpful.'
        throw new Error('ENOENT')
      })

      const agents = await getAgents()
      expect(agents.length).toBe(1)
      expect(agents[0].name).toBe('MyAssistant')
      expect(agents[0].title).toBe('总协调者')
      expect(agents[0].reportsTo).toBeNull()
    })
  })

  describe('memory — empty workspace', () => {
    it('no MEMORY.md and no memory/ dir → returns empty array', async () => {
      const files = await getMemoryFiles()
      expect(files).toEqual([])
    })

    it('computeMemoryStats on empty files → all zeros', () => {
      const stats = computeMemoryStats([])
      expect(stats.totalFiles).toBe(0)
      expect(stats.totalSizeBytes).toBe(0)
      expect(stats.dailyLogCount).toBe(0)
      expect(stats.evergreenCount).toBe(0)
    })
  })

  describe('memory config — no openclaw.json', () => {
    it('returns defaults with configFound=false', () => {
      const config = getMemoryConfig()
      expect(config.configFound).toBe(false)
      expect(config.memorySearch.enabled).toBe(false)
      expect(config.memorySearch.hybrid.vectorWeight).toBe(0.7)
      expect(config.memorySearch.hybrid.temporalDecay.halfLifeDays).toBe(30)
      expect(config.memoryFlush.enabled).toBe(false)
    })
  })

  describe('memory status — CLI not responding', () => {
    it('handles CLI command failure gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found: openclaw')
      })
      const status = getMemoryStatus()
      expect(status.indexed).toBe(false)
      expect(status.raw).toBe('Memory status unavailable')
    })
  })

  describe('pipelines — no pipelines.json', () => {
    it('returns empty array when pipelines.json does not exist', () => {
      const pipelines = loadPipelines()
      expect(pipelines).toEqual([])
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 3: EXISTING USER — Fully configured workspace
// ═══════════════════════════════════════════════════════════════════

describe('Existing user (fully configured workspace)', () => {
  const OPENCLAW_BIN = '/usr/local/bin/openclaw'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.stubEnv('WORKSPACE_PATH', WS)
    vi.stubEnv('OPENCLAW_BIN', OPENCLAW_BIN)
    vi.stubEnv('OPENCLAW_GATEWAY_TOKEN', 'oc_tok_abc123xyz')
    mockExistsSync.mockReturnValue(false)
    mockReaddirSync.mockReturnValue([])
  })

  describe('agent registry — user override (clawport/agents.json)', () => {
    const customAgents = [
      {
        id: 'orchestrator',
        name: 'Commander',
        title: 'Lead Agent',
        reportsTo: null,
        directReports: ['worker-a', 'worker-b'],
        soulPath: 'SOUL.md',
        voiceId: null,
        color: '#e11d48',
        emoji: 'C',
        tools: ['exec', 'read', 'write', 'message'],
        memoryPath: null,
        description: 'Top-level orchestrator.',
      },
      {
        id: 'worker-a',
        name: 'Alpha',
        title: 'Research Agent',
        reportsTo: 'orchestrator',
        directReports: [],
        soulPath: 'agents/alpha/SOUL.md',
        voiceId: null,
        color: '#3b82f6',
        emoji: 'A',
        tools: ['web_search', 'read'],
        memoryPath: null,
        description: 'Research specialist.',
      },
      {
        id: 'worker-b',
        name: 'Beta',
        title: 'Writer Agent',
        reportsTo: 'orchestrator',
        directReports: [],
        soulPath: 'agents/beta/SOUL.md',
        voiceId: null,
        color: '#22c55e',
        emoji: 'B',
        tools: ['read', 'write'],
        memoryPath: null,
        description: 'Content writer.',
      },
    ]

    it('loads custom agents from workspace override', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (p === `${WS}/clawport/agents.json`) return true
        if (p.endsWith('SOUL.md')) return true
        return false
      })
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === `${WS}/clawport/agents.json`) return JSON.stringify(customAgents)
        if (p.endsWith('SOUL.md')) return '# Agent SOUL content\nI do things.'
        throw new Error('ENOENT')
      })

      const agents = await getAgents()
      expect(agents.length).toBe(3)
      expect(agents.map(a => a.id)).toEqual(['orchestrator', 'worker-a', 'worker-b'])
    })

    it('reads SOUL.md content for each agent', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (p === `${WS}/clawport/agents.json`) return true
        if (p.endsWith('SOUL.md')) return true
        return false
      })
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === `${WS}/clawport/agents.json`) return JSON.stringify(customAgents)
        if (p === `${WS}/SOUL.md`) return '# Commander\nI orchestrate.'
        if (p === `${WS}/agents/alpha/SOUL.md`) return '# ALPHA\nI research.'
        if (p === `${WS}/agents/beta/SOUL.md`) return '# BETA\nI write.'
        throw new Error('ENOENT')
      })

      const agents = await getAgents()
      const cmd = agents.find(a => a.id === 'orchestrator')!
      expect(cmd.soul).toBe('# Commander\nI orchestrate.')
      const alpha = agents.find(a => a.id === 'worker-a')!
      expect(alpha.soul).toBe('# ALPHA\nI research.')
    })

    it('preserves hierarchy structure', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (p === `${WS}/clawport/agents.json`) return true
        return false
      })
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === `${WS}/clawport/agents.json`) return JSON.stringify(customAgents)
        throw new Error('ENOENT')
      })

      const agents = await getAgents()
      const root = agents.find(a => a.reportsTo === null)!
      expect(root.id).toBe('orchestrator')
      expect(root.directReports).toEqual(['worker-a', 'worker-b'])

      const workerA = agents.find(a => a.id === 'worker-a')!
      expect(workerA.reportsTo).toBe('orchestrator')
    })
  })

  describe('agent registry — auto-discovery (no agents.json, has agents/ dir)', () => {
    it('discovers full hierarchy with root + agents + sub-agents', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (p === `${WS}/clawport/agents.json`) return false
        if (p === `${WS}/SOUL.md`) return true
        if (p === `${WS}/IDENTITY.md`) return true
        if (p === `${WS}/agents`) return true
        if (p === `${WS}/agents/research/SOUL.md`) return true
        if (p === `${WS}/agents/research/sub-agents`) return true
        if (p === `${WS}/agents/research/sub-agents/SCOUT.md`) return true
        if (p === `${WS}/agents/research/members`) return false
        if (p === `${WS}/agents/content/SOUL.md`) return true
        if (p === `${WS}/agents/content/sub-agents`) return false
        if (p === `${WS}/agents/content/members`) return true
        if (p === `${WS}/agents/content/members/WRITER.md`) return true
        return false
      })

      mockReaddirSync.mockImplementation((p: string | { toString(): string }, opts?: unknown) => {
        const path = typeof p === 'string' ? p : p.toString()
        if (path === `${WS}/agents`) {
          return [
            { name: 'research', isDirectory: () => true },
            { name: 'content', isDirectory: () => true },
          ]
        }
        if (path === `${WS}/agents/research/sub-agents`) return ['SCOUT.md']
        if (path === `${WS}/agents/content/members`) return ['WRITER.md']
        return []
      })

      mockReadFileSync.mockImplementation((p: string) => {
        if (p === `${WS}/IDENTITY.md`) return '- **Name:** Atlas\n- **Emoji:** 🌐'
        if (p === `${WS}/SOUL.md`) return '# SOUL.md - Who You Are\nYou are Atlas.'
        if (p === `${WS}/agents/research/SOUL.md`) return '# SOUL.md — VERA, Chief Strategy Officer'
        if (p === `${WS}/agents/content/SOUL.md`) return '# HERALD — Content Director'
        if (p === `${WS}/agents/research/sub-agents/SCOUT.md`) return '# SCOUT — Trend Finder'
        if (p === `${WS}/agents/content/members/WRITER.md`) return '# QUILL — Blog Writer'
        throw new Error('ENOENT')
      })

      const agents = await getAgents()

      // Root agent from IDENTITY.md
      const root = agents.find(a => a.reportsTo === null)!
      expect(root.name).toBe('Atlas')
      expect(root.emoji).toBe('🌐')
      expect(root.id).toBe('atlas')

      // Research agent
      const vera = agents.find(a => a.id === 'research')!
      expect(vera.name).toBe('VERA')
      expect(vera.title).toBe('Chief Strategy Officer')
      expect(vera.reportsTo).toBe('atlas')

      // Content agent
      const herald = agents.find(a => a.id === 'content')!
      expect(herald.name).toBe('HERALD')
      expect(herald.title).toBe('Content Director')
      expect(herald.reportsTo).toBe('atlas')

      // Sub-agents
      const scout = agents.find(a => a.id === 'research-scout')!
      expect(scout.name).toBe('SCOUT')
      expect(scout.title).toBe('Trend Finder')
      expect(scout.reportsTo).toBe('research')

      // Sub-agent ID is derived from filename (WRITER.md → content-writer)
      const writer = agents.find(a => a.id === 'content-writer')!
      expect(writer.name).toBe('QUILL') // name from heading, not filename
      expect(writer.title).toBe('Blog Writer')
      expect(writer.reportsTo).toBe('content')
    })
  })

  describe('memory — populated workspace', () => {
    it('discovers all memory files from root and memory/ dir', async () => {
      const today = new Date().toISOString().slice(0, 10)
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

      mockExistsSync.mockImplementation((p: string) => {
        if (p === `${WS}/MEMORY.md`) return true
        if (p === `${WS}/memory`) return true
        return false
      })
      mockReaddirSync.mockReturnValue([
        `${today}.md`,
        `${yesterday}.md`,
        'team-memory.md',
        'debugging.md',
      ])
      mockReadFileSync.mockReturnValue('# Content')
      mockStatSync.mockReturnValue(fakeStat(512))

      const files = await getMemoryFiles()

      // 1 root MEMORY.md + 4 memory/ files = 5
      expect(files.length).toBe(5)

      // Evergreen files sorted first
      const categories = files.map(f => f.category)
      const firstDailyIdx = categories.indexOf('daily')
      const lastEvergreenIdx = categories.lastIndexOf('evergreen')
      expect(lastEvergreenIdx).toBeLessThan(firstDailyIdx)

      // Root memory has special label
      const rootMemory = files.find(f => f.relativePath === 'MEMORY.md')
      expect(rootMemory?.label).toBe('Long-Term Memory')

      // Today's log has special label
      const todayLog = files.find(f => f.relativePath === `memory/${today}.md`)
      expect(todayLog?.label).toBe('Daily Log (Today)')

      // Yesterday's log has special label
      const yesterdayLog = files.find(f => f.relativePath === `memory/${yesterday}.md`)
      expect(yesterdayLog?.label).toBe('Daily Log (Yesterday)')

      // Evergreen files use humanized names
      const teamMemory = files.find(f => f.relativePath === 'memory/team-memory.md')
      expect(teamMemory?.label).toBe('Team Memory')
      expect(teamMemory?.category).toBe('evergreen')
    })

    it('computeMemoryStats reflects full workspace', () => {
      const today = new Date().toISOString().slice(0, 10)
      const files = [
        { label: 'LTM', path: `${WS}/MEMORY.md`, relativePath: 'MEMORY.md', content: '# Memory', lastModified: '2026-03-01T12:00:00Z', sizeBytes: 2048, category: 'evergreen' as const },
        { label: 'Team', path: `${WS}/memory/team-memory.md`, relativePath: 'memory/team-memory.md', content: '', lastModified: '2026-03-01T12:00:00Z', sizeBytes: 1024, category: 'evergreen' as const },
        { label: 'Today', path: `${WS}/memory/${today}.md`, relativePath: `memory/${today}.md`, content: '', lastModified: `${today}T12:00:00Z`, sizeBytes: 256, category: 'daily' as const },
        { label: 'Yesterday', path: `${WS}/memory/2026-03-03.md`, relativePath: 'memory/2026-03-03.md', content: '', lastModified: '2026-03-03T12:00:00Z', sizeBytes: 384, category: 'daily' as const },
      ]

      const stats = computeMemoryStats(files)
      expect(stats.totalFiles).toBe(4)
      expect(stats.totalSizeBytes).toBe(2048 + 1024 + 256 + 384)
      expect(stats.evergreenCount).toBe(2)
      expect(stats.dailyLogCount).toBe(2)
      expect(stats.dailyTimeline).toHaveLength(30)
    })
  })

  describe('memory config — openclaw.json with memory search enabled', () => {
    it('reads and merges memory search config', () => {
      // openclaw.json is in the parent of the workspace dir
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(JSON.stringify({
        agents: {
          defaults: {
            memorySearch: {
              enabled: true,
              provider: 'openai',
              model: 'text-embedding-3-small',
              hybrid: {
                enabled: true,
                vectorWeight: 0.8,
                textWeight: 0.2,
                temporalDecay: { enabled: true, halfLifeDays: 14 },
                mmr: { enabled: true, lambda: 0.6 },
              },
              cache: { enabled: true, maxEntries: 512 },
            },
            compaction: {
              memoryFlush: { enabled: true, softThresholdTokens: 60000 },
            },
          },
        },
      }))

      const config = getMemoryConfig()
      expect(config.configFound).toBe(true)
      expect(config.memorySearch.enabled).toBe(true)
      expect(config.memorySearch.provider).toBe('openai')
      expect(config.memorySearch.model).toBe('text-embedding-3-small')
      expect(config.memorySearch.hybrid.vectorWeight).toBe(0.8)
      expect(config.memorySearch.hybrid.temporalDecay.halfLifeDays).toBe(14)
      expect(config.memorySearch.hybrid.mmr.lambda).toBe(0.6)
      expect(config.memorySearch.cache.maxEntries).toBe(512)
      expect(config.memoryFlush.enabled).toBe(true)
      expect(config.memoryFlush.softThresholdTokens).toBe(60000)
    })
  })

  describe('memory status — CLI returns JSON', () => {
    it('parses full memory status from CLI', () => {
      vi.stubEnv('OPENCLAW_BIN', OPENCLAW_BIN)
      mockExecSync.mockReturnValue(JSON.stringify({
        indexed: true,
        lastIndexed: '2026-03-04T08:00:00Z',
        totalEntries: 128,
        vectorAvailable: true,
        embeddingProvider: 'openai',
      }))

      const status = getMemoryStatus()
      expect(status.indexed).toBe(true)
      expect(status.lastIndexed).toBe('2026-03-04T08:00:00Z')
      expect(status.totalEntries).toBe(128)
      expect(status.vectorAvailable).toBe(true)
      expect(status.embeddingProvider).toBe('openai')
    })
  })

  describe('pipelines — pipelines.json configured', () => {
    it('loads pipeline definitions from workspace', () => {
      const pipelineData = [
        {
          name: 'daily-report',
          edges: [
            { from: 'scout-daily', to: 'vera-daily-review', artifact: 'scout-report.md' },
            { from: 'vera-daily-review', to: 'herald-publish', artifact: 'reviewed-report.md' },
          ],
        },
      ]

      mockExistsSync.mockImplementation((p: string) => {
        if (p === `${WS}/clawport/pipelines.json`) return true
        return false
      })
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === `${WS}/clawport/pipelines.json`) return JSON.stringify(pipelineData)
        throw new Error('ENOENT')
      })

      const pipelines = loadPipelines()
      expect(pipelines).toHaveLength(1)
      expect(pipelines[0].name).toBe('daily-report')
      expect(pipelines[0].edges).toHaveLength(2)
    })

    it('handles malformed pipelines.json gracefully', () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (p === `${WS}/clawport/pipelines.json`) return true
        return false
      })
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === `${WS}/clawport/pipelines.json`) return '{ broken json'
        throw new Error('ENOENT')
      })

      const pipelines = loadPipelines()
      expect(pipelines).toEqual([])
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 4: TRANSITION — User going from fresh to configured
// ═══════════════════════════════════════════════════════════════════

describe('Transition scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('agents upgrade from bundled → auto-discovery when SOUL.md appears', async () => {
    // Phase 1: No workspace → bundled
    vi.stubEnv('WORKSPACE_PATH', '')
    mockExistsSync.mockReturnValue(false)
    const bundled = await getAgents()
    expect(bundled.length).toBe(bundledAgents.length)
    expect(bundled[0].id).toBe('example')

    // Phase 2: Workspace created with agents → auto-discovery
    vi.stubEnv('WORKSPACE_PATH', WS)
    mockExistsSync.mockImplementation((p: string) => {
      if (p === `${WS}/clawport/agents.json`) return false
      if (p === `${WS}/SOUL.md`) return true
      if (p === `${WS}/IDENTITY.md`) return false
      if (p === `${WS}/agents`) return true
      if (p === `${WS}/agents/helper/SOUL.md`) return true
      if (p === `${WS}/agents/helper/sub-agents`) return false
      if (p === `${WS}/agents/helper/members`) return false
      return false
    })
    mockReaddirSync.mockReturnValue([
      { name: 'helper', isDirectory: () => true },
    ])
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === `${WS}/SOUL.md`) return '# SOUL.md — MyBot\nI help.'
      if (p === `${WS}/agents/helper/SOUL.md`) return '# Helper — Task Assistant\nI assist.'
      throw new Error('ENOENT')
    })

    const discovered = await getAgents()
    expect(discovered.length).toBe(2)
    expect(discovered.map(a => a.id)).toContain('mybot')
    expect(discovered.map(a => a.id)).toContain('helper')
  })

  it('agents upgrade from auto-discovery → user override when agents.json appears', async () => {
    vi.stubEnv('WORKSPACE_PATH', WS)

    // Phase 1: Auto-discovery
    mockExistsSync.mockImplementation((p: string) => {
      if (p === `${WS}/clawport/agents.json`) return false
      if (p === `${WS}/SOUL.md`) return false
      if (p === `${WS}/agents`) return true
      if (p === `${WS}/agents/bot/SOUL.md`) return true
      if (p === `${WS}/agents/bot/sub-agents`) return false
      if (p === `${WS}/agents/bot/members`) return false
      return false
    })
    mockReaddirSync.mockReturnValue([
      { name: 'bot', isDirectory: () => true },
    ])
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === `${WS}/agents/bot/SOUL.md`) return '# Bot\nContent.'
      throw new Error('ENOENT')
    })

    const auto = await getAgents()
    expect(auto.length).toBe(1)
    expect(auto[0].id).toBe('bot')

    // Phase 2: User drops agents.json → override
    const customAgents = [
      { id: 'custom-root', name: 'Root', title: 'Boss', reportsTo: null, directReports: [], soulPath: null, voiceId: null, color: '#ff0000', emoji: 'R', tools: ['exec'], memoryPath: null, description: 'Boss.' },
    ]
    mockExistsSync.mockImplementation((p: string) => {
      if (p === `${WS}/clawport/agents.json`) return true
      return false
    })
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === `${WS}/clawport/agents.json`) return JSON.stringify(customAgents)
      throw new Error('ENOENT')
    })

    const overridden = await getAgents()
    expect(overridden.length).toBe(1)
    expect(overridden[0].id).toBe('custom-root')
    expect(overridden[0].name).toBe('Root')
  })

  it('memory grows as user accumulates daily logs', () => {
    const today = new Date().toISOString().slice(0, 10)
    const d1 = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const d2 = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10)

    // Day 1: only MEMORY.md
    const day1Files = [
      { label: 'LTM', path: `${WS}/MEMORY.md`, relativePath: 'MEMORY.md', content: '# Fresh memory', lastModified: d2, sizeBytes: 100, category: 'evergreen' as const },
    ]
    const stats1 = computeMemoryStats(day1Files)
    expect(stats1.totalFiles).toBe(1)
    expect(stats1.dailyLogCount).toBe(0)
    expect(stats1.evergreenCount).toBe(1)

    // Day 3: MEMORY.md + 2 daily logs
    const day3Files = [
      ...day1Files,
      { label: 'Daily', path: `${WS}/memory/${d1}.md`, relativePath: `memory/${d1}.md`, content: '', lastModified: d1, sizeBytes: 200, category: 'daily' as const },
      { label: 'Daily', path: `${WS}/memory/${today}.md`, relativePath: `memory/${today}.md`, content: '', lastModified: today, sizeBytes: 300, category: 'daily' as const },
    ]
    const stats3 = computeMemoryStats(day3Files)
    expect(stats3.totalFiles).toBe(3)
    expect(stats3.dailyLogCount).toBe(2)
    expect(stats3.totalSizeBytes).toBe(600)
  })
})
