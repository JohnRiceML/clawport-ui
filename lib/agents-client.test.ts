import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAgentsCached, resetAgentsCacheForTests } from '@/lib/agents-client'
import type { Agent } from '@/lib/types'

function mockResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response
}

const SAMPLE_AGENTS: Agent[] = [
  {
    id: 'alpha',
    name: 'Alpha',
    title: 'Lead',
    reportsTo: null,
    directReports: [],
    soulPath: null,
    soul: null,
    voiceId: null,
    color: '#4477ff',
    emoji: 'robot',
    model: null,
    tools: [],
    crons: [],
    memoryPath: null,
    description: '',
  },
]

describe('fetchAgentsCached', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    resetAgentsCacheForTests()
  })

  it('deduplicates in-flight requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(SAMPLE_AGENTS))
    vi.stubGlobal('fetch', fetchMock)

    const [a, b] = await Promise.all([
      fetchAgentsCached({ ttlMs: 1000 }),
      fetchAgentsCached({ ttlMs: 1000 }),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toEqual(SAMPLE_AGENTS)
    expect(b).toEqual(SAMPLE_AGENTS)
  })

  it('returns cached data inside TTL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(SAMPLE_AGENTS))
    vi.stubGlobal('fetch', fetchMock)

    await fetchAgentsCached({ ttlMs: 1000 })
    await fetchAgentsCached({ ttlMs: 1000 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refreshes after TTL expires', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-11T00:00:00Z'))

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(SAMPLE_AGENTS))
      .mockResolvedValueOnce(mockResponse([
        {
          id: 'beta',
          name: 'Beta',
          title: 'Worker',
          reportsTo: null,
          directReports: [],
          soulPath: null,
          soul: null,
          voiceId: null,
          color: '#44cc88',
          emoji: 'worker',
          model: null,
          tools: [],
          crons: [],
          memoryPath: null,
          description: '',
        },
      ]))
    vi.stubGlobal('fetch', fetchMock)

    const first = await fetchAgentsCached({ ttlMs: 50 })
    vi.advanceTimersByTime(51)
    const second = await fetchAgentsCached({ ttlMs: 50 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(first[0].id).toBe('alpha')
    expect(second[0].id).toBe('beta')
  })

  it('bypasses cache when forced', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(SAMPLE_AGENTS))
      .mockResolvedValueOnce(mockResponse(SAMPLE_AGENTS))
    vi.stubGlobal('fetch', fetchMock)

    await fetchAgentsCached({ ttlMs: 1000 })
    await fetchAgentsCached({ force: true, ttlMs: 1000 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
