import { getAgents } from '@/lib/agents'
import { getCronRuns } from '@/lib/cron-runs'
import { getCrons } from '@/lib/crons'
import { createGoogleDocFromMarkdown } from '@/lib/google-doc-export'
import { loadStakeholderConfig } from '@/lib/stakeholder/config'
import { renderStakeholderReport } from '@/lib/stakeholder/report'
import { buildStakeholderSummary } from '@/lib/stakeholder/summary'
import type { StakeholderRange, StakeholderSummary } from '@/lib/stakeholder/types'

export function parseStakeholderRange(value: unknown): StakeholderRange | null {
  return value === '24h' || value === '7d' || value === '30d' ? value : null
}

export async function loadStakeholderSummary(
  range: StakeholderRange,
): Promise<StakeholderSummary> {
  const [agents, crons] = await Promise.all([getAgents(), getCrons()])
  const runs = getCronRuns()
  const config = loadStakeholderConfig()

  return buildStakeholderSummary({
    range,
    agents,
    crons,
    runs,
    config,
  })
}

export async function exportStakeholderSummary(params: {
  range: StakeholderRange
  title?: string
  defaultTitle: string
}): Promise<{ url: string }> {
  const summary = await loadStakeholderSummary(params.range)
  const markdown = renderStakeholderReport(summary, {
    title: params.title || params.defaultTitle,
  })
  const url = await createGoogleDocFromMarkdown({
    title: params.title || params.defaultTitle,
    markdown,
  })
  return { url }
}
