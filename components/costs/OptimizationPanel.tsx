import type { OptimizationInsight } from '@/lib/types'
import { Zap } from 'lucide-react'
import { fmtCost } from './formatters'

export function OptScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference
  const color = score >= 75 ? 'var(--system-green)' : score >= 50 ? 'var(--system-orange)' : 'var(--system-red)'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill-tertiary)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 600ms ease' }}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central"
        fill="var(--text-primary)" fontSize={size > 50 ? 16 : 12} fontWeight="700">{score}</text>
    </svg>
  )
}

export const SEV_COLORS = {
  critical: 'var(--system-red)',
  warning: 'var(--system-orange)',
  info: 'var(--accent)',
}

export function InsightCard({ insight, onAction }: { insight: OptimizationInsight; onAction: (prompt: string) => void }) {
  const color = SEV_COLORS[insight.severity]
  return (
    <div style={{
      padding: 'var(--space-3) var(--space-4)',
      borderRadius: 'var(--radius-md, 10px)',
      border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      background: `color-mix(in srgb, ${color} 5%, transparent)`,
    }}>
      <div className="flex items-start" style={{ gap: 'var(--space-3)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-footnote)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            {insight.title}
            {insight.projectedSavings !== null && insight.projectedSavings > 0 && (
              <span style={{ marginLeft: 8, fontSize: 'var(--text-caption1)', fontWeight: 600, color: 'var(--system-green)' }}>
                预计可省 ~{fmtCost(insight.projectedSavings)}/周期
              </span>
            )}
          </div>
          <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {insight.description}
          </div>
        </div>
        <button
          onClick={() => onAction(insight.action)}
          className="btn-ghost focus-ring"
          style={{
            padding: '4px 10px',
            borderRadius: 16,
            fontSize: 'var(--text-caption2)',
            fontWeight: 600,
            border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
            background: 'transparent',
            color,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <Zap size={10} />
          修复
        </button>
      </div>
    </div>
  )
}
