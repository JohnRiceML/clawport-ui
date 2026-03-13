import { describe, expect, it } from 'vitest'
import type { Agent, CronJob, CronRun } from '@/lib/types'
import { buildStakeholderSummary } from '@/lib/stakeholder/summary'
import type { StakeholderConfig } from '@/lib/stakeholder/config'

const NOW = Date.parse('2026-03-13T12:00:00.000Z')

const agents: Agent[] = [
  {
    id: 'ops',
    name: 'OPS',
    title: 'Operations Lead',
    reportsTo: null,
    directReports: [],
    soulPath: null,
    soul: null,
    voiceId: null,
    color: '#000000',
    emoji: 'o',
    model: null,
    tools: [],
    crons: [],
    memoryPath: null,
    description: 'Operations',
  },
]

const baseCron: CronJob = {
  id: 'weekly-brief',
  name: 'Weekly Brief',
  schedule: '0 9 * * 1',
  scheduleDescription: 'Mondays at 9 AM',
  timezone: null,
  status: 'ok',
  lastRun: null,
  nextRun: new Date(NOW + 60 * 60 * 1000).toISOString(),
  lastError: null,
  agentId: 'ops',
  description: null,
  enabled: true,
  delivery: {
    mode: 'push',
    channel: 'email',
    to: 'client@example.com',
  },
  lastDurationMs: null,
  consecutiveErrors: 0,
  lastDeliveryStatus: 'delivered',
}

function buildSummary(params: {
  crons?: CronJob[]
  runs?: CronRun[]
  config?: StakeholderConfig
}) {
  return buildStakeholderSummary({
    range: '7d',
    now: NOW,
    agents,
    crons: params.crons || [baseCron],
    runs: params.runs || [],
    config: params.config,
  })
}

describe('buildStakeholderSummary', () => {
  it('defaults to on_track with delivered outcomes', () => {
    const summary = buildSummary({
      runs: [
        {
          ts: NOW - 2 * 60 * 60 * 1000,
          jobId: 'weekly-brief',
          status: 'ok',
          summary: 'Sent the weekly client brief.',
          error: null,
          durationMs: 1000,
          deliveryStatus: 'delivered',
          model: null,
          provider: null,
          usage: null,
        },
      ],
    })

    expect(summary.overallStatus).toBe('on_track')
    expect(summary.outcomes).toHaveLength(1)
    expect(summary.deliverables).toHaveLength(1)
    expect(summary.metrics.successfulDeliveries).toBe(1)
  })

  it('deduplicates outcomes by job id', () => {
    const summary = buildSummary({
      runs: [
        {
          ts: NOW - 1000,
          jobId: 'weekly-brief',
          status: 'ok',
          summary: 'Latest summary',
          error: null,
          durationMs: 1000,
          deliveryStatus: 'delivered',
          model: null,
          provider: null,
          usage: null,
        },
        {
          ts: NOW - 2000,
          jobId: 'weekly-brief',
          status: 'ok',
          summary: 'Older summary',
          error: null,
          durationMs: 1000,
          deliveryStatus: 'delivered',
          model: null,
          provider: null,
          usage: null,
        },
      ],
    })

    expect(summary.outcomes).toHaveLength(1)
    expect(summary.outcomes[0].summary).toBe('Latest summary')
  })

  it('marks repeated failures on a primary job as blocked', () => {
    const summary = buildSummary({
      config: {
        defaultVisibility: 'delivery_only',
        jobs: {
          'weekly-brief': { priority: 'primary' },
        },
      },
      crons: [
        {
          ...baseCron,
          status: 'error',
          consecutiveErrors: 3,
          lastError: 'SMTP timeout',
        },
      ],
      runs: [
        {
          ts: NOW - 30 * 60 * 1000,
          jobId: 'weekly-brief',
          status: 'error',
          summary: null,
          error: 'SMTP timeout',
          durationMs: 1000,
          deliveryStatus: 'unknown',
          model: null,
          provider: null,
          usage: null,
        },
      ],
    })

    expect(summary.overallStatus).toBe('blocked')
    expect(summary.risks[0].severity).toBe('high')
  })

  it('creates a medium risk for missing delivery target', () => {
    const summary = buildSummary({
      crons: [
        {
          ...baseCron,
          delivery: { ...baseCron.delivery!, to: null },
        },
      ],
    })

    expect(summary.overallStatus).toBe('needs_attention')
    expect(summary.risks[0].summary).toContain('destination is missing')
    expect(summary.risks[0].severity).toBe('medium')
  })

  it('respects explicit visibility overrides for non-delivery jobs', () => {
    const summary = buildSummary({
      config: {
        defaultVisibility: 'delivery_only',
        jobs: {
          internal: { visible: true, title: 'Internal Research' },
        },
      },
      crons: [
        {
          ...baseCron,
          id: 'internal',
          name: 'internal',
          delivery: null,
        },
      ],
      runs: [
        {
          ts: NOW - 30 * 60 * 1000,
          jobId: 'internal',
          status: 'ok',
          summary: 'Prepared the research brief.',
          error: null,
          durationMs: 1000,
          deliveryStatus: null,
          model: null,
          provider: null,
          usage: null,
        },
      ],
    })

    expect(summary.outcomes).toHaveLength(1)
    expect(summary.outcomes[0].title).toBe('Internal Research')
    expect(summary.deliverables).toHaveLength(0)
  })
})
