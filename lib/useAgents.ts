'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Agent } from '@/lib/types'

const POLL_INTERVAL = 30_000 // 30 seconds

export interface UseAgentsResult {
  agents: Agent[]
  loading: boolean
  error: string | null
  /** Force an immediate full refetch */
  refresh: () => void
  /** Timestamp of last successful fetch */
  lastUpdated: number | null
}

export function useAgents(): UseAgentsResult {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const fingerprintRef = useRef<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Full agent fetch
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents')
      if (!res.ok) throw new Error('Failed to fetch agents')
      const data: Agent[] = await res.json()
      setAgents(data)
      setError(null)
      setLastUpdated(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Check fingerprint and refetch if changed
  const checkFingerprint = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/fingerprint')
      if (!res.ok) return
      const { fingerprint } = await res.json()
      if (fingerprintRef.current !== null && fingerprint !== fingerprintRef.current) {
        fetchAgents()
      }
      fingerprintRef.current = fingerprint
    } catch {
      // Silently ignore fingerprint check failures
    }
  }, [fetchAgents])

  // Public refresh: force full refetch + update fingerprint
  const refresh = useCallback(() => {
    setLoading(true)
    fetchAgents().then(() => {
      // Update fingerprint after refetch so next poll doesn't double-fetch
      fetch('/api/agents/fingerprint')
        .then(r => r.json())
        .then(({ fingerprint }) => {
          fingerprintRef.current = fingerprint
        })
        .catch(() => {})
    })
  }, [fetchAgents])

  // Initial fetch + start polling
  useEffect(() => {
    // Fetch agents + initial fingerprint in parallel
    fetchAgents()
    fetch('/api/agents/fingerprint')
      .then(r => r.json())
      .then(({ fingerprint }) => {
        fingerprintRef.current = fingerprint
      })
      .catch(() => {})

    intervalRef.current = setInterval(checkFingerprint, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchAgents, checkFingerprint])

  // Pause polling when tab is hidden, resume + immediate check when visible
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      } else {
        // Immediate check on tab focus
        checkFingerprint()
        intervalRef.current = setInterval(checkFingerprint, POLL_INTERVAL)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkFingerprint])

  return { agents, loading, error, refresh, lastUpdated }
}
