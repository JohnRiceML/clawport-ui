import { existsSync, readFileSync } from 'fs'
import path from 'path'

export type StakeholderDefaultVisibility = 'delivery_only'
export type StakeholderJobPriority = 'primary'

export interface StakeholderJobConfig {
  visible?: boolean
  title?: string
  priority?: StakeholderJobPriority
}

export interface StakeholderConfig {
  defaultVisibility: StakeholderDefaultVisibility
  jobs: Record<string, StakeholderJobConfig>
}

export const DEFAULT_STAKEHOLDER_CONFIG: StakeholderConfig = {
  defaultVisibility: 'delivery_only',
  jobs: {},
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeJobConfig(value: unknown): StakeholderJobConfig | null {
  if (!isRecord(value)) return null

  const next: StakeholderJobConfig = {}

  if (typeof value.visible === 'boolean') {
    next.visible = value.visible
  }

  if (typeof value.title === 'string' && value.title.trim()) {
    next.title = value.title.trim()
  }

  if (value.priority === 'primary') {
    next.priority = 'primary'
  }

  return next
}

export function resolveStakeholderConfigPath(
  workspacePath = process.env.WORKSPACE_PATH || null,
): string | null {
  if (!workspacePath) return null
  return path.join(workspacePath, 'clawport', 'stakeholder.json')
}

export function loadStakeholderConfig(
  workspacePath = process.env.WORKSPACE_PATH || null,
): StakeholderConfig {
  const configPath = resolveStakeholderConfigPath(workspacePath)
  if (!configPath || !existsSync(configPath)) {
    return DEFAULT_STAKEHOLDER_CONFIG
  }

  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
    const defaultVisibility =
      raw.defaultVisibility === 'delivery_only'
        ? 'delivery_only'
        : DEFAULT_STAKEHOLDER_CONFIG.defaultVisibility

    const jobs: Record<string, StakeholderJobConfig> = {}
    const rawJobs = isRecord(raw.jobs) ? raw.jobs : {}

    for (const [jobId, value] of Object.entries(rawJobs)) {
      const normalized = normalizeJobConfig(value)
      if (normalized) {
        jobs[jobId] = normalized
      }
    }

    return {
      defaultVisibility,
      jobs,
    }
  } catch (err) {
    console.warn(
      `Failed to read stakeholder config from ${configPath}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    return DEFAULT_STAKEHOLDER_CONFIG
  }
}
