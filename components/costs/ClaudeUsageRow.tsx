'use client'

import { useEffect, useState } from 'react'
import { useSettings } from '@/app/settings-provider'
import type { ClaudeCodeUsage } from '@/lib/types'
import { Cpu } from 'lucide-react'

function UsageRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (pct / 100) * circumference
  const color = pct >= 80 ? 'var(--system-red)' : pct >= 50 ? 'var(--system-orange)' : 'var(--system-green)'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill-tertiary)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 600ms ease' }}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central"
        fill="var(--text-primary)" fontSize={size > 40 ? 13 : 10} fontWeight="700"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >{Math.round(pct)}%</text>
    </svg>
  )
}

function useCountdown(
  resetsAt: string | null,
  labels: {
    unavailable: string
    now: string
    hoursMinutes: (hours: number, minutes: number) => string
    minutesSeconds: (minutes: number, seconds: number) => string
  },
): string {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!resetsAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [resetsAt])

  if (!resetsAt) return labels.unavailable
  const diff = new Date(resetsAt).getTime() - now
  if (diff <= 0) return labels.now
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return labels.hoursMinutes(h, m)
  const s = Math.floor((diff % 60_000) / 1000)
  return labels.minutesSeconds(m, s)
}

function fmtResetDay(resetsAt: string | null, locale: string): string | null {
  if (!resetsAt) return null
  return new Date(resetsAt).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function ClaudeUsageRow({ usage }: { usage: ClaudeCodeUsage }) {
  const { copy, resolvedLocale } = useSettings()
  const claudeUsageCopy = copy.costs.claudeUsage
  const fiveHourCountdown = useCountdown(usage.fiveHour.resetsAt, claudeUsageCopy)
  const weeklyResetDay = fmtResetDay(usage.sevenDay.resetsAt, resolvedLocale)
  const fiveHourResetLabel = usage.fiveHour.resetsAt
    ? (fiveHourCountdown === claudeUsageCopy.now
      ? claudeUsageCopy.resetsNow
      : claudeUsageCopy.resetsIn(fiveHourCountdown))
    : claudeUsageCopy.unavailable
  const weeklyResetLabel = weeklyResetDay
    ? claudeUsageCopy.resetsOn(weeklyResetDay)
    : claudeUsageCopy.unavailable

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div className="flex items-center" style={{
        gap: 6, fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)',
        fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-3)',
      }}>
        <Cpu size={12} />
        {claudeUsageCopy.title}
      </div>
      <div className="usage-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        {/* 5-Hour Window */}
        <div style={{
          background: 'var(--material-regular)',
          border: '1px solid var(--separator)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
        }}>
          <UsageRing pct={usage.fiveHour.utilization} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center" style={{ gap: 6 }}>
              <span style={{ fontSize: 'var(--text-footnote)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {claudeUsageCopy.fiveHourWindow}
              </span>
              {usage.fiveHour.utilization >= 80 && (
                <span className="usage-pulse" style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--system-red)',
                  animation: 'pulse 1.2s infinite',
                }} />
              )}
            </div>
            <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {fiveHourResetLabel}
            </div>
          </div>
        </div>

        {/* Weekly Cap */}
        <div style={{
          background: 'var(--material-regular)',
          border: '1px solid var(--separator)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
        }}>
          <UsageRing pct={usage.sevenDay.utilization} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center" style={{ gap: 6 }}>
              <span style={{ fontSize: 'var(--text-footnote)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {claudeUsageCopy.weeklyCap}
              </span>
              {usage.sevenDay.utilization >= 80 && (
                <span className="usage-pulse" style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--system-red)',
                  animation: 'pulse 1.2s infinite',
                }} />
              )}
            </div>
            <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {weeklyResetLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
