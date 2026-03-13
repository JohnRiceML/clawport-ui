import type { StakeholderSummary } from '@/lib/stakeholder/types'

function statusCopy(status: StakeholderSummary['overallStatus']): {
  label: string
  color: string
  background: string
} {
  if (status === 'on_track') {
    return {
      label: 'On Track',
      color: 'var(--system-green)',
      background: 'rgba(52,199,89,0.12)',
    }
  }

  if (status === 'needs_attention') {
    return {
      label: 'Needs Attention',
      color: 'var(--system-orange)',
      background: 'rgba(255,159,10,0.12)',
    }
  }

  return {
    label: 'Blocked',
    color: 'var(--system-red)',
    background: 'rgba(255,69,58,0.12)',
  }
}

export function StakeholderHero({
  audienceLabel,
  summary,
}: {
  audienceLabel: string
  summary: StakeholderSummary
}) {
  const status = statusCopy(summary.overallStatus)
  const rangeLabel =
    summary.range === '24h'
      ? 'Last 24 hours'
      : summary.range === '30d'
        ? 'Last 30 days'
        : 'Last 7 days'

  return (
    <section
      style={{
        background: 'linear-gradient(135deg, var(--material-regular), color-mix(in srgb, var(--accent-fill) 35%, transparent))',
        border: '1px solid var(--separator)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
      }}
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between" style={{ gap: 'var(--space-4)' }}>
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 999,
              padding: '6px 12px',
              background: status.background,
              color: status.color,
              fontSize: 'var(--text-footnote)',
              fontWeight: 'var(--weight-semibold)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: status.color,
                flexShrink: 0,
              }}
            />
            {status.label}
          </div>

          <h1
            style={{
              marginTop: 'var(--space-3)',
              marginBottom: 'var(--space-2)',
              fontSize: 'var(--text-title1)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--text-primary)',
            }}
          >
            {audienceLabel} Summary
          </h1>

          <p
            style={{
              margin: 0,
              maxWidth: 720,
              fontSize: 'var(--text-subheadline)',
              lineHeight: 'var(--leading-relaxed)',
              color: 'var(--text-secondary)',
            }}
          >
            {summary.executiveSummary}
          </p>
        </div>

        <div
          style={{
            minWidth: 180,
            display: 'grid',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-caption1)',
            color: 'var(--text-tertiary)',
          }}
        >
          <div>Window: {rangeLabel}</div>
          <div>Updated: {new Date(summary.generatedAt).toLocaleString()}</div>
        </div>
      </div>
    </section>
  )
}
