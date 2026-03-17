import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const COMPOSIO_API_BASE = 'https://backend.composio.dev'

export interface ComposioConnection {
  id: string
  app: string
  status: 'active' | 'expired' | 'failed' | 'initiated' | 'inactive' | 'initializing'
}

/**
 * Read the Composio API key from the OpenClaw workspace .env file.
 */
function readComposioApiKey(): string | null {
  const workspacePath = process.env.WORKSPACE_PATH || null
  const openClawRoot = workspacePath
    ? (() => {
        const match = workspacePath.match(/^(.*?\/\.openclaw)(?:\/.*)?$/)
        return match?.[1] ?? join(workspacePath, '..')
      })()
    : join(homedir(), '.openclaw')

  const envPath = join(openClawRoot, '.env')
  if (!existsSync(envPath)) return null

  try {
    const content = readFileSync(envPath, 'utf-8')
    const match = content.match(/^COMPOSIO_API_KEY=(.+)$/m)
    return match?.[1]?.trim() || null
  } catch {
    return null
  }
}

/**
 * Fetch connected accounts from the Composio API.
 * Returns an empty array if the API key is not configured or the request fails.
 */
export async function getComposioConnections(): Promise<ComposioConnection[]> {
  const apiKey = readComposioApiKey()
  if (!apiKey) return []

  try {
    const url = new URL('/api/v3/connected_accounts', COMPOSIO_API_BASE)
    url.searchParams.set('limit', '100')

    const response = await fetch(url.toString(), {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) return []

    const data = await response.json() as {
      items?: Array<{
        id: string
        toolkit?: { slug: string }
        status: string
      }>
    }

    if (!Array.isArray(data.items)) return []

    return data.items.map((item) => ({
      id: item.id,
      app: item.toolkit?.slug || 'unknown',
      status: item.status.toLowerCase() as ComposioConnection['status'],
    }))
  } catch {
    return []
  }
}

/**
 * Get just the names of actively connected Composio services.
 * Suitable for injecting into prompts.
 */
export async function getActiveComposioApps(): Promise<string[]> {
  const connections = await getComposioConnections()
  return [...new Set(
    connections
      .filter((c) => c.status === 'active')
      .map((c) => c.app)
  )]
}
