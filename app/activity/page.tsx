'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSettings } from '@/app/settings-provider'
import type { LogEntry, LogFilter, LogSummary } from '@/lib/types'
import { timeAgo } from '@/lib/cron-utils'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, Radio } from 'lucide-react'
import { ErrorState } from '@/components/ErrorState'
import { LogBrowser } from '@/components/activity/LogBrowser'

/* ── Summary Cards ─────────────────────────────────────────────── */

function TotalCard({ count }: { count: number }) {
  const { t } = useSettings()
  return (
    <div style={{
      background: 'var(--material-regular)',
      border: '1px solid var(--separator)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
    }}>
      <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)' }}>
        {t('activity.totalEvents')}
      </div>
      <div style={{ fontSize: 'var(--text-title2)', color: 'var(--text-primary)', fontWeight: 'var(--weight-bold)' }}>
        {count}
      </div>
    </div>
  )
}

function ErrorCard({ count }: { count: number }) {
  const { t } = useSettings()
  const hasErrors = count > 0
  return (
    <div style={{
      background: 'var(--material-regular)',
      border: '1px solid var(--separator)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
    }}>
      <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)' }}>
        {t('activity.errors')}
      </div>
      <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
        {hasErrors && (
          <span className="animate-error-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--system-red)', flexShrink: 0 }} />
        )}
        <span style={{
          fontSize: 'var(--text-title2)',
          fontWeight: 'var(--weight-bold)',
          color: hasErrors ? 'var(--system-red)' : 'var(--system-green)',
        }}>
          {count}
        </span>
      </div>
    </div>
  )
}

function SourcesCard({ cron, config }: { cron: number; config: number }) {
  const { t } = useSettings()
  return (
    <div style={{
      background: 'var(--material-regular)',
      border: '1px solid var(--separator)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
    }}>
      <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)' }}>
        {t('activity.sources')}
      </div>
      <div className="flex items-center" style={{ gap: 'var(--space-3)' }}>
        <div>
          <span style={{ fontSize: 'var(--text-footnote)', fontWeight: 'var(--weight-semibold)', color: 'var(--system-blue)' }}>{cron}</span>
          <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginLeft: 4 }}>cron</span>
        </div>
        <div>
          <span style={{ fontSize: 'var(--text-footnote)', fontWeight: 'var(--weight-semibold)', color: 'var(--system-purple)' }}>{config}</span>
          <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginLeft: 4 }}>config</span>
        </div>
      </div>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function ActivityPage() {
  const { t, resolvedLocale } = useSettings()
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [summary, setSummary] = useState<LogSummary | null>(null)
  const [filter, setFilter] = useState<LogFilter>('all')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatedAgo, setUpdatedAgo] = useState('just now')

  const refresh = useCallback(() => {
    setRefreshing(true)
    setError(null)
    fetch('/api/logs')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load logs')
        return r.json()
      })
      .then((data: { entries: LogEntry[]; summary: LogSummary }) => {
        setEntries(data.entries)
        setSummary(data.summary)
        setLastRefresh(new Date())
        setLoading(false)
        setRefreshing(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
        setRefreshing(false)
      })
  }, [])

  // Initial load + polling
  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 60000)
    return () => clearInterval(interval)
  }, [refresh])

  // Updated ago ticker
  useEffect(() => {
    const tick = () => setUpdatedAgo(timeAgo(lastRefresh.toISOString(), resolvedLocale))
    tick()
    const interval = setInterval(tick, 30000)
    return () => clearInterval(interval)
  }, [lastRefresh, resolvedLocale])

  if (error && entries.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />
  }

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in" style={{ background: 'var(--bg)' }}>
      {/* ── Sticky header ──────────────────────────────────────── */}
      <header
        className="sticky top-0 z-10 flex-shrink-0"
        style={{
          background: 'var(--material-regular)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderBottom: '1px solid var(--separator)',
        }}
      >
        <div className="flex items-center justify-between" style={{ padding: 'var(--space-4) var(--space-6)' }}>
          <div>
            <h1 style={{
              fontSize: 'var(--text-title1)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--text-primary)',
              letterSpacing: '-0.5px',
              lineHeight: 'var(--leading-tight)',
            }}>
              {t('activity.title')}
            </h1>
            {!loading && summary && (
              <p style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                {t('activity.eventsCount', { count: summary.totalEntries })}
                {summary.errorCount > 0 && (
                  <span style={{ color: 'var(--system-red)' }}>
                    {' \u00b7 '}{t('activity.errorsCount', { count: summary.errorCount })}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center" style={{ gap: 'var(--space-3)' }}>
            {/* Open Live Stream */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('clawport:open-stream-widget'))}
              className="focus-ring flex items-center"
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-footnote)',
                fontWeight: 'var(--weight-semibold)',
                gap: 6,
                background: 'var(--accent-fill)',
                color: 'var(--accent)',
                transition: 'all 200ms var(--ease-smooth)',
              }}
            >
              <Radio size={14} />
              {t('activity.openLiveLogs')}
            </button>

            <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
              {t('common.updated', { value: updatedAgo })}
            </span>
            <button
              onClick={refresh}
              className="focus-ring"
              aria-label="Refresh activity data"
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                transition: 'color 150ms var(--ease-smooth)',
              }}
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Scrollable content ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: 'var(--space-4) var(--space-6) var(--space-6)', minHeight: 0 }}>
        {loading ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }} className="summary-cards-grid">
              {[1, 2, 3].map(i => (
                <div key={i} style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                  <Skeleton style={{ width: 80, height: 10, marginBottom: 8 }} />
                  <Skeleton style={{ width: 48, height: 20 }} />
                </div>
              ))}
            </div>
            <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--material-regular)' }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center" style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: i < 5 ? '1px solid var(--separator)' : undefined, gap: 'var(--space-3)' }}>
                  <Skeleton className="flex-shrink-0" style={{ width: 8, height: 8, borderRadius: '50%' }} />
                  <Skeleton style={{ width: 120, height: 12 }} />
                  <Skeleton style={{ width: 50, height: 18, borderRadius: 4 }} />
                  <Skeleton style={{ width: 200, height: 14, flex: 1 }} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }} className="summary-cards-grid">
              <TotalCard count={summary?.totalEntries ?? 0} />
              <ErrorCard count={summary?.errorCount ?? 0} />
              <SourcesCard cron={summary?.sources.cron ?? 0} config={summary?.sources.config ?? 0} />
            </div>

            {/* Log browser */}
            <LogBrowser
              entries={entries}
              summary={summary}
              loading={false}
              filter={filter}
              onFilterChange={setFilter}
            />
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .summary-cards-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
