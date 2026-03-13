import { CronRun } from '@/lib/types'
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import path from 'path'
import { requireEnv } from '@/lib/env'

/** In-memory cache for cron runs (keyed by jobId or '__all__') */
const runCache = new Map<string, { runs: CronRun[]; mtime: number }>()
const RUN_CACHE_TTL = 15_000 // 15 seconds

/** Derive the cron runs directory from WORKSPACE_PATH (go up from workspace to .openclaw/cron/runs) */
function getRunsDir(): string {
  return path.resolve(requireEnv('WORKSPACE_PATH'), '..', 'cron', 'runs')
}

/**
 * Parse a single JSONL line into a CronRun.
 * Returns null if the line can't be parsed or is not a "finished" action.
 */
function parseLine(line: string): CronRun | null {
  if (!line.trim()) return null
  try {
    const obj = JSON.parse(line)
    if (obj.action && obj.action !== 'finished') return null
    const usage = obj.usage && typeof obj.usage.input_tokens === 'number'
      ? {
          input_tokens: obj.usage.input_tokens,
          output_tokens: typeof obj.usage.output_tokens === 'number' ? obj.usage.output_tokens : 0,
          total_tokens: typeof obj.usage.total_tokens === 'number' ? obj.usage.total_tokens : 0,
        }
      : null

    return {
      ts: typeof obj.ts === 'number' ? obj.ts : 0,
      jobId: String(obj.jobId || ''),
      status: obj.status === 'ok' ? 'ok' : 'error',
      summary: typeof obj.summary === 'string' ? obj.summary : null,
      error: typeof obj.error === 'string' ? obj.error : null,
      durationMs: typeof obj.durationMs === 'number' ? obj.durationMs : 0,
      deliveryStatus: typeof obj.deliveryStatus === 'string' ? obj.deliveryStatus : null,
      model: typeof obj.model === 'string' ? obj.model : null,
      provider: typeof obj.provider === 'string' ? obj.provider : null,
      usage,
    }
  } catch {
    return null
  }
}

/**
 * Read JSONL run history files. Returns CronRun[] sorted newest-first.
 * If jobId is provided, reads only that job's file. Otherwise reads all files.
 */
export function getCronRuns(jobId?: string): CronRun[] {
  const runsDir = getRunsDir()
  if (!existsSync(runsDir)) return []

  const cacheKey = jobId || '__all__'

  let files: string[]
  if (jobId) {
    const filePath = path.join(runsDir, `${jobId}.jsonl`)
    files = existsSync(filePath) ? [filePath] : []
  } else {
    files = readdirSync(runsDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => path.join(runsDir, f))
  }

  // Check if any file has been modified since last cache
  let latestMtime = 0
  for (const filePath of files) {
    try {
      const mt = statSync(filePath).mtimeMs
      if (mt > latestMtime) latestMtime = mt
    } catch { /* skip */ }
  }

  const cached = runCache.get(cacheKey)
  if (cached && cached.mtime === latestMtime && Date.now() - cached.mtime < Date.now()) {
    // Files haven't changed — return cached result
    if (latestMtime > 0 && cached.mtime === latestMtime) return cached.runs
  }

  const runs: CronRun[] = []
  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, 'utf-8')
      for (const line of content.split('\n')) {
        const run = parseLine(line)
        if (run) runs.push(run)
      }
    } catch {
      // Skip unreadable files
    }
  }

  runs.sort((a, b) => b.ts - a.ts)
  runCache.set(cacheKey, { runs, mtime: latestMtime })
  return runs
}
