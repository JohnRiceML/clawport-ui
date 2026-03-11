'use client'

import { useSettings } from '@/app/settings-provider'
import type { CostSummary } from '@/lib/types'
import { fmtCost } from './formatters'

export function TopCrons({ jobCosts, jobName }: { jobCosts: CostSummary['jobCosts']; jobName: (id: string) => string }) {
  const { copy } = useSettings()
  const topCronsCopy = copy.costs.topCrons
  const top = jobCosts.slice(0, 3)
  if (top.length === 0) return null

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{
        fontSize: 'var(--text-caption1)',
        color: 'var(--text-tertiary)',
        fontWeight: 'var(--weight-medium)',
        marginBottom: 'var(--space-3)',
      }}>
        {topCronsCopy.title}
      </div>
      <div className="top-crons-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
        {top.map((job) => (
          <div
            key={job.jobId}
            style={{
              background: 'var(--material-regular)',
              border: '1px solid var(--separator)',
              borderRadius: 'var(--radius-md)',
              borderLeft: '3px solid var(--accent)',
              padding: 'var(--space-4)',
            }}
          >
            <div style={{
              fontSize: 'var(--text-footnote)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: 'var(--space-2)',
            }}>
              {jobName(job.jobId)}
            </div>
            <div style={{
              fontSize: 'var(--text-title2)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--text-primary)',
              fontVariantNumeric: 'tabular-nums',
              marginBottom: 'var(--space-1)',
            }}>
              {fmtCost(job.totalCost)}
            </div>
            <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
              {topCronsCopy.runsAvg(job.runs, fmtCost(job.runs > 0 ? job.totalCost / job.runs : 0))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
