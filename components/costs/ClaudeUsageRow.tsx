'use client'

import { useEffect, useState } from 'react'
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

function useCountdown(resetsAt: string | null): string {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!resetsAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [resetsAt])

  if (!resetsAt) return '--'
  const diff = new Date(resetsAt).getTime() - now
  if (diff <= 0) return '现在'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  const s = Math.floor((diff % 60_000) / 1000)
  return `${m}m ${s}s`
}

function fmtResetDay(resetsAt: string | null): string {
  if (!resetsAt) return '--'
  return `重置于 ${new Date(resetsAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`
}

export function ClaudeUsageRow({ usage }: { usage: ClaudeCodeUsage }) {
  const fiveHourCountdown = useCountdown(usage.fiveHour.resetsAt)
  const weeklyResetLabel = fmtResetDay(usage.sevenDay.resetsAt)

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div className="flex items-center" style={{
        gap: 6, fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)',
        fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-3)',
      }}>
        <Cpu size={12} />
        Claude Code 用量
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
                5 小时窗口
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
              距重置还有 {fiveHourCountdown}
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
                周额度
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
