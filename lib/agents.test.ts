// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockReadFileSync, mockExistsSync, mockReaddirSync, mockExecSync, bundledAgents } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockExecSync: vi.fn(),
  bundledAgents: [
    {
      id: 'jarvis',
      name: 'Jarvis',
      title: 'Orchestrator',
      reportsTo: null,
      directReports: ['vera', 'lumen', 'pulse'],
      soulPath: 'SOUL.md',
      voiceId: 'agL69Vji082CshT65Tcy',
      color: '#f5c518',
      emoji: 'R',
      tools: ['exec', 'read', 'write'],
      memoryPath: null,
      description: 'Top-level orchestrator.',
    },
    {
      id: 'vera',
      name: 'VERA',
      title: 'Chief Strategy Officer',
      reportsTo: 'jarvis',
      directReports: ['robin'],
      soulPath: 'agents/vera/SOUL.md',
      voiceId: 'EAHourGM2PqzHHl0Ywjp',
      color: '#a855f7',
      emoji: 'P',
      tools: ['web_search', 'read'],
      memoryPath: null,
      description: 'CSO. Decides what gets built.',
    },
    {
      id: 'robin',
      name: 'Robin',
      title: 'Field Intel Operator',
      reportsTo: 'vera',
      directReports: [],
      soulPath: 'agents/robin/SOUL.md',
      voiceId: null,
      color: '#3b82f6',
      emoji: 'E',
      tools: ['web_search'],
      memoryPath: null,
      description: 'Field operator.',
    },
    {
      id: 'lumen',
      name: 'LUMEN',
      title: 'SEO Team Director',
      reportsTo: 'jarvis',
      directReports: ['scout'],
      soulPath: 'agents/seo-team/SOUL.md',
      voiceId: null,
      color: '#22c55e',
      emoji: 'L',
      tools: ['web_search', 'read'],
      memoryPath: null,
      description: 'SEO Team Director.',
    },
    {
      id: 'scout',
      name: 'SCOUT',
      title: 'Content Scout',
      reportsTo: 'lumen',
      directReports: [],
      soulPath: null,
      voiceId: null,
      color: '#86efac',
      emoji: 'S',
      tools: ['web_search'],
      memoryPath: null,
      description: 'Scouts trending topics.',
    },
    {
      id: 'pulse',
      name: 'Pulse',
      title: 'Trend Radar',
      reportsTo: 'jarvis',
      directReports: [],
      soulPath: 'agents/pulse/SOUL.md',
      voiceId: null,
      color: '#eab308',
      emoji: 'W',
      tools: ['web_search'],
      memoryPath: null,
      description: 'Hype radar.',
    },
    {
      id: 'kaze',
      name: 'KAZE',
      title: 'Japan Flight Monitor',
      reportsTo: 'jarvis',
      directReports: [],
      soulPath: null,
      voiceId: null,
      color: '#60a5fa',
      emoji: 'A',
      tools: ['web_fetch'],
      memoryPath: null,
      description: 'Monitors flights.',
    },
  ],
}))

// Mock fs (Dependency Inversion -- no real file system access in tests)
vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  default: { readFileSync: mockReadFileSync, existsSync: mockExistsSync, readdirSync: mockReaddirSync },
}))

// Mock child_process for CLI discovery
vi.mock('child_process', () => ({
  execSync: mockExecSync,
  default: { execSync: mockExecSync },
}))

// Mock the bundled agents.json
vi.mock('@/lib/agents.json', () => ({
  default: bundledAgents,
}))

// We need to import AFTER mocks are set up
import { getAgents, getAgent } from './agents'
import { parseSoulHeading, parseIdentity } from './agents-registry'

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  // Default: no files exist on disk, no directories
  mockExistsSync.mockReturnValue(false)
  mockReaddirSync.mockReturnValue([])
})

// ---------------------------------------------------------------------------
// parseSoulHeading -- heading extraction unit tests
// ---------------------------------------------------------------------------

describe('parseSoulHeading', () => {
  it('strips "SOUL.md — " prefix', () => {
    const result = parseSoulHeading('# SOUL.md — VERA\nContent here')
    expect(result.name).toBe('VERA')
    expect(result.title).toBeNull()
  })

  it('strips "SOUL.md - " prefix (regular dash)', () => {
    const result = parseSoulHeading('# SOUL.md - HERALD\nContent')
    expect(result.name).toBe('HERALD')
  })

  it('returns null name for generic "Who You Are" heading', () => {
    const result = parseSoulHeading('# SOUL.md - Who You Are\nContent')
    expect(result.name).toBeNull()
    expect(result.title).toBeNull()
  })

  it('parses name and title from em-dash separated heading', () => {
    const result = parseSoulHeading('# ECHO — Community Voice Monitor\nContent')
    expect(result.name).toBe('ECHO')
    expect(result.title).toBe('Community Voice Monitor')
  })

  it('parses name and title from comma-separated heading after prefix strip', () => {
    const result = parseSoulHeading('# SOUL.md — KAZE, Flight Research Agent\nContent')
    expect(result.name).toBe('KAZE')
    expect(result.title).toBe('Flight Research Agent')
  })

  it('parses name and title from "LUMEN, SEO Team Director" after prefix strip', () => {
    const result = parseSoulHeading('# SOUL.md — LUMEN, SEO Team Director\nContent')
    expect(result.name).toBe('LUMEN')
    expect(result.title).toBe('SEO Team Director')
  })

  it('parses clean heading without prefix', () => {
    const result = parseSoulHeading('# CARTOGRAPHER — Keyword Territory Agent\nContent')
    expect(result.name).toBe('CARTOGRAPHER')
    expect(result.title).toBe('Keyword Territory Agent')
  })

  it('parses sub-agent heading', () => {
    const result = parseSoulHeading('# QUILL — Herald\'s Content Writer\n## Role')
    expect(result.name).toBe('QUILL')
    expect(result.title).toBe('Herald\'s Content Writer')
  })

  it('returns null for content with no heading', () => {
    const result = parseSoulHeading('No heading here, just text.')
    expect(result.name).toBeNull()
    expect(result.title).toBeNull()
  })

  it('handles en-dash separator', () => {
    const result = parseSoulHeading('# AGENT – Task Runner\nContent')
    expect(result.name).toBe('AGENT')
    expect(result.title).toBe('Task Runner')
  })

  it('handles simple name with no separator', () => {
    const result = parseSoulHeading('# MyBot\nContent')
    expect(result.name).toBe('MyBot')
    expect(result.title).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseIdentity
// ---------------------------------------------------------------------------

describe('parseIdentity', () => {
  it('extracts name and emoji from IDENTITY.md format', () => {
    const content = `# IDENTITY.md - Who Am I?

- **Name:** Jarvis
- **Creature:** AI assistant
- **Emoji:** 🤖`
    const result = parseIdentity(content)
    expect(result.name).toBe('Jarvis')
    expect(result.emoji).toBe('🤖')
  })

  it('returns nulls when fields are missing', () => {
    const result = parseIdentity('# Just a heading\nNo identity fields here.')
    expect(result.name).toBeNull()
    expect(result.emoji).toBeNull()
  })

  it('handles name without emoji', () => {
    const result = parseIdentity('- **Name:** CustomBot')
    expect(result.name).toBe('CustomBot')
    expect(result.emoji).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Registry loading: bundled fallback vs workspace override vs auto-discovery
// ---------------------------------------------------------------------------

describe('agent registry loading', () => {
  it('loads from bundled JSON when WORKSPACE_PATH is not set', async () => {
    vi.stubEnv('WORKSPACE_PATH', '')
    const agents = await getAgents()
    expect(agents.length).toBe(bundledAgents.length)
    expect(agents.map(a => a.id)).toContain('jarvis')
  })

  it('loads from bundled JSON when workspace override file does not exist', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')
    mockExistsSync.mockReturnValue(false)
    const agents = await getAgents()
    expect(agents.length).toBe(bundledAgents.length)
  })

  it('loads from workspace override when clawport/agents.json exists', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')

    const customAgents = [
      {
        id: 'custom-bot',
        name: 'CustomBot',
        title: 'Custom Agent',
        reportsTo: null,
        directReports: [],
        soulPath: null,
        voiceId: null,
        color: '#ff0000',
        emoji: 'C',
        tools: ['read'],
        memoryPath: null,
        description: 'A custom agent.',
      },
    ]

    mockExistsSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/clawport/agents.json') return true
      return false
    })
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/clawport/agents.json') {
        return JSON.stringify(customAgents)
      }
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    expect(agents.length).toBe(1)
    expect(agents[0].id).toBe('custom-bot')
    expect(agents[0].name).toBe('CustomBot')
  })

  it('falls back to bundled JSON when workspace agents.json is malformed', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')

    mockExistsSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/clawport/agents.json') return true
      return false
    })
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/clawport/agents.json') {
        return '{ invalid json !!!'
      }
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    expect(agents.length).toBe(bundledAgents.length)
    expect(agents.map(a => a.id)).toContain('jarvis')
  })

  it('falls back to bundled JSON when workspace agents.json read throws', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')

    mockExistsSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/clawport/agents.json') return true
      return false
    })
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/clawport/agents.json') {
        throw new Error('EACCES')
      }
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    expect(agents.length).toBe(bundledAgents.length)
  })

  it('prioritizes user override over auto-discovery', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    const customAgents = [
      { id: 'custom', name: 'Custom', title: 'Agent', reportsTo: null, directReports: [], soulPath: null, voiceId: null, color: '#ff0000', emoji: 'C', tools: ['read'], memoryPath: null, description: 'Custom.' },
    ]

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return true
      if (p === '/tmp/ws/SOUL.md') return true
      if (p === '/tmp/ws/agents') return true
      return false
    })
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return JSON.stringify(customAgents)
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    expect(agents).toHaveLength(1)
    expect(agents[0].id).toBe('custom')
  })
})

// ---------------------------------------------------------------------------
// Auto-discovery from workspace
// ---------------------------------------------------------------------------

describe('auto-discovery from workspace', () => {
  it('discovers agents and uses IDENTITY.md for root name/emoji', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return true
      if (p === '/tmp/ws/IDENTITY.md') return true
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/echo/SOUL.md') return true
      if (p === '/tmp/ws/agents/echo/sub-agents') return false
      if (p === '/tmp/ws/agents/echo/members') return false
      return false
    })

    mockReaddirSync.mockReturnValue([
      { name: 'echo', isDirectory: () => true },
    ])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/IDENTITY.md') return '- **Name:** Jarvis\n- **Emoji:** 🤖'
      if (p === '/tmp/ws/SOUL.md') return '# SOUL.md - Who You Are\nContent'
      if (p === '/tmp/ws/agents/echo/SOUL.md') return '# ECHO — Community Voice Monitor\nContent'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    const root = agents.find(a => a.reportsTo === null)!
    expect(root.name).toBe('Jarvis')
    expect(root.id).toBe('jarvis')
    expect(root.emoji).toBe('🤖')
    expect(root.directReports).toContain('echo')

    const echo = agents.find(a => a.id === 'echo')!
    expect(echo.name).toBe('ECHO')
    expect(echo.title).toBe('Community Voice Monitor')
    expect(echo.reportsTo).toBe('jarvis')
  })

  it('falls back to SOUL.md heading when IDENTITY.md is missing', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/IDENTITY.md') return false
      if (p === '/tmp/ws/SOUL.md') return true
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/bot/SOUL.md') return true
      if (p === '/tmp/ws/agents/bot/sub-agents') return false
      if (p === '/tmp/ws/agents/bot/members') return false
      return false
    })

    mockReaddirSync.mockReturnValue([
      { name: 'bot', isDirectory: () => true },
    ])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/SOUL.md') return '# SOUL.md — MyBot\nContent'
      if (p === '/tmp/ws/agents/bot/SOUL.md') return '# Bot Agent\nContent'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    const root = agents.find(a => a.reportsTo === null)!
    expect(root.name).toBe('MyBot')
    expect(root.id).toBe('mybot')
  })

  it('uses "Main" as root name when SOUL.md heading is generic', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/IDENTITY.md') return false
      if (p === '/tmp/ws/SOUL.md') return true
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/bot/SOUL.md') return true
      if (p === '/tmp/ws/agents/bot/sub-agents') return false
      if (p === '/tmp/ws/agents/bot/members') return false
      return false
    })

    mockReaddirSync.mockReturnValue([
      { name: 'bot', isDirectory: () => true },
    ])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/SOUL.md') return '# SOUL.md - Who You Are\nContent'
      if (p === '/tmp/ws/agents/bot/SOUL.md') return '# Bot\nContent'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    const root = agents.find(a => a.reportsTo === null)!
    expect(root.name).toBe('Main')
    expect(root.id).toBe('main')
  })

  it('discovers sub-agents in sub-agents/ directory', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return true
      if (p === '/tmp/ws/IDENTITY.md') return false
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/herald/SOUL.md') return true
      if (p === '/tmp/ws/agents/herald/sub-agents') return true
      if (p === '/tmp/ws/agents/herald/sub-agents/QUILL.md') return true
      if (p === '/tmp/ws/agents/herald/sub-agents/MAVEN.md') return true
      if (p === '/tmp/ws/agents/herald/members') return false
      return false
    })

    // First call: agents/ dir, second call: sub-agents/ dir
    mockReaddirSync
      .mockReturnValueOnce([{ name: 'herald', isDirectory: () => true }])
      .mockReturnValueOnce(['QUILL.md', 'MAVEN.md'])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/SOUL.md') return '# SOUL.md - Who You Are'
      if (p === '/tmp/ws/agents/herald/SOUL.md') return '# SOUL.md — HERALD\n## Role'
      if (p === '/tmp/ws/agents/herald/sub-agents/QUILL.md') return '# QUILL — Content Writer'
      if (p === '/tmp/ws/agents/herald/sub-agents/MAVEN.md') return '# MAVEN — LinkedIn Strategist'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    const herald = agents.find(a => a.id === 'herald')!
    expect(herald.name).toBe('HERALD')
    expect(herald.directReports).toContain('herald-quill')
    expect(herald.directReports).toContain('herald-maven')

    const quill = agents.find(a => a.id === 'herald-quill')!
    expect(quill.name).toBe('QUILL')
    expect(quill.title).toBe('Content Writer')
    expect(quill.reportsTo).toBe('herald')

    const maven = agents.find(a => a.id === 'herald-maven')!
    expect(maven.name).toBe('MAVEN')
    expect(maven.title).toBe('LinkedIn Strategist')
    expect(maven.reportsTo).toBe('herald')
  })

  it('discovers members/ directory agents', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/seo-team/SOUL.md') return true
      if (p === '/tmp/ws/agents/seo-team/sub-agents') return false
      if (p === '/tmp/ws/agents/seo-team/members') return true
      if (p === '/tmp/ws/agents/seo-team/members/WRITER.md') return true
      return false
    })

    mockReaddirSync
      .mockReturnValueOnce([{ name: 'seo-team', isDirectory: () => true }])
      .mockReturnValueOnce(['WRITER.md'])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/agents/seo-team/SOUL.md') return '# SOUL.md — LUMEN, SEO Team Director'
      if (p === '/tmp/ws/agents/seo-team/members/WRITER.md') return '# WRITER — Conversion-Focused Content Creator'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    const lumen = agents.find(a => a.id === 'seo-team')!
    expect(lumen.name).toBe('LUMEN')
    expect(lumen.title).toBe('SEO Team Director')
    expect(lumen.directReports).toContain('seo-team-writer')

    const writer = agents.find(a => a.id === 'seo-team-writer')!
    expect(writer.name).toBe('WRITER')
    expect(writer.title).toBe('Conversion-Focused Content Creator')
    expect(writer.reportsTo).toBe('seo-team')
  })

  it('discovers dirs without SOUL.md if they have sub-agents', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/team/SOUL.md') return false // no SOUL.md!
      if (p === '/tmp/ws/agents/team/sub-agents') return true
      if (p === '/tmp/ws/agents/team/sub-agents/WORKER.md') return true
      if (p === '/tmp/ws/agents/team/members') return false
      return false
    })

    mockReaddirSync
      .mockReturnValueOnce([{ name: 'team', isDirectory: () => true }])
      .mockReturnValueOnce(['WORKER.md'])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/agents/team/sub-agents/WORKER.md') return '# WORKER — Task Runner'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    const team = agents.find(a => a.id === 'team')!
    expect(team.name).toBe('Team')
    expect(team.soulPath).toBeNull()
    expect(team.directReports).toContain('team-worker')
  })

  it('discovers agents without root SOUL.md (flat structure)', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/worker/SOUL.md') return true
      if (p === '/tmp/ws/agents/worker/sub-agents') return false
      if (p === '/tmp/ws/agents/worker/members') return false
      return false
    })

    mockReaddirSync.mockReturnValue([
      { name: 'worker', isDirectory: () => true },
    ])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/agents/worker/SOUL.md') return '# Worker Bot'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    expect(agents).toHaveLength(1)
    expect(agents[0].id).toBe('worker')
    expect(agents[0].name).toBe('Worker Bot')
    expect(agents[0].reportsTo).toBeNull()
  })

  it('does not duplicate root agent when agents/ dir name matches root ID', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    // IDENTITY.md says "Jarvis" → rootId = 'jarvis'
    // agents/jarvis/ directory also exists → should NOT create a second 'jarvis' entry
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return true
      if (p === '/tmp/ws/IDENTITY.md') return true
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/jarvis/SOUL.md') return true
      if (p === '/tmp/ws/agents/jarvis/sub-agents') return false
      if (p === '/tmp/ws/agents/jarvis/members') return false
      if (p === '/tmp/ws/agents/vera/SOUL.md') return true
      if (p === '/tmp/ws/agents/vera/sub-agents') return false
      if (p === '/tmp/ws/agents/vera/members') return false
      return false
    })

    mockReaddirSync.mockReturnValue([
      { name: 'jarvis', isDirectory: () => true },
      { name: 'vera', isDirectory: () => true },
    ])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/IDENTITY.md') return '- **Name:** Jarvis\n- **Emoji:** 🤖'
      if (p === '/tmp/ws/SOUL.md') return '# SOUL.md - Who You Are\nYou are Jarvis.'
      if (p === '/tmp/ws/agents/jarvis/SOUL.md') return '# SOUL.md — Jarvis\nOrchestrator details.'
      if (p === '/tmp/ws/agents/vera/SOUL.md') return '# SOUL.md — VERA\nStrategy.'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    // Should have exactly 2 agents: jarvis (root) + vera, NOT 3 (no duplicate jarvis)
    const jarvisEntries = agents.filter(a => a.id === 'jarvis')
    expect(jarvisEntries).toHaveLength(1)
    expect(jarvisEntries[0].reportsTo).toBeNull() // it's the root
    expect(jarvisEntries[0].title).toBe('总协调者') // root title, not agent scan
    expect(agents.find(a => a.id === 'vera')).toBeDefined()
  })

  it('falls back to bundled when no agents/ dir and no root SOUL.md', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockReturnValue(false)
    const agents = await getAgents()
    expect(agents.length).toBe(bundledAgents.length)
  })

  it('uses directory slug as name when SOUL.md has no heading', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/my-bot/SOUL.md') return true
      if (p === '/tmp/ws/agents/my-bot/sub-agents') return false
      if (p === '/tmp/ws/agents/my-bot/members') return false
      return false
    })

    mockReaddirSync.mockReturnValue([
      { name: 'my-bot', isDirectory: () => true },
    ])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/agents/my-bot/SOUL.md') return 'No heading here, just text.'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    expect(agents).toHaveLength(1)
    expect(agents[0].id).toBe('my-bot')
    expect(agents[0].name).toBe('My Bot') // slugToName
  })

  it('strips SOUL.md prefix from agent names in discovery', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/vera/SOUL.md') return true
      if (p === '/tmp/ws/agents/vera/sub-agents') return false
      if (p === '/tmp/ws/agents/vera/members') return false
      if (p === '/tmp/ws/agents/kaze/SOUL.md') return true
      if (p === '/tmp/ws/agents/kaze/sub-agents') return false
      if (p === '/tmp/ws/agents/kaze/members') return false
      return false
    })

    mockReaddirSync.mockReturnValue([
      { name: 'vera', isDirectory: () => true },
      { name: 'kaze', isDirectory: () => true },
    ])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/agents/vera/SOUL.md') return '# SOUL.md — VERA'
      if (p === '/tmp/ws/agents/kaze/SOUL.md') return '# SOUL.md — KAZE, Flight Research Agent'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    const vera = agents.find(a => a.id === 'vera')!
    expect(vera.name).toBe('VERA')
    expect(vera.title).toBe('智能体') // no title from heading alone

    const kaze = agents.find(a => a.id === 'kaze')!
    expect(kaze.name).toBe('KAZE')
    expect(kaze.title).toBe('Flight Research Agent')
  })

  it('discovers subdirectory agents with SOUL.md (outpost pattern)', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/outpost/SOUL.md') return true
      if (p === '/tmp/ws/agents/outpost') return true
      if (p === '/tmp/ws/agents/outpost/sub-agents') return false
      if (p === '/tmp/ws/agents/outpost/members') return false
      if (p === '/tmp/ws/agents/outpost/scout/SOUL.md') return true
      if (p === '/tmp/ws/agents/outpost/mirror/SOUL.md') return true
      return false
    })

    mockReaddirSync.mockImplementation((p: string) => {
      if (String(p) === '/tmp/ws/agents') {
        return [{ name: 'outpost', isDirectory: () => true }]
      }
      if (String(p) === '/tmp/ws/agents/outpost') {
        return [
          { name: 'scout', isDirectory: () => true },
          { name: 'mirror', isDirectory: () => true },
        ]
      }
      return []
    })

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/agents/outpost/SOUL.md') return '# OUTPOST — Forward Operations'
      if (p === '/tmp/ws/agents/outpost/scout/SOUL.md') return '# SCOUT — Reconnaissance Agent'
      if (p === '/tmp/ws/agents/outpost/mirror/SOUL.md') return '# MIRROR — Reflection Agent'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    const outpost = agents.find(a => a.id === 'outpost')!
    expect(outpost.name).toBe('OUTPOST')
    expect(outpost.directReports).toContain('outpost-scout')
    expect(outpost.directReports).toContain('outpost-mirror')

    const scout = agents.find(a => a.id === 'outpost-scout')!
    expect(scout.name).toBe('SCOUT')
    expect(scout.title).toBe('Reconnaissance Agent')
    expect(scout.reportsTo).toBe('outpost')
    expect(scout.soulPath).toBe('agents/outpost/scout/SOUL.md')

    const mirror = agents.find(a => a.id === 'outpost-mirror')!
    expect(mirror.name).toBe('MIRROR')
    expect(mirror.title).toBe('Reflection Agent')
    expect(mirror.reportsTo).toBe('outpost')
    expect(mirror.soulPath).toBe('agents/outpost/mirror/SOUL.md')
  })

  it('scans sub-agents from root-matching directory', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return true
      if (p === '/tmp/ws/IDENTITY.md') return true
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/jarvis/SOUL.md') return true
      if (p === '/tmp/ws/agents/jarvis') return true
      if (p === '/tmp/ws/agents/jarvis/sub-agents') return true
      if (p === '/tmp/ws/agents/jarvis/sub-agents/SCRIBE.md') return true
      if (p === '/tmp/ws/agents/jarvis/members') return false
      if (p === '/tmp/ws/agents/vera/SOUL.md') return true
      if (p === '/tmp/ws/agents/vera/sub-agents') return false
      if (p === '/tmp/ws/agents/vera/members') return false
      return false
    })

    mockReaddirSync.mockImplementation((p: string) => {
      if (String(p) === '/tmp/ws/agents') {
        return [
          { name: 'jarvis', isDirectory: () => true },
          { name: 'vera', isDirectory: () => true },
        ]
      }
      if (String(p) === '/tmp/ws/agents/jarvis/sub-agents') {
        return ['SCRIBE.md']
      }
      return []
    })

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/IDENTITY.md') return '- **Name:** Jarvis\n- **Emoji:** 🤖'
      if (p === '/tmp/ws/SOUL.md') return '# SOUL.md - Who You Are'
      if (p === '/tmp/ws/agents/jarvis/SOUL.md') return '# SOUL.md — Jarvis'
      if (p === '/tmp/ws/agents/jarvis/sub-agents/SCRIBE.md') return '# SCRIBE — Documentation Writer'
      if (p === '/tmp/ws/agents/vera/SOUL.md') return '# SOUL.md — VERA'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    const root = agents.find(a => a.id === 'jarvis')!
    expect(root.reportsTo).toBeNull()
    expect(root.directReports).toContain('jarvis-scribe')
    expect(root.directReports).toContain('vera')

    const scribe = agents.find(a => a.id === 'jarvis-scribe')!
    expect(scribe.name).toBe('SCRIBE')
    expect(scribe.title).toBe('Documentation Writer')
    expect(scribe.reportsTo).toBe('jarvis')

    expect(agents.filter(a => a.id === 'jarvis')).toHaveLength(1)
  })

  it('ignores data directories without SOUL.md', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/robin/SOUL.md') return true
      if (p === '/tmp/ws/agents/robin/sub-agents') return false
      if (p === '/tmp/ws/agents/robin/members') return false
      return false
    })

    mockReaddirSync.mockImplementation((p: string) => {
      if (String(p) === '/tmp/ws/agents') {
        return [{ name: 'robin', isDirectory: () => true }]
      }
      if (String(p) === '/tmp/ws/agents/robin') {
        return [
          { name: 'briefs', isDirectory: () => true },
          { name: 'state.json', isDirectory: () => false },
        ]
      }
      return []
    })

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/agents/robin/SOUL.md') return '# ROBIN — Field Intel Operator'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    const robin = agents.find(a => a.id === 'robin')!
    expect(robin.name).toBe('ROBIN')
    expect(robin.directReports).toEqual([])
    expect(agents.find(a => a.id === 'robin-briefs')).toBeUndefined()
  })

  it('discovers both flat sub-agents and subdirectory agents', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/herald/SOUL.md') return true
      if (p === '/tmp/ws/agents/herald') return true
      if (p === '/tmp/ws/agents/herald/sub-agents') return true
      if (p === '/tmp/ws/agents/herald/sub-agents/MAVEN.md') return true
      if (p === '/tmp/ws/agents/herald/members') return false
      if (p === '/tmp/ws/agents/herald/quill/SOUL.md') return true
      return false
    })

    mockReaddirSync.mockImplementation((p: string) => {
      if (String(p) === '/tmp/ws/agents') {
        return [{ name: 'herald', isDirectory: () => true }]
      }
      if (String(p) === '/tmp/ws/agents/herald/sub-agents') {
        return ['MAVEN.md']
      }
      if (String(p) === '/tmp/ws/agents/herald') {
        return [
          { name: 'sub-agents', isDirectory: () => true },
          { name: 'quill', isDirectory: () => true },
        ]
      }
      return []
    })

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/agents/herald/SOUL.md') return '# SOUL.md — HERALD'
      if (p === '/tmp/ws/agents/herald/sub-agents/MAVEN.md') return '# MAVEN — LinkedIn Strategist'
      if (p === '/tmp/ws/agents/herald/quill/SOUL.md') return '# QUILL — Content Writer'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    const herald = agents.find(a => a.id === 'herald')!
    expect(herald.directReports).toContain('herald-maven')
    expect(herald.directReports).toContain('herald-quill')

    const maven = agents.find(a => a.id === 'herald-maven')!
    expect(maven.name).toBe('MAVEN')
    expect(maven.reportsTo).toBe('herald')
    expect(maven.soulPath).toBeNull()

    const quill = agents.find(a => a.id === 'herald-quill')!
    expect(quill.name).toBe('QUILL')
    expect(quill.reportsTo).toBe('herald')
    expect(quill.soulPath).toBe('agents/herald/quill/SOUL.md')
  })
})

// ---------------------------------------------------------------------------
// getAgents
// ---------------------------------------------------------------------------

describe('getAgents', () => {
  it('returns all agents from the registry', async () => {
    const agents = await getAgents()
    expect(agents.length).toBeGreaterThan(0)
  })

  it('every agent has required fields', async () => {
    const agents = await getAgents()
    for (const agent of agents) {
      expect(agent.id).toEqual(expect.any(String))
      expect(agent.name).toEqual(expect.any(String))
      expect(agent.title).toEqual(expect.any(String))
      expect(agent.color).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(agent.emoji).toEqual(expect.any(String))
      expect(Array.isArray(agent.tools)).toBe(true)
      expect(Array.isArray(agent.directReports)).toBe(true)
      expect(Array.isArray(agent.crons)).toBe(true)
      expect(agent.description).toEqual(expect.any(String))
    }
  })

  it('includes known agents by id', async () => {
    const agents = await getAgents()
    const ids = agents.map(a => a.id)
    expect(ids).toContain('jarvis')
    expect(ids).toContain('vera')
    expect(ids).toContain('lumen')
    expect(ids).toContain('pulse')
    expect(ids).toContain('kaze')
  })

  it('sets soul to null when WORKSPACE_PATH is not set', async () => {
    vi.stubEnv('WORKSPACE_PATH', '')
    const agents = await getAgents()
    const jarvis = agents.find(a => a.id === 'jarvis')!
    expect(jarvis.soulPath).toBeTruthy()
    expect(jarvis.soul).toBeNull()
  })

  it('sets soul to null when soulPath file does not exist', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockReturnValue(false)
    const agents = await getAgents()
    const jarvis = agents.find(a => a.id === 'jarvis')!
    expect(jarvis.soulPath).toBeTruthy()
    expect(jarvis.soul).toBeNull()
  })

  it('reads soul content when soulPath file exists', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockImplementation((p: string) => {
      // Block auto-discovery, allow SOUL file reads for bundled agents
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/IDENTITY.md') return false
      if (p === '/tmp/ws/agents') return false
      return true
    })
    mockReadFileSync.mockReturnValue('# Agent SOUL content')
    const agents = await getAgents()
    const vera = agents.find(a => a.id === 'vera')!
    expect(vera.soul).toBe('# Agent SOUL content')
  })

  it('sets soul to null when readFileSync throws', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/IDENTITY.md') return false
      if (p === '/tmp/ws/agents') return false
      return true
    })
    mockReadFileSync.mockImplementation(() => { throw new Error('EACCES') })
    const agents = await getAgents()
    const vera = agents.find(a => a.id === 'vera')!
    expect(vera.soul).toBeNull()
  })

  it('initializes crons as empty array for every agent', async () => {
    const agents = await getAgents()
    for (const agent of agents) {
      expect(agent.crons).toEqual([])
    }
  })

  it('agents with no soulPath get soul=null without reading fs', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockReturnValue(false)
    const agents = await getAgents()
    const scout = agents.find(a => a.id === 'scout')!
    expect(scout.soulPath).toBeNull()
    expect(scout.soul).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getAgent
// ---------------------------------------------------------------------------

describe('getAgent', () => {
  it('returns the correct agent by id', async () => {
    const agent = await getAgent('vera')
    expect(agent).not.toBeNull()
    expect(agent!.id).toBe('vera')
    expect(agent!.name).toBe('VERA')
    expect(agent!.title).toBe('Chief Strategy Officer')
  })

  it('returns null for an unknown id', async () => {
    const agent = await getAgent('nonexistent-agent')
    expect(agent).toBeNull()
  })

  it('returns null for empty string', async () => {
    const agent = await getAgent('')
    expect(agent).toBeNull()
  })

  it('is case-sensitive (uppercase id returns null)', async () => {
    const agent = await getAgent('VERA')
    expect(agent).toBeNull()
  })

  it('returns agent with correct directReports', async () => {
    const jarvis = await getAgent('jarvis')
    expect(jarvis).not.toBeNull()
    expect(jarvis!.directReports).toContain('vera')
    expect(jarvis!.directReports).toContain('lumen')
    expect(jarvis!.directReports).toContain('pulse')
  })

  it('returns agent with correct reportsTo chain', async () => {
    const robin = await getAgent('robin')
    expect(robin).not.toBeNull()
    expect(robin!.reportsTo).toBe('vera')

    const vera = await getAgent('vera')
    expect(vera!.reportsTo).toBe('jarvis')

    const jarvis = await getAgent('jarvis')
    expect(jarvis!.reportsTo).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// CLI-based multi-workspace discovery (openclaw agents list --json)
//
// Real CLI output format (verified against live `openclaw agents list --json`):
//   [{ id, identityName, identityEmoji, identitySource,
//      workspace, agentDir, model, bindings, isDefault, routes }]
//
// Key insight: OpenClaw "agents" are isolated workspaces, not hierarchical
// team members. Each has its own workspace path. ClawPort scans each
// workspace for sub-agent hierarchies via discoverAgents().
// ---------------------------------------------------------------------------

describe('CLI agent discovery (multi-workspace)', () => {
  /**
   * Primary workspace at /tmp/ws with root Jarvis + echo agent.
   * OPENCLAW_BIN set so CLI calls are attempted.
   */
  function setupPrimaryWorkspace() {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    vi.stubEnv('OPENCLAW_BIN', '/usr/local/bin/openclaw')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return true
      if (p === '/tmp/ws/IDENTITY.md') return true
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/echo/SOUL.md') return true
      if (p === '/tmp/ws/agents/echo/sub-agents') return false
      if (p === '/tmp/ws/agents/echo/members') return false
      return false
    })

    mockReaddirSync.mockReturnValue([
      { name: 'echo', isDirectory: () => true },
    ])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/IDENTITY.md') return '- **Name:** Jarvis\n- **Emoji:** 🤖'
      if (p === '/tmp/ws/SOUL.md') return '# SOUL.md - Who You Are'
      if (p === '/tmp/ws/agents/echo/SOUL.md') return '# ECHO — Community Voice Monitor'
      throw new Error('ENOENT')
    })
  }

  /** CLI output for a single agent (matches the primary workspace) */
  function cliOutput(entries: Array<{
    id: string
    identityName?: string
    identityEmoji?: string
    workspace?: string
    isDefault?: boolean
  }>) {
    return JSON.stringify(entries.map(e => ({
      id: e.id,
      identityName: e.identityName ?? null,
      identityEmoji: e.identityEmoji ?? null,
      identitySource: 'identity',
      workspace: e.workspace ?? '/tmp/ws',
      agentDir: `/home/.openclaw/agents/${e.id}/agent`,
      model: 'anthropic/claude-sonnet-4-6',
      bindings: 0,
      isDefault: e.isDefault ?? false,
      routes: ['default (no explicit rules)'],
    })))
  }

  it('skips CLI merge when only one agent exists (same workspace)', async () => {
    setupPrimaryWorkspace()

    // CLI returns one agent pointing at the same workspace — no extra workspaces to scan
    mockExecSync.mockReturnValue(cliOutput([
      { id: 'main', identityName: 'Jarvis', identityEmoji: '🤖', workspace: '/tmp/ws', isDefault: true },
    ]))

    const agents = await getAgents()
    const ids = agents.map(a => a.id)
    expect(ids).toContain('jarvis')
    expect(ids).toContain('echo')
    // Should NOT have a duplicate 'main' entry since only 1 CLI agent (no merge triggered)
  })

  it('discovers agents from a second workspace via CLI', async () => {
    // Primary workspace has Jarvis + echo
    // CLI shows a second agent "work" with a different workspace at /tmp/ws-work
    // That workspace has a SOUL.md + a "helper" agent
    setupPrimaryWorkspace()

    // Extend existsSync to handle the second workspace
    const origExists = mockExistsSync.getMockImplementation()!
    mockExistsSync.mockImplementation((p: string) => {
      // Second workspace paths
      if (p === '/tmp/ws-work/SOUL.md') return true
      if (p === '/tmp/ws-work/IDENTITY.md') return true
      if (p === '/tmp/ws-work/agents') return true
      if (p === '/tmp/ws-work/agents/helper/SOUL.md') return true
      if (p === '/tmp/ws-work/agents/helper/sub-agents') return false
      if (p === '/tmp/ws-work/agents/helper/members') return false
      if (p === '/tmp/ws-work/clawport/agents.json') return false
      return origExists(p)
    })

    // Extend readdirSync to handle the second workspace agents/ dir
    mockReaddirSync.mockImplementation((p: string) => {
      if (String(p) === '/tmp/ws-work/agents') {
        return [{ name: 'helper', isDirectory: () => true }]
      }
      return [{ name: 'echo', isDirectory: () => true }]
    })

    const origRead = mockReadFileSync.getMockImplementation()!
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws-work/IDENTITY.md') return '- **Name:** WorkBot\n- **Emoji:** 🔧'
      if (p === '/tmp/ws-work/SOUL.md') return '# SOUL.md - Who You Are'
      if (p === '/tmp/ws-work/agents/helper/SOUL.md') return '# HELPER — Task Assistant'
      return origRead(p)
    })

    mockExecSync.mockReturnValue(cliOutput([
      { id: 'main', identityName: 'Jarvis', identityEmoji: '🤖', workspace: '/tmp/ws', isDefault: true },
      { id: 'work', identityName: 'WorkBot', identityEmoji: '🔧', workspace: '/tmp/ws-work' },
    ]))

    const agents = await getAgents()
    const ids = agents.map(a => a.id)
    // Primary workspace agents
    expect(ids).toContain('jarvis')
    expect(ids).toContain('echo')
    // Second workspace agents discovered via filesystem scan
    expect(ids).toContain('workbot') // root of second workspace (from IDENTITY.md)
    expect(ids).toContain('helper')
  })

  it('second workspace root becomes top-level peer (reportsTo=null)', async () => {
    setupPrimaryWorkspace()

    const origExists = mockExistsSync.getMockImplementation()!
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws2/SOUL.md') return true
      if (p === '/tmp/ws2/IDENTITY.md') return false
      if (p === '/tmp/ws2/agents') return false
      if (p === '/tmp/ws2/clawport/agents.json') return false
      return origExists(p)
    })

    const origRead = mockReadFileSync.getMockImplementation()!
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws2/SOUL.md') return '# SOUL.md — SecondBot'
      return origRead(p)
    })

    mockExecSync.mockReturnValue(cliOutput([
      { id: 'main', workspace: '/tmp/ws', isDefault: true },
      { id: 'second', workspace: '/tmp/ws2' },
    ]))

    const agents = await getAgents()
    const secondBot = agents.find(a => a.id === 'secondbot')
    expect(secondBot).toBeDefined()
    expect(secondBot!.reportsTo).toBeNull() // independent, not under Jarvis
  })

  it('creates minimal entry when extra workspace has no discoverable agents', async () => {
    setupPrimaryWorkspace()

    // Second workspace has nothing discoverable (no SOUL.md, no agents/ dir)
    const origExists = mockExistsSync.getMockImplementation()!
    mockExistsSync.mockImplementation((p: string) => {
      if (p.startsWith('/tmp/ws-empty')) return false
      return origExists(p)
    })

    mockExecSync.mockReturnValue(cliOutput([
      { id: 'main', workspace: '/tmp/ws', isDefault: true },
      { id: 'empty-bot', identityName: 'EmptyBot', identityEmoji: '🤷', workspace: '/tmp/ws-empty' },
    ]))

    const agents = await getAgents()
    const emptyBot = agents.find(a => a.id === 'empty-bot')
    expect(emptyBot).toBeDefined()
    expect(emptyBot!.name).toBe('EmptyBot')
    expect(emptyBot!.emoji).toBe('🤷')
    expect(emptyBot!.reportsTo).toBeNull()
    expect(emptyBot!.tools).toEqual(['read', 'write'])
  })

  it('does not duplicate agents already found in primary workspace', async () => {
    setupPrimaryWorkspace()

    // CLI returns two agents both pointing at the SAME workspace
    mockExecSync.mockReturnValue(cliOutput([
      { id: 'main', workspace: '/tmp/ws', isDefault: true },
      { id: 'alias', workspace: '/tmp/ws' }, // same workspace, should be skipped
    ]))

    const agents = await getAgents()
    // No extra agents added since both workspaces are the same
    const ids = agents.map(a => a.id)
    expect(ids).toContain('jarvis')
    expect(ids).toContain('echo')
    expect(ids).not.toContain('alias')
  })

  it('gracefully handles CLI failure (falls back to filesystem only)', async () => {
    setupPrimaryWorkspace()

    mockExecSync.mockImplementation(() => {
      throw new Error('command not found: openclaw')
    })

    const agents = await getAgents()
    const ids = agents.map(a => a.id)
    expect(ids).toContain('jarvis')
    expect(ids).toContain('echo')
  })

  it('gracefully handles CLI returning invalid JSON', async () => {
    setupPrimaryWorkspace()
    mockExecSync.mockReturnValue('not valid json {{{}')

    const agents = await getAgents()
    expect(agents.map(a => a.id)).toContain('jarvis')
    expect(agents.map(a => a.id)).toContain('echo')
  })

  it('gracefully handles CLI returning empty array', async () => {
    setupPrimaryWorkspace()
    mockExecSync.mockReturnValue('[]')

    const agents = await getAgents()
    expect(agents.map(a => a.id)).toContain('jarvis')
    expect(agents.map(a => a.id)).toContain('echo')
  })

  it('gracefully handles non-array CLI output', async () => {
    setupPrimaryWorkspace()
    mockExecSync.mockReturnValue('{"status":"ok"}')

    const agents = await getAgents()
    expect(agents.map(a => a.id)).toContain('jarvis')
  })

  it('does not call CLI when OPENCLAW_BIN is not set', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    vi.stubEnv('OPENCLAW_BIN', '')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return true
      if (p === '/tmp/ws/IDENTITY.md') return false
      if (p === '/tmp/ws/agents') return false
      return false
    })
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/SOUL.md') return '# SOUL.md — Root'
      throw new Error('ENOENT')
    })

    await getAgents()
    expect(mockExecSync).not.toHaveBeenCalled()
  })

  it('falls back to bundled when CLI fails and no filesystem agents', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    vi.stubEnv('OPENCLAW_BIN', '/usr/local/bin/openclaw')
    mockExistsSync.mockReturnValue(false)
    mockReaddirSync.mockReturnValue([])
    mockExecSync.mockImplementation(() => { throw new Error('timeout') })

    const agents = await getAgents()
    expect(agents.length).toBe(bundledAgents.length)
  })

  it('CLI-only: scans each workspace when primary has no agents', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    vi.stubEnv('OPENCLAW_BIN', '/usr/local/bin/openclaw')

    // Primary workspace has nothing
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/agents') return false
      // Remote workspace
      if (p === '/tmp/remote/SOUL.md') return true
      if (p === '/tmp/remote/IDENTITY.md') return false
      if (p === '/tmp/remote/agents') return false
      if (p === '/tmp/remote/clawport/agents.json') return false
      return false
    })

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/remote/SOUL.md') return '# SOUL.md — RemoteBot'
      throw new Error('ENOENT')
    })

    mockExecSync.mockReturnValue(cliOutput([
      { id: 'remote', identityName: 'RemoteBot', workspace: '/tmp/remote' },
    ]))

    const agents = await getAgents()
    expect(agents.map(a => a.id)).toContain('remotebot')
  })

  it('handles three workspaces with independent hierarchies', async () => {
    setupPrimaryWorkspace()

    // Extend filesystem mocks for two extra workspaces
    const origExists = mockExistsSync.getMockImplementation()!
    mockExistsSync.mockImplementation((p: string) => {
      // Workspace B
      if (p === '/tmp/ws-b/SOUL.md') return true
      if (p === '/tmp/ws-b/IDENTITY.md') return false
      if (p === '/tmp/ws-b/agents') return false
      if (p === '/tmp/ws-b/clawport/agents.json') return false
      // Workspace C — empty
      if (p.startsWith('/tmp/ws-c')) return false
      return origExists(p)
    })

    const origRead = mockReadFileSync.getMockImplementation()!
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws-b/SOUL.md') return '# SOUL.md — BotB'
      return origRead(p)
    })

    mockExecSync.mockReturnValue(cliOutput([
      { id: 'main', workspace: '/tmp/ws', isDefault: true },
      { id: 'b', identityName: 'BotB', workspace: '/tmp/ws-b' },
      { id: 'c', identityName: 'BotC', identityEmoji: '🎯', workspace: '/tmp/ws-c' },
    ]))

    const agents = await getAgents()
    const ids = agents.map(a => a.id)
    expect(ids).toContain('jarvis')  // primary root
    expect(ids).toContain('echo')    // primary sub-agent
    expect(ids).toContain('botb')    // workspace B root (from SOUL.md heading)
    expect(ids).toContain('c')       // workspace C (minimal entry, no SOUL.md)

    const botC = agents.find(a => a.id === 'c')!
    expect(botC.name).toBe('BotC')
    expect(botC.emoji).toBe('🎯')
  })
})
