import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { homedir } from 'os'
import { detectOpenClawBin, checkHttpEndpointEnabled, detectGatewayPort } from '@/lib/setup-detection'
import type {
  IntegrationBindingSummary,
  IntegrationItem,
  IntegrationsSummary,
} from '@/lib/types'

function resolveConfigPath(): { workspacePath: string | null; configPath: string } {
  const workspacePath = process.env.WORKSPACE_PATH || null
  const configPath = workspacePath
    ? join(dirname(workspacePath), 'openclaw.json')
    : join(homedir(), '.openclaw', 'openclaw.json')
  return { workspacePath, configPath }
}

function readConfig(configPath: string): Record<string, unknown> | null {
  if (!existsSync(configPath)) return null
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function redactValue(key: string, value: unknown): string {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`
  if (!value) return 'not set'

  const lowerKey = key.toLowerCase()
  if (
    lowerKey.includes('token') ||
    lowerKey.includes('secret') ||
    lowerKey.includes('apikey') ||
    lowerKey.includes('api_key') ||
    lowerKey.includes('password')
  ) {
    return 'configured'
  }

  const text = String(value)
  if (text.length > 64) return `${text.slice(0, 24)}...`
  return text
}

function summarizeRecord(record: Record<string, unknown>, skipKeys: string[] = []): string[] {
  return Object.entries(record)
    .filter(([key]) => !skipKeys.includes(key))
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${redactValue(key, value)}`)
}

function buildEntryList(entries: unknown, enabledKey = 'enabled'): IntegrationItem[] {
  if (!isRecord(entries)) return []
  return Object.entries(entries)
    .map(([id, raw]) => {
      if (!isRecord(raw)) {
        return {
          id,
          enabled: null,
          summary: [typeof raw === 'undefined' ? 'not configured' : redactValue(id, raw)],
        }
      }
      const enabled = typeof raw[enabledKey] === 'boolean' ? (raw[enabledKey] as boolean) : null
      return {
        id,
        enabled,
        summary: summarizeRecord(raw, [enabledKey]),
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

function buildToolsList(tools: unknown): IntegrationItem[] {
  if (!isRecord(tools)) return []
  return Object.entries(tools)
    .map(([id, raw]) => {
      if (!isRecord(raw)) {
        return { id, enabled: null, summary: [redactValue(id, raw)] }
      }
      const summary = Object.entries(raw).map(([name, value]) => {
        if (isRecord(value)) {
          const state =
            typeof value.enabled === 'boolean'
              ? value.enabled
                ? 'enabled'
                : 'disabled'
              : 'configured'
          return `${name}: ${state}`
        }
        return `${name}: ${redactValue(name, value)}`
      })
      const enabled = summary.some((line) => line.endsWith('enabled'))
      return { id, enabled, summary }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

function buildSkillsList(skills: unknown): IntegrationItem[] {
  if (!isRecord(skills)) return []
  const entries = isRecord(skills.entries) ? skills.entries : {}
  return Object.entries(entries)
    .map(([id, raw]) => {
      if (!isRecord(raw)) {
        return { id, enabled: null, summary: [redactValue(id, raw)] }
      }
      const summary = Object.keys(raw).length === 0 ? ['configured with default settings'] : summarizeRecord(raw)
      return { id, enabled: true, summary }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

function buildBindingsList(bindings: unknown): IntegrationBindingSummary[] {
  if (!Array.isArray(bindings)) return []
  return bindings
    .map((binding) => {
      if (!isRecord(binding)) return null
      const agentId = typeof binding.agentId === 'string' ? binding.agentId : 'unknown'
      const match = isRecord(binding.match) ? binding.match : null
      const channel = match && typeof match.channel === 'string' ? match.channel : 'unknown'
      const peerObj = match && isRecord(match.peer) ? match.peer : null
      const peerKind = peerObj && typeof peerObj.kind === 'string' ? peerObj.kind : 'peer'
      const peerId = peerObj && typeof peerObj.id === 'string' ? peerObj.id : 'unknown'
      return { agentId, channel, peer: `${peerKind}:${peerId}` }
    })
    .filter((item): item is IntegrationBindingSummary => item !== null)
}

export function getIntegrationsSummary(): IntegrationsSummary {
  const { workspacePath, configPath } = resolveConfigPath()
  const config = readConfig(configPath)

  return {
    workspacePath,
    configPath,
    openclawBin: detectOpenClawBin(),
    gatewayPort: detectGatewayPort(),
    httpEndpointEnabled: checkHttpEndpointEnabled(),
    channels: buildEntryList(config?.channels),
    tools: buildToolsList(config?.tools),
    plugins: buildEntryList(isRecord(config?.plugins) ? config?.plugins.entries : null),
    skills: buildSkillsList(config?.skills),
    bindings: buildBindingsList(config?.bindings),
    configFound: config !== null,
  }
}

// ---------------------------------------------------------------------------
// Google Workspace detection — reads openclaw.json for GWS config written by
// the Monarck admin deployer.
// ---------------------------------------------------------------------------

export interface GoogleWorkspaceConfig {
  /** Whether Google Drive is listed in google_integrations */
  driveEnabled: boolean
  /** Auth method: 'composio' | 'gws_oauth' | 'gws_service_account' */
  authMethod: string
  /** Service account JSON (only for gws_service_account) */
  saJson: string | null
  /** Impersonate email for domain-wide delegation */
  impersonateEmail: string | null
}

/**
 * Check whether Google Drive integration is configured in the OpenClaw
 * workspace config (deployed by the Monarck admin panel).
 *
 * Returns null if no Google Drive config is found.
 */
export function getGoogleWorkspaceConfig(): GoogleWorkspaceConfig | null {
  const { configPath } = resolveConfigPath()
  const config = readConfig(configPath)
  if (!config) return null

  const authMethod = typeof config.google_auth_method === 'string'
    ? config.google_auth_method
    : 'composio'

  // Check google_integrations array for google_drive
  const integrations = Array.isArray(config.google_integrations)
    ? (config.google_integrations as string[])
    : []

  const driveEnabled = integrations.includes('google_drive')

  // Also check if google_drive appears as a composio integration
  const composioIntegrations = Array.isArray(config.composio_integrations)
    ? (config.composio_integrations as string[])
    : []
  const driveInComposio = composioIntegrations.includes('google_drive')

  if (!driveEnabled && !driveInComposio) return null

  return {
    driveEnabled: true,
    authMethod,
    saJson: typeof config.google_sa_json === 'string' ? config.google_sa_json : null,
    impersonateEmail: typeof config.google_impersonate_email === 'string'
      ? config.google_impersonate_email
      : null,
  }
}
