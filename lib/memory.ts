import type { AgentDeepStatus, MemoryFileInfo, MemoryConfig, MemoryStatus, MemoryStats } from '@/lib/types'
import { readFileSync, existsSync, statSync, readdirSync } from 'fs'
import { join, basename, dirname } from 'path'
import { execSync } from 'child_process'
import { requireEnv } from '@/lib/env'

// ── Date pattern for daily logs ─────────────────────────────────

const DAILY_PATTERN = /^\d{4}-\d{2}-\d{2}\.md$/

function isDaily(filename: string): boolean {
  return DAILY_PATTERN.test(filename)
}

function extractDate(filename: string): string {
  return filename.replace('.md', '')
}

// ── Labeling ────────────────────────────────────────────────────

function humanizeFilename(filename: string): string {
  const name = filename.replace(/\.(md|json)$/, '')
  return name
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function labelForFile(filename: string, fullPath: string, workspacePath: string): string {
  // Root MEMORY.md
  if (fullPath === join(workspacePath, 'MEMORY.md')) {
    return 'Long-Term Memory'
  }

  // Daily logs
  if (isDaily(filename)) {
    const dateStr = extractDate(filename)
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    if (dateStr === today) return 'Daily Log (Today)'
    if (dateStr === yesterday) return 'Daily Log (Yesterday)'
    return `Daily Log (${dateStr})`
  }

  return humanizeFilename(filename)
}

// ── getMemoryFiles ──────────────────────────────────────────────

export async function getMemoryFiles(): Promise<MemoryFileInfo[]> {
  const workspacePath = requireEnv('WORKSPACE_PATH')
  const files: MemoryFileInfo[] = []
  const memoryDir = join(workspacePath, 'memory')

  // 1. Root MEMORY.md
  const rootMemory = join(workspacePath, 'MEMORY.md')
  if (existsSync(rootMemory)) {
    try {
      const content = readFileSync(rootMemory, 'utf-8')
      const stats = statSync(rootMemory)
      files.push({
        label: labelForFile('MEMORY.md', rootMemory, workspacePath),
        path: rootMemory,
        relativePath: 'MEMORY.md',
        content,
        lastModified: stats.mtime.toISOString(),
        sizeBytes: stats.size,
        category: 'evergreen',
      })
    } catch { /* skip unreadable */ }
  }

  // 2. Scan memory/ directory
  if (existsSync(memoryDir)) {
    try {
      const entries = readdirSync(memoryDir)
      for (const entry of entries) {
        const fullPath = join(memoryDir, entry)
        // Only .md and .json files, skip directories
        if (!/\.(md|json)$/.test(entry)) continue
        try {
          const stat = statSync(fullPath)
          if (!stat.isFile()) continue
          const content = readFileSync(fullPath, 'utf-8')
          const category = isDaily(entry) ? 'daily' : 'evergreen'
          files.push({
            label: labelForFile(entry, fullPath, workspacePath),
            path: fullPath,
            relativePath: `memory/${entry}`,
            content,
            lastModified: stat.mtime.toISOString(),
            sizeBytes: stat.size,
            category,
          })
        } catch { /* skip unreadable */ }
      }
    } catch { /* skip unreadable dir */ }
  }

  // Sort: evergreen first, then daily by date descending
  files.sort((a, b) => {
    if (a.category !== b.category) {
      if (a.category === 'evergreen') return -1
      if (b.category === 'evergreen') return 1
    }
    // Within same category, sort by lastModified descending
    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  })

  return files
}

// ── getMemoryConfig ─────────────────────────────────────────────

const SEARCH_DEFAULTS: MemoryConfig['memorySearch'] = {
  enabled: false,
  provider: null,
  model: null,
  hybrid: {
    enabled: true,
    vectorWeight: 0.7,
    textWeight: 0.3,
    temporalDecay: { enabled: true, halfLifeDays: 30 },
    mmr: { enabled: true, lambda: 0.7 },
  },
  cache: { enabled: true, maxEntries: 256 },
  extraPaths: [],
}

const FLUSH_DEFAULTS: MemoryConfig['memoryFlush'] = {
  enabled: false,
  softThresholdTokens: 80000,
}

export function getMemoryConfig(): MemoryConfig {
  const workspacePath = requireEnv('WORKSPACE_PATH')
  // openclaw.json is in the parent of the workspace directory
  const configPath = join(dirname(workspacePath), 'openclaw.json')

  if (!existsSync(configPath)) {
    return { memorySearch: SEARCH_DEFAULTS, memoryFlush: FLUSH_DEFAULTS, configFound: false }
  }

  try {
    const raw = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw)
    const agentDefaults = config?.agents?.defaults ?? {}

    // Memory search
    const ms = agentDefaults.memorySearch ?? {}
    const hybrid = ms.hybrid ?? {}
    const decay = hybrid.temporalDecay ?? {}
    const mmr = hybrid.mmr ?? {}
    const cache = ms.cache ?? {}

    const memorySearch: MemoryConfig['memorySearch'] = {
      enabled: ms.enabled ?? SEARCH_DEFAULTS.enabled,
      provider: ms.provider ?? SEARCH_DEFAULTS.provider,
      model: ms.model ?? SEARCH_DEFAULTS.model,
      hybrid: {
        enabled: hybrid.enabled ?? SEARCH_DEFAULTS.hybrid.enabled,
        vectorWeight: hybrid.vectorWeight ?? SEARCH_DEFAULTS.hybrid.vectorWeight,
        textWeight: hybrid.textWeight ?? SEARCH_DEFAULTS.hybrid.textWeight,
        temporalDecay: {
          enabled: decay.enabled ?? SEARCH_DEFAULTS.hybrid.temporalDecay.enabled,
          halfLifeDays: decay.halfLifeDays ?? SEARCH_DEFAULTS.hybrid.temporalDecay.halfLifeDays,
        },
        mmr: {
          enabled: mmr.enabled ?? SEARCH_DEFAULTS.hybrid.mmr.enabled,
          lambda: mmr.lambda ?? SEARCH_DEFAULTS.hybrid.mmr.lambda,
        },
      },
      cache: {
        enabled: cache.enabled ?? SEARCH_DEFAULTS.cache.enabled,
        maxEntries: cache.maxEntries ?? SEARCH_DEFAULTS.cache.maxEntries,
      },
      extraPaths: ms.extraPaths ?? SEARCH_DEFAULTS.extraPaths,
    }

    // Memory flush (under compaction)
    const flush = agentDefaults.compaction?.memoryFlush ?? {}
    const memoryFlush: MemoryConfig['memoryFlush'] = {
      enabled: flush.enabled ?? FLUSH_DEFAULTS.enabled,
      softThresholdTokens: flush.softThresholdTokens ?? FLUSH_DEFAULTS.softThresholdTokens,
    }

    // configFound = true only if memorySearch key exists explicitly
    const configFound = 'memorySearch' in agentDefaults

    return { memorySearch, memoryFlush, configFound }
  } catch {
    return { memorySearch: SEARCH_DEFAULTS, memoryFlush: FLUSH_DEFAULTS, configFound: false }
  }
}

// ── getMemoryStatus ─────────────────────────────────────────────

export function getMemoryStatus(): MemoryStatus {
  const defaults: MemoryStatus = {
    indexed: false,
    lastIndexed: null,
    totalEntries: null,
    vectorAvailable: null,
    embeddingProvider: null,
    raw: 'Memory status unavailable',
  }

  let bin: string
  try {
    bin = requireEnv('OPENCLAW_BIN')
  } catch {
    return defaults
  }

  // Note: execSync with hardcoded args is safe here — no user input in command
  try {
    const output = execSync(`${bin} memory status --deep --json`, {
      timeout: 15000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    try {
      const data: unknown = JSON.parse(output)
      // openclaw returns an array of per-agent status objects
      const agents: AgentDeepStatus[] = Array.isArray(data) ? data : [data]
      const primary = agents[0]?.status
      if (!primary) return { ...defaults, raw: output }

      const totalEntries = agents.reduce(
        (sum, a) => sum + (a.status?.chunks ?? 0),
        0,
      )
      const allIndexed = agents.every(
        a => (a.status?.files ?? 0) > 0 && !a.status?.dirty,
      )

      return {
        indexed: allIndexed,
        lastIndexed: null,
        totalEntries,
        vectorAvailable: primary.vector?.available ?? null,
        embeddingProvider: primary.provider ?? null,
        raw: output,
      }
    } catch {
      return { ...defaults, raw: output }
    }
  } catch {
    return defaults
  }
}

// ── computeMemoryStats ──────────────────────────────────────────

export function computeMemoryStats(files: MemoryFileInfo[]): MemoryStats {
  const dailyFiles = files.filter(f => f.category === 'daily')
  const evergreenFiles = files.filter(f => f.category === 'evergreen')

  // Extract dates from daily file names
  const dailyDates = dailyFiles
    .map(f => {
      const match = basename(f.path).match(/^(\d{4}-\d{2}-\d{2})\.md$/)
      return match ? match[1] : null
    })
    .filter((d): d is string => d !== null)
    .sort()

  // Build 30-day timeline
  const timeline: MemoryStats['dailyTimeline'] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const file = dailyFiles.find(f => basename(f.path) === `${dateStr}.md`)
    timeline.push(file ? { date: dateStr, sizeBytes: file.sizeBytes } : null)
  }

  return {
    totalFiles: files.length,
    totalSizeBytes: files.reduce((sum, f) => sum + f.sizeBytes, 0),
    dailyLogCount: dailyFiles.length,
    evergreenCount: evergreenFiles.length,
    oldestDaily: dailyDates[0] ?? null,
    newestDaily: dailyDates[dailyDates.length - 1] ?? null,
    dailyTimeline: timeline,
  }
}
