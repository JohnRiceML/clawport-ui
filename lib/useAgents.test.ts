import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAgents } from './useAgents'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  globalThis.fetch = mockFetch
  mockFetch.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function agentsResponse(agents: { id: string; name: string }[]) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(agents),
  })
}

function fingerprintResponse(fp: string) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ fingerprint: fp }),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAgents', () => {
  it('fetches agents on mount', async () => {
    const agents = [{ id: 'a1', name: 'Agent One' }]
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/fingerprint')) return fingerprintResponse('fp-1')
      return agentsResponse(agents)
    })

    const { result } = renderHook(() => useAgents())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.agents).toEqual(agents)
    expect(result.current.error).toBeNull()
    expect(result.current.lastUpdated).toBeTypeOf('number')
  })

  it('polls fingerprint at interval', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/fingerprint')) return fingerprintResponse('fp-1')
      return agentsResponse([])
    })

    renderHook(() => useAgents())

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const callsBefore = mockFetch.mock.calls.filter(
      (c: string[]) => c[0]?.toString().includes('/fingerprint')
    ).length

    // Advance past one poll interval (30s)
    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })

    const callsAfter = mockFetch.mock.calls.filter(
      (c: string[]) => c[0]?.toString().includes('/fingerprint')
    ).length

    expect(callsAfter).toBeGreaterThan(callsBefore)
  })

  it('skips refetch when fingerprint is unchanged', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/fingerprint')) return fingerprintResponse('fp-same')
      return agentsResponse([{ id: 'x', name: 'X' }])
    })

    renderHook(() => useAgents())

    await waitFor(() => {
      // Initial agent fetch + initial fingerprint fetch complete
      expect(mockFetch).toHaveBeenCalled()
    })

    const agentCallsBefore = mockFetch.mock.calls.filter(
      (c: string[]) => c[0]?.toString() === '/api/agents'
    ).length

    // Poll — fingerprint unchanged
    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })

    const agentCallsAfter = mockFetch.mock.calls.filter(
      (c: string[]) => c[0]?.toString() === '/api/agents'
    ).length

    // No additional agent fetches
    expect(agentCallsAfter).toBe(agentCallsBefore)
  })

  it('refetches when fingerprint changes', async () => {
    let fpCounter = 0
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/fingerprint')) {
        fpCounter++
        return fingerprintResponse(`fp-${fpCounter}`)
      }
      return agentsResponse([{ id: 'a', name: 'A' }])
    })

    renderHook(() => useAgents())

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const agentCallsBefore = mockFetch.mock.calls.filter(
      (c: string[]) => c[0]?.toString() === '/api/agents'
    ).length

    // Poll — fingerprint changes (fp-2 vs fp-1)
    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })

    await waitFor(() => {
      const agentCallsAfter = mockFetch.mock.calls.filter(
        (c: string[]) => c[0]?.toString() === '/api/agents'
      ).length
      expect(agentCallsAfter).toBeGreaterThan(agentCallsBefore)
    })
  })

  it('pauses polling when document is hidden', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/fingerprint')) return fingerprintResponse('fp-1')
      return agentsResponse([])
    })

    renderHook(() => useAgents())

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // Simulate tab hidden
    Object.defineProperty(document, 'hidden', { value: true, writable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    const callsBefore = mockFetch.mock.calls.length

    await act(async () => {
      vi.advanceTimersByTime(60_000) // Advance 2 intervals
    })

    // No new calls while hidden
    expect(mockFetch.mock.calls.length).toBe(callsBefore)

    // Restore
    Object.defineProperty(document, 'hidden', { value: false, writable: true })
  })

  it('resumes + checks immediately when document becomes visible', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/fingerprint')) return fingerprintResponse('fp-1')
      return agentsResponse([])
    })

    renderHook(() => useAgents())

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // Hide tab
    Object.defineProperty(document, 'hidden', { value: true, writable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    const callsBefore = mockFetch.mock.calls.filter(
      (c: string[]) => c[0]?.toString().includes('/fingerprint')
    ).length

    // Show tab
    Object.defineProperty(document, 'hidden', { value: false, writable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => {
      const callsAfter = mockFetch.mock.calls.filter(
        (c: string[]) => c[0]?.toString().includes('/fingerprint')
      ).length
      // Immediate fingerprint check on visibility
      expect(callsAfter).toBeGreaterThan(callsBefore)
    })
  })

  it('refresh() triggers immediate full refetch', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/fingerprint')) return fingerprintResponse('fp-1')
      return agentsResponse([{ id: 'b', name: 'B' }])
    })

    const { result } = renderHook(() => useAgents())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const agentCallsBefore = mockFetch.mock.calls.filter(
      (c: string[]) => c[0]?.toString() === '/api/agents'
    ).length

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      const agentCallsAfter = mockFetch.mock.calls.filter(
        (c: string[]) => c[0]?.toString() === '/api/agents'
      ).length
      expect(agentCallsAfter).toBeGreaterThan(agentCallsBefore)
    })
  })
})
