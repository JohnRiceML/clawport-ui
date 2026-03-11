import type { Agent } from '@/lib/types'

const DEFAULT_TTL_MS = 5_000

let cache: { agents: Agent[]; expiresAt: number } | null = null
let inFlight: Promise<Agent[]> | null = null

async function fetchAgentsFromApi(): Promise<Agent[]> {
  const res = await fetch('/api/agents')
  if (!res.ok) {
    throw new Error(`Failed to fetch agents: HTTP ${res.status}`)
  }
  const data = await res.json()
  if (!Array.isArray(data)) {
    throw new Error('Failed to fetch agents: invalid payload')
  }
  return data as Agent[]
}

export async function fetchAgentsCached(options?: {
  force?: boolean
  ttlMs?: number
}): Promise<Agent[]> {
  const force = options?.force ?? false
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS
  const now = Date.now()

  if (!force && cache && cache.expiresAt > now) {
    return cache.agents
  }

  if (inFlight) return inFlight

  inFlight = fetchAgentsFromApi()
    .then((agents) => {
      cache = {
        agents,
        expiresAt: Date.now() + Math.max(0, ttlMs),
      }
      return agents
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}

export function resetAgentsCacheForTests() {
  cache = null
  inFlight = null
}
