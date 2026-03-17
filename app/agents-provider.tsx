'use client'

import { createContext, useContext } from 'react'
import { useAgents, type UseAgentsResult } from '@/lib/useAgents'

const AgentsContext = createContext<UseAgentsResult>({
  agents: [],
  loading: true,
  error: null,
  refresh: () => {},
  lastUpdated: null,
})

export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const agentsState = useAgents()
  return (
    <AgentsContext.Provider value={agentsState}>
      {children}
    </AgentsContext.Provider>
  )
}

export const useAgentsContext = () => useContext(AgentsContext)
