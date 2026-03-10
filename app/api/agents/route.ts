import { getAgents } from '@/lib/agents'
import { apiErrorResponse } from '@/lib/api-error'
import { NextResponse } from 'next/server'

const CACHE_TTL_MS = 15_000

let cachedAgents: Awaited<ReturnType<typeof getAgents>> | null = null
let cacheExpiresAt = 0
let inFlightAgentsLoad: Promise<Awaited<ReturnType<typeof getAgents>>> | null = null

async function getAgentsCached(): Promise<Awaited<ReturnType<typeof getAgents>>> {
  const now = Date.now()
  if (cachedAgents && now < cacheExpiresAt) {
    return cachedAgents
  }
  if (inFlightAgentsLoad) {
    return inFlightAgentsLoad
  }

  inFlightAgentsLoad = getAgents()
    .then((agents) => {
      cachedAgents = agents
      cacheExpiresAt = Date.now() + CACHE_TTL_MS
      return agents
    })
    .finally(() => {
      inFlightAgentsLoad = null
    })

  return inFlightAgentsLoad
}

export async function GET() {
  try {
    const agents = await getAgentsCached()
    return NextResponse.json(agents)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load agents')
  }
}
