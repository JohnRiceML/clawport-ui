'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Download, RefreshCw } from 'lucide-react'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { StakeholderEmptyState } from '@/components/stakeholder/StakeholderEmptyState'
import { StakeholderHero } from '@/components/stakeholder/StakeholderHero'
import { StakeholderMetricCard } from '@/components/stakeholder/StakeholderMetricCard'
import { StakeholderSection } from '@/components/stakeholder/StakeholderSection'
import type {
  StakeholderRange,
  StakeholderRiskItem,
  StakeholderSummary,
} from '@/lib/stakeholder/types'

const RANGES: StakeholderRange[] = ['24h', '7d', '30d']

function formatRangeLabel(range: StakeholderRange): string {
  if (range === '24h') return '24h'
  if (range === '30d') return '30d'
  return '7d'
}

function formatWhen(value: number | string): string {
  const date = typeof value === 'number' ? new Date(value) : new Date(value)
  return date.toLocaleString()
}

function severityMeta(severity: StakeholderRiskItem['severity']) {
  if (severity === 'high') {
    return {
      color: 'var(--system-red)',
      background: 'rgba(255,69,58,0.12)',
    }
  }

  if (severity === 'medium') {
    return {
      color: 'var(--system-orange)',
      background: 'rgba(255,159,10,0.12)',
    }
  }

  return {
    color: 'var(--text-tertiary)',
    background: 'var(--fill-tertiary)',
  }
}

function LoadingState() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <div
        style={{
          background: 'var(--material-regular)',
          border: '1px solid var(--separator)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
        }}
      >
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-4 h-10 w-64" />
        <Skeleton className="mt-3 h-4 w-full max-w-[720px]" />
        <Skeleton className="mt-2 h-4 w-full max-w-[560px]" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: 'var(--space-3)' }}>
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            style={{
              background: 'var(--material-regular)',
              border: '1px solid var(--separator)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
            }}
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
          </div>
        ))}
      </div>

      {[1, 2, 3].map((item) => (
        <div
          key={item}
          style={{
            background: 'var(--material-regular)',
            border: '1px solid var(--separator)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-5)',
          }}
        >
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-72" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-full max-w-[80%]" />
        </div>
      ))}
    </div>
  )
}

export function StakeholderPage({
  audienceLabel,
  summaryPath,
  exportPath,
}: {
  audienceLabel: string
  summaryPath: string
  exportPath: string
}) {
  const [range, setRange] = useState<StakeholderRange>('7d')
  const [summary, setSummary] = useState<StakeholderSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const fetchSummary = useCallback(
    async (selectedRange: StakeholderRange, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        const response = await fetch(`${summaryPath}?range=${selectedRange}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load stakeholder summary')
        }
        setSummary(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stakeholder summary')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [summaryPath],
  )

  useEffect(() => {
    void fetchSummary(range)
  }, [fetchSummary, range])

  const handleExport = useCallback(async () => {
    setExporting(true)
    setExportError(null)

    try {
      const response = await fetch(exportPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          range,
          title: `${audienceLabel} Summary`,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to export summary')
      }

      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export summary')
    } finally {
      setExporting(false)
    }
  }, [audienceLabel, exportPath, range])

  const isEmpty = useMemo(() => {
    if (!summary) return false
    return (
      summary.outcomes.length === 0 &&
      summary.deliverables.length === 0 &&
      summary.risks.length === 0 &&
      summary.upcoming.length === 0
    )
  }, [summary])

  if (error && !summary) {
    return <ErrorState message={error} onRetry={() => void fetchSummary(range)} />
  }

  return (
    <div
      className="h-full flex flex-col overflow-hidden animate-fade-in"
      style={{ background: 'var(--bg)' }}
    >
      <header
        className="sticky top-0 z-10 flex-shrink-0"
        style={{
          background: 'var(--material-regular)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderBottom: '1px solid var(--separator)',
        }}
      >
        <div
          className="flex flex-col md:flex-row md:items-center md:justify-between"
          style={{ gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-6)' }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--text-title1)',
                fontWeight: 'var(--weight-bold)',
                color: 'var(--text-primary)',
              }}
            >
              {audienceLabel} Hub
            </h1>
            <p
              style={{
                marginTop: 'var(--space-1)',
                marginBottom: 0,
                fontSize: 'var(--text-footnote)',
                color: 'var(--text-secondary)',
              }}
            >
              Delivered work, active issues, and the next scheduled updates in plain language.
            </p>
          </div>

          <div className="flex flex-wrap items-center" style={{ gap: 'var(--space-2)' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: 4,
                borderRadius: 999,
                background: 'var(--fill-quaternary)',
              }}
            >
              {RANGES.map((option) => (
                <button
                  key={option}
                  onClick={() => setRange(option)}
                  style={{
                    border: 'none',
                    borderRadius: 999,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    background: range === option ? 'var(--material-regular)' : 'transparent',
                    color: range === option ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontSize: 'var(--text-footnote)',
                    fontWeight: range === option ? 'var(--weight-semibold)' : 'var(--weight-medium)',
                  }}
                >
                  {formatRangeLabel(option)}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchSummary(range, true)}
              disabled={loading || refreshing}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </Button>

            <Button size="sm" onClick={handleExport} disabled={loading || exporting}>
              {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              Export
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-6)', minHeight: 0 }}>
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {error && summary && (
            <div
              style={{
                background: 'rgba(255,69,58,0.08)',
                border: '1px solid rgba(255,69,58,0.2)',
                color: 'var(--system-red)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-footnote)',
              }}
            >
              {error}
            </div>
          )}

          {exportError && (
            <div
              style={{
                background: 'rgba(255,159,10,0.08)',
                border: '1px solid rgba(255,159,10,0.2)',
                color: 'var(--system-orange)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-footnote)',
              }}
            >
              {exportError}
            </div>
          )}

          {loading && !summary ? (
            <LoadingState />
          ) : summary ? (
            <>
              <StakeholderHero audienceLabel={audienceLabel} summary={summary} />

              <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: 'var(--space-3)' }}>
                <StakeholderMetricCard
                  label="Successful Deliveries"
                  value={String(summary.metrics.successfulDeliveries)}
                  tone={summary.metrics.successfulDeliveries > 0 ? 'good' : 'default'}
                />
                <StakeholderMetricCard
                  label="Failed Deliveries"
                  value={String(summary.metrics.failedDeliveries)}
                  tone={summary.metrics.failedDeliveries > 0 ? 'warn' : 'good'}
                />
                <StakeholderMetricCard
                  label="Open Issues"
                  value={String(summary.metrics.openRisks)}
                  tone={summary.metrics.openRisks > 0 ? 'bad' : 'good'}
                />
                <StakeholderMetricCard
                  label="Completed Outputs"
                  value={String(summary.metrics.completedOutputs)}
                />
              </div>

              {isEmpty ? (
                <StakeholderEmptyState audienceLabel={audienceLabel} />
              ) : (
                <>
                  <StakeholderSection
                    title="Key Outcomes"
                    description="Recent completed updates that matter to the client."
                  >
                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                      {summary.outcomes.length === 0 ? (
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-footnote)' }}>
                          No recent outcomes in this window.
                        </div>
                      ) : (
                        summary.outcomes.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              border: '1px solid var(--separator)',
                              borderRadius: 'var(--radius-md)',
                              padding: 'var(--space-4)',
                            }}
                          >
                            <div className="flex items-center justify-between" style={{ gap: 'var(--space-3)' }}>
                              <div
                                style={{
                                  fontSize: 'var(--text-footnote)',
                                  fontWeight: 'var(--weight-semibold)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {item.title}
                              </div>
                              <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
                                {formatWhen(item.ts)}
                              </div>
                            </div>
                            <p
                              style={{
                                marginTop: 'var(--space-2)',
                                marginBottom: 'var(--space-2)',
                                fontSize: 'var(--text-footnote)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {item.summary}
                            </p>
                            <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
                              Owner: {item.ownerName}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </StakeholderSection>

                  <StakeholderSection
                    title="Deliverables"
                    description="Delivered outputs and where they were sent."
                  >
                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                      {summary.deliverables.length === 0 ? (
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-footnote)' }}>
                          No delivered outputs in this window.
                        </div>
                      ) : (
                        summary.deliverables.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-col md:flex-row md:items-start md:justify-between"
                            style={{
                              gap: 'var(--space-3)',
                              border: '1px solid var(--separator)',
                              borderRadius: 'var(--radius-md)',
                              padding: 'var(--space-4)',
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: 'var(--text-footnote)',
                                  fontWeight: 'var(--weight-semibold)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {item.title}
                              </div>
                              <p
                                style={{
                                  marginTop: 'var(--space-2)',
                                  marginBottom: 'var(--space-2)',
                                  fontSize: 'var(--text-footnote)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {item.summary}
                              </p>
                              <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
                                Owner: {item.ownerName}
                              </div>
                            </div>
                            <div style={{ minWidth: 220, fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
                              <div>Delivered: {formatWhen(item.deliveredAt)}</div>
                              {item.channel && <div>Channel: {item.channel}</div>}
                              {item.destinationLabel && <div>Destination: {item.destinationLabel}</div>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </StakeholderSection>

                  <StakeholderSection
                    title="Risks And Blockers"
                    description="Active issues that could affect upcoming client updates."
                  >
                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                      {summary.risks.length === 0 ? (
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-footnote)' }}>
                          No active risks.
                        </div>
                      ) : (
                        summary.risks.map((risk) => {
                          const meta = severityMeta(risk.severity)
                          return (
                            <div
                              key={risk.id}
                              style={{
                                border: '1px solid var(--separator)',
                                borderRadius: 'var(--radius-md)',
                                padding: 'var(--space-4)',
                              }}
                            >
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between" style={{ gap: 'var(--space-3)' }}>
                                <div>
                                  <div
                                    className="flex items-center"
                                    style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}
                                  >
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        borderRadius: 999,
                                        padding: '4px 10px',
                                        background: meta.background,
                                        color: meta.color,
                                        fontSize: 'var(--text-caption1)',
                                        fontWeight: 'var(--weight-semibold)',
                                        textTransform: 'uppercase',
                                      }}
                                    >
                                      {risk.severity}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 'var(--text-footnote)',
                                        fontWeight: 'var(--weight-semibold)',
                                        color: 'var(--text-primary)',
                                      }}
                                    >
                                      {risk.title}
                                    </span>
                                  </div>
                                  <p
                                    style={{
                                      margin: 0,
                                      fontSize: 'var(--text-footnote)',
                                      color: 'var(--text-secondary)',
                                    }}
                                  >
                                    {risk.summary}
                                  </p>
                                </div>
                                <div style={{ minWidth: 220, fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
                                  <div>Owner: {risk.ownerName || 'Unassigned'}</div>
                                  <div>Detected: {formatWhen(risk.detectedAt)}</div>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </StakeholderSection>

                  <StakeholderSection
                    title="Upcoming"
                    description="Next scheduled updates and their planned delivery channel."
                  >
                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                      {summary.upcoming.length === 0 ? (
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-footnote)' }}>
                          No upcoming scheduled outputs.
                        </div>
                      ) : (
                        summary.upcoming.map((item) => (
                          <div
                            key={`${item.jobId}-${item.nextRun}`}
                            className="flex flex-col md:flex-row md:items-center md:justify-between"
                            style={{
                              gap: 'var(--space-3)',
                              border: '1px solid var(--separator)',
                              borderRadius: 'var(--radius-md)',
                              padding: 'var(--space-4)',
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: 'var(--text-footnote)',
                                  fontWeight: 'var(--weight-semibold)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {item.title}
                              </div>
                              <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
                                Owner: {item.ownerName || 'Unassigned'}
                              </div>
                            </div>
                            <div style={{ minWidth: 220, fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
                              <div>Next update: {formatWhen(item.nextRun)}</div>
                              {item.expectedChannel && <div>Channel: {item.expectedChannel}</div>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </StakeholderSection>

                  <StakeholderSection
                    title="Report Export"
                    description="Open a formatted Google Doc version of this summary."
                    action={
                      <Button size="sm" onClick={handleExport} disabled={exporting}>
                        {exporting ? <RefreshCw size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
                        Open Doc
                      </Button>
                    }
                  >
                    <div style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-secondary)' }}>
                      Use export when you need a clean report for email, status meetings, or account reviews.
                    </div>
                  </StakeholderSection>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
