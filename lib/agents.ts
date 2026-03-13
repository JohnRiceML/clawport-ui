import { Agent } from '@/lib/types'
import { readFileSync, existsSync } from 'fs'
import { loadRegistry } from '@/lib/agents-registry'

/** In-memory cache for agent list (avoids re-scanning workspace on every request) */
let agentCache: { agents: Agent[]; ts: number } | null = null
const AGENT_CACHE_TTL = 30_000 // 30 seconds

/** Clear the agent cache (used by tests) */
export function clearAgentCache(): void {
  agentCache = null
}

export async function getAgents(): Promise<Agent[]> {
  if (agentCache && Date.now() - agentCache.ts < AGENT_CACHE_TTL) {
    return agentCache.agents
  }

  const workspacePath = process.env.WORKSPACE_PATH || ''
  const registry = loadRegistry()

  const agents = registry.map((entry) => {
    let soul: string | null = null
    if (entry.soulPath && workspacePath) {
      try {
        const fullPath = workspacePath + '/' + entry.soulPath
        if (existsSync(fullPath)) {
          soul = readFileSync(fullPath, 'utf-8')
        }
      } catch {
        soul = null
      }
    }
    return {
      ...entry,
      soul,
      crons: [],
    }
  })

  agentCache = { agents, ts: Date.now() }
  return agents
}

export async function getAgent(id: string): Promise<Agent | null> {
  const agents = await getAgents()
  return agents.find((a) => a.id === id) ?? null
}
