import type { Agent, CronJob, CronRun } from '@/lib/types'
import type {
  StakeholderDeliverable,
  StakeholderOutcomeItem,
  StakeholderRange,
  StakeholderRiskItem,
  StakeholderStatus,
  StakeholderSummary,
  StakeholderUpcomingItem,
} from '@/lib/stakeholder/types'
import {
  DEFAULT_STAKEHOLDER_CONFIG,
  type StakeholderConfig,
  type StakeholderJobConfig,
} from '@/lib/stakeholder/config'

const RANGE_MS: Record<StakeholderRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

const RANGE_LABEL: Record<StakeholderRange, string> = {
  '24h': 'the last 24 hours',
  '7d': 'the last 7 days',
  '30d': 'the last 30 days',
}

const SEVERITY_WEIGHT = {
  low: 1,
  medium: 2,
  high: 3,
} as const

interface BuildStakeholderSummaryOptions {
  range: StakeholderRange
  crons: CronJob[]
  runs: CronRun[]
  agents: Agent[]
  config?: StakeholderConfig
  now?: number
}

interface StakeholderJobView {
  cron: CronJob
  title: string
  ownerAgentId: string | null
  ownerName: string
  priority: 'standard' | 'primary'
}

function meaningfulText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function isVisibleJob(cron: CronJob, jobConfig: StakeholderJobConfig | undefined): boolean {
  if (typeof jobConfig?.visible === 'boolean') {
    return jobConfig.visible
  }
  return !!cron.delivery
}

function isDeliverySuccess(status: string | null): boolean {
  if (!status) return false
  return ['delivered', 'success', 'ok', 'sent'].includes(status.toLowerCase())
}

function isDeliveryFailure(status: string | null): boolean {
  if (!status) return false
  return !isDeliverySuccess(status) && status.toLowerCase() !== 'unknown'
}

function describeRange(range: StakeholderRange): string {
  return RANGE_LABEL[range]
}

function formatOwner(agentMap: Map<string, Agent>, agentId: string | null): {
  ownerAgentId: string | null
  ownerName: string
} {
  if (!agentId) {
    return { ownerAgentId: null, ownerName: 'Unassigned' }
  }

  const agent = agentMap.get(agentId)
  if (!agent) {
    return { ownerAgentId: agentId, ownerName: agentId }
  }

  return {
    ownerAgentId: agent.id,
    ownerName: agent.name,
  }
}

function compareSeverity(a: StakeholderRiskItem, b: StakeholderRiskItem): number {
  return SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || b.detectedAt - a.detectedAt
}

function buildExecutiveSummary(args: {
  status: StakeholderStatus
  range: StakeholderRange
  deliverables: StakeholderDeliverable[]
  outcomes: StakeholderOutcomeItem[]
  upcoming: StakeholderUpcomingItem[]
  risks: StakeholderRiskItem[]
}): string {
  const { status, range, deliverables, outcomes, upcoming, risks } = args
  const windowLabel = describeRange(range)

  if (outcomes.length === 0 && upcoming.length === 0 && risks.length === 0) {
    return 'No stakeholder-facing scheduled outputs are configured yet.'
  }

  const deliveredText =
    deliverables.length === 1
      ? '1 delivery completed'
      : `${deliverables.length} deliveries completed`
  const outcomesText =
    outcomes.length === 1 ? '1 recent update' : `${outcomes.length} recent updates`
  const upcomingText =
    upcoming.length === 1 ? '1 next update is scheduled' : `${upcoming.length} next updates are scheduled`

  if (status === 'blocked') {
    const topRisk = risks.find((risk) => risk.severity === 'high') || risks[0]
    return `${topRisk?.title || 'A key client update'} is blocked. ${deliveredText} across ${windowLabel}, and ${upcomingText}.`
  }

  if (status === 'needs_attention') {
    return `${outcomesText} were completed across ${windowLabel}, with ${risks.length} issue${
      risks.length === 1 ? '' : 's'
    } needing attention. ${upcomingText}.`
  }

  return `${deliveredText} across ${windowLabel}, covering ${outcomesText}. ${upcomingText}.`
}

export function buildStakeholderSummary({
  range,
  crons,
  runs,
  agents,
  config = DEFAULT_STAKEHOLDER_CONFIG,
  now = Date.now(),
}: BuildStakeholderSummaryOptions): StakeholderSummary {
  const effectiveConfig = config ?? DEFAULT_STAKEHOLDER_CONFIG
  const cutoff = now - RANGE_MS[range]
  const agentMap = new Map(agents.map((agent) => [agent.id, agent]))

  const visibleJobs: StakeholderJobView[] = crons
    .filter((cron) => isVisibleJob(cron, effectiveConfig.jobs[cron.id]))
    .map((cron) => {
      const jobConfig = effectiveConfig.jobs[cron.id]
      const owner = formatOwner(agentMap, cron.agentId)
      return {
        cron,
        title: meaningfulText(jobConfig?.title) || cron.name || cron.id,
        ownerAgentId: owner.ownerAgentId,
        ownerName: owner.ownerName,
        priority: jobConfig?.priority === 'primary' ? 'primary' : 'standard',
      }
    })

  const visibleJobIds = new Set(visibleJobs.map((job) => job.cron.id))
  const recentRuns = runs
    .filter((run) => visibleJobIds.has(run.jobId) && run.ts >= cutoff)
    .sort((a, b) => b.ts - a.ts)

  const runsByJob = new Map<string, CronRun[]>()
  for (const run of recentRuns) {
    const bucket = runsByJob.get(run.jobId)
    if (bucket) {
      bucket.push(run)
    } else {
      runsByJob.set(run.jobId, [run])
    }
  }

  const jobMap = new Map(visibleJobs.map((job) => [job.cron.id, job]))

  const outcomes: StakeholderOutcomeItem[] = []
  const seenOutcomeJobs = new Set<string>()
  for (const run of recentRuns) {
    const summary = meaningfulText(run.summary)
    if (run.status !== 'ok' || !summary || seenOutcomeJobs.has(run.jobId)) continue

    const job = jobMap.get(run.jobId)
    if (!job) continue
    seenOutcomeJobs.add(run.jobId)
    outcomes.push({
      id: `outcome-${run.jobId}-${run.ts}`,
      title: job.title,
      summary,
      ownerAgentId: job.ownerAgentId,
      ownerName: job.ownerName,
      ts: run.ts,
    })
  }

  const deliverables: StakeholderDeliverable[] = recentRuns
    .filter((run) => {
      const job = jobMap.get(run.jobId)
      return !!job?.cron.delivery && run.status === 'ok' && isDeliverySuccess(run.deliveryStatus)
    })
    .map((run) => {
      const job = jobMap.get(run.jobId)!
      return {
        id: `deliverable-${run.jobId}-${run.ts}`,
        jobId: run.jobId,
        title: job.title,
        summary: meaningfulText(run.summary) || 'Delivery completed',
        deliveredAt: run.ts,
        ownerAgentId: job.ownerAgentId,
        ownerName: job.ownerName,
        channel: job.cron.delivery?.channel || null,
        destinationLabel: job.cron.delivery?.to || null,
      }
    })

  const risks: StakeholderRiskItem[] = []

  for (const job of visibleJobs) {
    const recentJobRuns = runsByJob.get(job.cron.id) || []
    const latestRun = recentJobRuns[0] || null

    if (job.cron.delivery && !job.cron.delivery.to) {
      risks.push({
        id: `risk-${job.cron.id}-missing-target`,
        title: job.title,
        summary: 'A delivery destination is missing for this scheduled client update.',
        severity: 'medium',
        ownerAgentId: job.ownerAgentId,
        ownerName: job.ownerName,
        relatedJobId: job.cron.id,
        detectedAt: now,
      })
    }

    if (latestRun?.status === 'error') {
      risks.push({
        id: `risk-${job.cron.id}-run-error`,
        title: job.title,
        summary:
          meaningfulText(latestRun.error) ||
          meaningfulText(job.cron.lastError) ||
          'The most recent scheduled update did not complete successfully.',
        severity:
          job.priority === 'primary' && job.cron.consecutiveErrors > 1 ? 'high' : 'medium',
        ownerAgentId: job.ownerAgentId,
        ownerName: job.ownerName,
        relatedJobId: job.cron.id,
        detectedAt: latestRun.ts,
      })
    }

    if (latestRun && job.cron.delivery && isDeliveryFailure(latestRun.deliveryStatus)) {
      risks.push({
        id: `risk-${job.cron.id}-delivery-failure`,
        title: job.title,
        summary: `The latest update completed but delivery finished with status "${latestRun.deliveryStatus}".`,
        severity: job.priority === 'primary' ? 'high' : 'medium',
        ownerAgentId: job.ownerAgentId,
        ownerName: job.ownerName,
        relatedJobId: job.cron.id,
        detectedAt: latestRun.ts,
      })
    }

    const nextRunTs = job.cron.nextRun ? new Date(job.cron.nextRun).getTime() : NaN
    if (job.cron.enabled && Number.isFinite(nextRunTs) && nextRunTs < now) {
      risks.push({
        id: `risk-${job.cron.id}-overdue`,
        title: job.title,
        summary: 'The next scheduled client update is overdue and needs follow-up.',
        severity: job.priority === 'primary' ? 'high' : 'low',
        ownerAgentId: job.ownerAgentId,
        ownerName: job.ownerName,
        relatedJobId: job.cron.id,
        detectedAt: nextRunTs,
      })
    }
  }

  risks.sort(compareSeverity)

  const upcoming: StakeholderUpcomingItem[] = visibleJobs
    .filter((job) => {
      if (!job.cron.enabled || !job.cron.nextRun) return false
      const nextRunTs = new Date(job.cron.nextRun).getTime()
      return Number.isFinite(nextRunTs) && nextRunTs >= now
    })
    .map((job) => ({
      jobId: job.cron.id,
      title: job.title,
      nextRun: job.cron.nextRun!,
      ownerAgentId: job.ownerAgentId,
      ownerName: job.ownerName,
      expectedChannel: job.cron.delivery?.channel || null,
    }))
    .sort((a, b) => new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime())

  const failedDeliveries = recentRuns.filter((run) => {
    const job = jobMap.get(run.jobId)
    return !!job?.cron.delivery && (run.status === 'error' || isDeliveryFailure(run.deliveryStatus))
  }).length

  const overallStatus: StakeholderStatus = risks.some(
    (risk) => risk.severity === 'high',
  )
    ? 'blocked'
    : risks.some((risk) => risk.severity === 'medium')
      ? 'needs_attention'
      : 'on_track'

  return {
    range,
    generatedAt: new Date(now).toISOString(),
    overallStatus,
    executiveSummary: buildExecutiveSummary({
      status: overallStatus,
      range,
      deliverables,
      outcomes,
      upcoming,
      risks,
    }),
    outcomes: outcomes.slice(0, 5),
    deliverables: deliverables.slice(0, 10),
    risks,
    upcoming: upcoming.slice(0, 8),
    metrics: {
      successfulDeliveries: deliverables.length,
      failedDeliveries,
      openRisks: risks.length,
      completedOutputs: outcomes.length,
    },
  }
}
