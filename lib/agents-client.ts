import type { Agent } from '@/lib/types'

const CLIENT_CACHE_TTL_MS = 30_000

let cachedAgents: Agent[] | null = null
let cachedAt = 0
let inFlightRequest: Promise<Agent[]> | null = null

function normalizeAgents(data: unknown): Agent[] {
  return Array.isArray(data) ? data as Agent[] : []
}

export function clearAgentsClientCache() {
  cachedAgents = null
  cachedAt = 0
  inFlightRequest = null
}

export async function fetchAgentsClient(force = false): Promise<Agent[]> {
  const now = Date.now()

  if (!force && cachedAgents && now - cachedAt < CLIENT_CACHE_TTL_MS) {
    return cachedAgents
  }

  if (!force && inFlightRequest) {
    return inFlightRequest
  }

  inFlightRequest = fetch('/api/agents')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
    .then((data: unknown) => {
      const normalized = normalizeAgents(data)
      cachedAgents = normalized
      cachedAt = Date.now()
      return normalized
    })
    .finally(() => {
      inFlightRequest = null
    })

  return inFlightRequest
}
