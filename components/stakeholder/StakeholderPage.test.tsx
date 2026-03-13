import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StakeholderPage } from '@/components/stakeholder/StakeholderPage'
import type { StakeholderSummary } from '@/lib/stakeholder/types'

const summary: StakeholderSummary = {
  range: '7d',
  generatedAt: '2026-03-13T12:00:00.000Z',
  overallStatus: 'on_track',
  executiveSummary: '1 delivery completed across the last 7 days, with 1 next update scheduled.',
  outcomes: [
    {
      id: 'o1',
      title: 'Weekly Brief',
      summary: 'Delivered the weekly research brief.',
      ownerAgentId: 'ops',
      ownerName: 'OPS',
      ts: Date.parse('2026-03-12T10:00:00.000Z'),
    },
  ],
  deliverables: [
    {
      id: 'd1',
      jobId: 'weekly-brief',
      title: 'Weekly Brief',
      summary: 'Delivered the weekly research brief.',
      deliveredAt: Date.parse('2026-03-12T10:00:00.000Z'),
      ownerAgentId: 'ops',
      ownerName: 'OPS',
      channel: 'email',
      destinationLabel: 'client@example.com',
    },
  ],
  risks: [],
  upcoming: [
    {
      jobId: 'next-brief',
      title: 'Next Weekly Brief',
      nextRun: '2026-03-14T08:00:00.000Z',
      ownerAgentId: 'ops',
      ownerName: 'OPS',
      expectedChannel: 'email',
    },
  ],
  metrics: {
    successfulDeliveries: 1,
    failedDeliveries: 0,
    openRisks: 0,
    completedOutputs: 1,
  },
}

describe('StakeholderPage', () => {
  const mockFetch = vi.fn()
  const mockOpen = vi.fn()

  beforeEach(() => {
    mockFetch.mockReset()
    mockOpen.mockReset()
    vi.stubGlobal('fetch', mockFetch)
    vi.stubGlobal('open', mockOpen)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders stakeholder summary data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => summary,
    })

    render(
      <StakeholderPage
        audienceLabel="Stakeholder"
        summaryPath="/api/stakeholder/summary"
        exportPath="/api/stakeholder/export"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Stakeholder Hub')).toBeTruthy()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/stakeholder/summary?range=7d')
    expect(screen.getByText('Stakeholder Summary')).toBeTruthy()
    expect(screen.getAllByText('Weekly Brief').length).toBeGreaterThan(0)
  })

  it('uses client wording and exports through the client endpoint', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => summary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://docs.google.com/document/d/123/edit' }),
      })

    render(
      <StakeholderPage
        audienceLabel="Client"
        summaryPath="/api/client/summary"
        exportPath="/api/client/export"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Client Hub')).toBeTruthy()
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Export' })[0])

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith(
        '/api/client/export',
        expect.objectContaining({
          method: 'POST',
        }),
      )
    })

    expect(mockOpen).toHaveBeenCalledWith(
      'https://docs.google.com/document/d/123/edit',
      '_blank',
      'noopener,noreferrer',
    )
  })
})
