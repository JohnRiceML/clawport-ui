/**
 * Setup detection helpers — extracted from scripts/setup.mjs for testability.
 *
 * These functions detect the user's OpenClaw installation state:
 *   - Workspace directory location
 *   - Gateway auth token from openclaw.json
 *   - HTTP endpoint configuration
 *   - OpenClaw binary on PATH
 *
 * Used by: npm run setup, clawport setup, clawport doctor
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { execSync } from 'child_process'

// ── Workspace ─────────────────────────────────────────────────────

/**
 * Detect the default workspace path.
 *
 * Checks in order:
 *   1. ~/.openclaw/agents/main/workspace  (current agent-scoped layout)
 *   2. ~/.openclaw/workspace-main         (multi-agent layout, main agent)
 *   3. ~/.openclaw/workspace-*            (multi-agent layout, any agent)
 *   4. ~/.openclaw/workspace              (legacy single-workspace layout)
 */
export function detectWorkspacePath(): string | null {
  const base = join(homedir(), '.openclaw')

  // 1. Current agent-scoped layout
  const agentPath = join(base, 'agents', 'main', 'workspace')
  if (existsSync(agentPath)) return agentPath

  // 2. Multi-agent layout: workspace-main
  const multiMain = join(base, 'workspace-main')
  if (existsSync(multiMain)) return multiMain

  // 3. Multi-agent layout: first workspace-<agentId> found
  try {
    const entries = readdirSync(base)
    const workspaceDirs = entries
      .filter((e) => typeof e === 'string' && e.startsWith('workspace-'))
      .sort()
    if (workspaceDirs.length > 0) {
      return join(base, workspaceDirs[0] as string)
    }
  } catch {
    // ~/.openclaw doesn't exist or isn't readable
  }

  // 4. Legacy single-workspace layout
  const legacyPath = join(base, 'workspace')
  if (existsSync(legacyPath)) return legacyPath

  return null
}

// ── Binary ────────────────────────────────────────────────────────

/** Find the openclaw binary on PATH. */
export function detectOpenClawBin(): string | null {
  const cmd = process.platform === 'win32' ? 'where' : 'which'
  try {
    return execSync(`${cmd} openclaw`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return null
  }
}

// ── Gateway Token ─────────────────────────────────────────────────

/** Read the gateway auth token from ~/.openclaw/openclaw.json. */
export function detectGatewayToken(): string | null {
  const configPath = join(homedir(), '.openclaw', 'openclaw.json')
  if (!existsSync(configPath)) return null
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    const token = config?.gateway?.auth?.token
    return typeof token === 'string' ? token : null
  } catch {
    return null
  }
}

// ── Gateway Port ──────────────────────────────────────────────────

/** Read the gateway HTTP port from ~/.openclaw/openclaw.json. Returns null if not set or default. */
export function detectGatewayPort(): number | null {
  const configPath = join(homedir(), '.openclaw', 'openclaw.json')
  if (!existsSync(configPath)) return null
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    const port = config?.gateway?.http?.port
    return typeof port === 'number' ? port : null
  } catch {
    return null
  }
}

// ── HTTP Endpoint ─────────────────────────────────────────────────

/** Check if the HTTP chat completions endpoint is enabled in openclaw.json. */
export function checkHttpEndpointEnabled(): boolean | null {
  const configPath = join(homedir(), '.openclaw', 'openclaw.json')
  if (!existsSync(configPath)) return null
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    return config?.gateway?.http?.endpoints?.chatCompletions?.enabled === true
  } catch {
    return null
  }
}

/** Enable the HTTP chat completions endpoint in openclaw.json. */
export function enableHttpEndpoint(): boolean {
  const configPath = join(homedir(), '.openclaw', 'openclaw.json')
  if (!existsSync(configPath)) return false
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    if (!config.gateway) config.gateway = {}
    if (!config.gateway.http) config.gateway.http = {}
    if (!config.gateway.http.endpoints) config.gateway.http.endpoints = {}
    if (!config.gateway.http.endpoints.chatCompletions) config.gateway.http.endpoints.chatCompletions = {}
    config.gateway.http.endpoints.chatCompletions.enabled = true
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
    return true
  } catch {
    return false
  }
}

// ── Summary ───────────────────────────────────────────────────────

export interface DetectionResult {
  workspacePath: string | null
  openclawBin: string | null
  gatewayToken: string | null
  gatewayPort: number | null
  httpEndpointEnabled: boolean | null
}

/** Run all detectors and return a summary. */
export function detectAll(): DetectionResult {
  return {
    workspacePath: detectWorkspacePath(),
    openclawBin: detectOpenClawBin(),
    gatewayToken: detectGatewayToken(),
    gatewayPort: detectGatewayPort(),
    httpEndpointEnabled: checkHttpEndpointEnabled(),
  }
}
