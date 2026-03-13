import type { StakeholderSummary } from '@/lib/stakeholder/types'

interface RenderStakeholderReportOptions {
  title?: string
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').replace('.000Z', ' UTC')
}

function formatStatus(status: StakeholderSummary['overallStatus']): string {
  if (status === 'on_track') return 'On Track'
  if (status === 'needs_attention') return 'Needs Attention'
  return 'Blocked'
}

function formatRange(range: StakeholderSummary['range']): string {
  if (range === '24h') return 'Last 24 hours'
  if (range === '30d') return 'Last 30 days'
  return 'Last 7 days'
}

export function renderStakeholderReport(
  summary: StakeholderSummary,
  options: RenderStakeholderReportOptions = {},
): string {
  const title = options.title || 'Stakeholder Summary'
  const lines: string[] = [
    `# ${title}`,
    '',
    `Status: **${formatStatus(summary.overallStatus)}**`,
    `Reporting window: ${formatRange(summary.range)}`,
    `Generated: ${formatTimestamp(Date.parse(summary.generatedAt))}`,
    '',
    '## Executive Summary',
    '',
    summary.executiveSummary,
    '',
    '## Service Health',
    '',
    `- Successful deliveries: ${summary.metrics.successfulDeliveries}`,
    `- Failed deliveries: ${summary.metrics.failedDeliveries}`,
    `- Open issues: ${summary.metrics.openRisks}`,
    `- Completed outputs: ${summary.metrics.completedOutputs}`,
    '',
    '## Key Outcomes',
    '',
  ]

  if (summary.outcomes.length === 0) {
    lines.push('- No recent stakeholder-visible updates.')
  } else {
    for (const outcome of summary.outcomes) {
      lines.push(
        `- **${outcome.title}** (${outcome.ownerName}, ${formatTimestamp(outcome.ts)}): ${outcome.summary}`,
      )
    }
  }

  lines.push('', '## Deliverables', '')

  if (summary.deliverables.length === 0) {
    lines.push('- No delivered outputs in this window.')
  } else {
    for (const deliverable of summary.deliverables) {
      const deliveryMeta = [deliverable.channel, deliverable.destinationLabel]
        .filter(Boolean)
        .join(' -> ')
      lines.push(
        `- **${deliverable.title}** (${deliverable.ownerName}, ${formatTimestamp(
          deliverable.deliveredAt,
        )})${deliveryMeta ? ` via ${deliveryMeta}` : ''}: ${deliverable.summary}`,
      )
    }
  }

  lines.push('', '## Risks And Blockers', '')

  if (summary.risks.length === 0) {
    lines.push('- No active risks.')
  } else {
    for (const risk of summary.risks) {
      lines.push(
        `- **${risk.title}** [${risk.severity.toUpperCase()}] (${risk.ownerName || 'Unassigned'}, ${formatTimestamp(
          risk.detectedAt,
        )}): ${risk.summary}`,
      )
    }
  }

  lines.push('', '## Upcoming', '')

  if (summary.upcoming.length === 0) {
    lines.push('- No upcoming scheduled outputs.')
  } else {
    for (const upcoming of summary.upcoming) {
      lines.push(
        `- **${upcoming.title}** (${upcoming.ownerName || 'Unassigned'}) next update at ${formatTimestamp(
          Date.parse(upcoming.nextRun),
        )}${upcoming.expectedChannel ? ` via ${upcoming.expectedChannel}` : ''}.`,
      )
    }
  }

  return lines.join('\n')
}
