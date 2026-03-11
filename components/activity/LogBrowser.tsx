'use client'

import { useState } from 'react'
import type { LogEntry, LogFilter, LogSummary } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { useSettings } from '@/app/settings-provider'

/* ── Helpers ───────────────────────────────────────────────────── */

function formatTs(ts: number): string {
  if (!ts) return '--'
  const d = new Date(ts)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '--'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

const LEVEL_DOT: Record<string, string> = {
  info: 'var(--system-green)',
  warn: 'var(--system-orange)',
  error: 'var(--system-red)',
}

const SOURCE_BADGE: Record<string, { bg: string; color: string }> = {
  cron: { bg: 'rgba(0,122,255,0.1)', color: 'var(--system-blue)' },
  config: { bg: 'rgba(175,82,222,0.1)', color: 'var(--system-purple)' },
}

/* ── Component ─────────────────────────────────────────────────── */

interface LogBrowserProps {
  entries: LogEntry[]
  summary: LogSummary | null
  loading: boolean
  filter: LogFilter
  onFilterChange: (f: LogFilter) => void
}

export function LogBrowser({ entries, summary, loading, filter, onFilterChange }: LogBrowserProps) {
  const { copy } = useSettings()
  const activityCopy = copy.activity
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const pills: { key: LogFilter; label: string }[] = [
    { key: 'all', label: activityCopy.logBrowser.pills.all },
    { key: 'error', label: activityCopy.logBrowser.pills.error },
    { key: 'cron', label: activityCopy.logBrowser.pills.cron },
    { key: 'config', label: activityCopy.logBrowser.pills.config },
  ]

  if (loading) {
    return (
      <div>
        <div className="flex items-center" style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          {pills.map(p => <Skeleton key={p.key} style={{ width: 64, height: 32, borderRadius: 20 }} />)}
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
      </div>
    )
  }

  // Filter + search
  const filtered = entries.filter(e => {
    if (filter === 'error' && e.level !== 'error') return false
    if (filter === 'cron' && e.source !== 'cron') return false
    if (filter === 'config' && e.source !== 'config') return false
    if (search && !e.summary.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts: Record<LogFilter, number> = {
    all: entries.length,
    error: entries.filter(e => e.level === 'error').length,
    cron: entries.filter(e => e.source === 'cron').length,
    config: entries.filter(e => e.source === 'config').length,
  }

  return (
    <div>
      {/* Filter pills */}
      <div className="flex items-center flex-wrap" style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        {pills.map(pill => {
          const isActive = filter === pill.key
          return (
            <button
              key={pill.key}
              onClick={() => onFilterChange(pill.key)}
              className="focus-ring flex items-center flex-shrink-0"
              style={{
                borderRadius: 20,
                padding: '6px 14px',
                fontSize: 'var(--text-footnote)',
                fontWeight: 'var(--weight-medium)',
                border: 'none',
                cursor: 'pointer',
                gap: 'var(--space-2)',
                transition: 'all 200ms var(--ease-smooth)',
                ...(isActive
                  ? { background: 'var(--accent-fill)', color: 'var(--accent)', boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent)' }
                  : { background: 'var(--fill-secondary)', color: 'var(--text-primary)' }),
              }}
            >
              <span>{pill.label}</span>
              <span style={{ fontWeight: 'var(--weight-semibold)', color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {counts[pill.key]}
              </span>
            </button>
          )
        })}

        {/* Search input */}
        <input
          type="text"
          placeholder={activityCopy.logBrowser.searchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="focus-ring"
          style={{
            marginLeft: 'auto',
            padding: '6px 12px',
            fontSize: 'var(--text-footnote)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--separator)',
            background: 'var(--fill-secondary)',
            color: 'var(--text-primary)',
            outline: 'none',
            minWidth: 160,
            maxWidth: 240,
          }}
        />
      </div>

      {/* Entry list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center" style={{ height: 200, color: 'var(--text-secondary)', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-medium)' }}>
            {entries.length === 0 ? activityCopy.logBrowser.emptyTitle : activityCopy.logBrowser.noMatchesTitle}
          </span>
          <span style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-tertiary)' }}>
            {entries.length === 0 ? activityCopy.logBrowser.emptyBody : activityCopy.logBrowser.noMatchesBody}
          </span>
        </div>
      ) : (
        <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--material-regular)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          {filtered.map((entry, idx) => {
            const isExpanded = expanded === entry.id
            const badge = SOURCE_BADGE[entry.source]

            return (
              <div key={entry.id}>
                {idx > 0 && (
                  <div style={{ height: 1, background: 'var(--separator)', marginLeft: 'var(--space-4)', marginRight: 'var(--space-4)' }} />
                )}

                {/* Row */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => setExpanded(isExpanded ? null : entry.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(isExpanded ? null : entry.id) } }}
                  className="flex items-center cursor-pointer hover-bg focus-ring"
                  style={{
                    minHeight: 44,
                    padding: '0 var(--space-4)',
                    background: entry.level === 'error' ? 'rgba(255,69,58,0.06)' : undefined,
                  }}
                >
                  {/* Status dot */}
                  <span className="flex-shrink-0 rounded-full" style={{ width: 8, height: 8, background: LEVEL_DOT[entry.level] ?? 'var(--text-tertiary)' }} />

                  {/* Timestamp */}
                  <span className="flex-shrink-0 font-mono" style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginLeft: 'var(--space-3)', minWidth: 130 }}>
                    {formatTs(entry.ts)}
                  </span>

                  {/* Source badge */}
                  {badge && (
                    <span className="flex-shrink-0" style={{
                      fontSize: 'var(--text-caption2)',
                      fontWeight: 'var(--weight-semibold)',
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: badge.bg,
                      color: badge.color,
                      marginLeft: 'var(--space-2)',
                      letterSpacing: '0.04em',
                    }}>
                      {entry.source === 'cron' ? activityCopy.summary.cron.toUpperCase() : activityCopy.summary.config.toUpperCase()}
                    </span>
                  )}

                  {/* Summary */}
                  <span className="truncate" style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-primary)', marginLeft: 'var(--space-3)', flex: 1, minWidth: 0 }}>
                    {entry.summary.length > 120 ? entry.summary.slice(0, 117) + '...' : entry.summary}
                  </span>

                  {/* Duration */}
                  <span className="flex-shrink-0 hidden md:inline" style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginLeft: 'var(--space-3)' }}>
                    {formatDuration(entry.durationMs)}
                  </span>

                  {/* Chevron */}
                  <span aria-hidden="true" style={{
                    fontSize: 'var(--text-footnote)',
                    color: 'var(--text-tertiary)',
                    transition: 'transform 200ms var(--ease-smooth)',
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    display: 'inline-block',
                    marginLeft: 'var(--space-2)',
                  }}>
                    &#8250;
                  </span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="animate-slide-down" style={{ padding: '0 var(--space-4) var(--space-4) var(--space-4)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--space-1) var(--space-4)', marginTop: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                      <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>{activityCopy.logBrowser.details.source}</span>
                      <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {entry.source === 'cron' ? activityCopy.summary.cron : entry.source === 'config' ? activityCopy.summary.config : entry.source}
                      </span>

                      <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>{activityCopy.logBrowser.details.level}</span>
                      <span style={{
                        fontSize: 'var(--text-caption1)',
                        color: entry.level === 'error' ? 'var(--system-red)' : entry.level === 'warn' ? 'var(--system-orange)' : 'var(--text-secondary)',
                        fontWeight: 'var(--weight-medium)',
                        textTransform: 'capitalize',
                      }}>{entry.level}</span>

                      <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>{activityCopy.logBrowser.details.category}</span>
                      <span className="font-mono" style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)' }}>{entry.category}</span>

                      {entry.jobId && (
                        <>
                          <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>{activityCopy.logBrowser.details.jobId}</span>
                          <span className="font-mono" style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-secondary)' }}>{entry.jobId}</span>
                        </>
                      )}

                      {entry.durationMs != null && (
                        <>
                          <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>{activityCopy.logBrowser.details.duration}</span>
                          <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)' }}>{formatDuration(entry.durationMs)}</span>
                        </>
                      )}

                      <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>{activityCopy.logBrowser.details.timestamp}</span>
                      <span className="font-mono" style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-secondary)' }}>
                        {new Date(entry.ts).toISOString()}
                      </span>
                    </div>

                    {/* Full summary */}
                    {entry.summary.length > 120 && (
                      <div style={{
                        fontSize: 'var(--text-caption1)',
                        color: 'var(--text-secondary)',
                        lineHeight: 'var(--leading-relaxed)',
                        marginBottom: 'var(--space-3)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}>
                        {entry.summary}
                      </div>
                    )}

                    {/* Raw JSON */}
                    <div style={{
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--code-bg)',
                      border: '1px solid var(--code-border)',
                      padding: 'var(--space-3)',
                    }}>
                      <pre className="font-mono" style={{
                        fontSize: 'var(--text-caption2)',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        margin: 0,
                        maxHeight: 300,
                        overflow: 'auto',
                        lineHeight: 'var(--leading-relaxed)',
                      }}>
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
