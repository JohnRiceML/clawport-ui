import { describe, expect, it } from 'vitest'
import { renderStakeholderReport } from '@/lib/stakeholder/report'
import type { StakeholderSummary } from '@/lib/stakeholder/types'

const summary: StakeholderSummary = {
  range: '7d',
  generatedAt: '2026-03-13T12:00:00.000Z',
  overallStatus: 'needs_attention',
  executiveSummary: '2 recent updates were completed, with 1 issue needing attention.',
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
  risks: [
    {
      id: 'r1',
      title: 'Daily Digest',
      summary: 'The latest digest missed its delivery window.',
      severity: 'medium',
      ownerAgentId: 'ops',
      ownerName: 'OPS',
      relatedJobId: 'daily-digest',
      detectedAt: Date.parse('2026-03-13T09:00:00.000Z'),
    },
  ],
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
    failedDeliveries: 1,
    openRisks: 1,
    completedOutputs: 1,
  },
}

describe('renderStakeholderReport', () => {
  it('renders a complete markdown report', () => {
    const markdown = renderStakeholderReport(summary, { title: 'Client Summary' })

    expect(markdown).toContain('# Client Summary')
    expect(markdown).toContain('Status: **Needs Attention**')
    expect(markdown).toContain('## Key Outcomes')
    expect(markdown).toContain('## Risks And Blockers')
    expect(markdown).toContain('Weekly Brief')
    expect(markdown).toContain('client@example.com')
  })
})
