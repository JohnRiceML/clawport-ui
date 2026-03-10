import type { CostSummary } from '@/lib/types'
import { fmtTokens } from './formatters'

export const DONUT_COLORS = ['var(--system-blue)', 'var(--system-green)', 'var(--accent)']

export function TokenDonut({ data }: { data: CostSummary }) {
  const totalInput = data.runCosts.reduce((s, r) => s + r.inputTokens, 0)
  const totalOutput = data.runCosts.reduce((s, r) => s + r.outputTokens, 0)
  const totalCache = data.runCosts.reduce((s, r) => s + r.cacheTokens, 0)
  const total = totalInput + totalOutput + totalCache
  if (total === 0) return null

  const segments = [
    { label: '输入', tokens: totalInput, color: DONUT_COLORS[0] },
    { label: '输出', tokens: totalOutput, color: DONUT_COLORS[1] },
    { label: '缓存', tokens: totalCache, color: DONUT_COLORS[2] },
  ].filter(s => s.tokens > 0)

  const R = 60
  const STROKE = 16
  const cx = 80
  const cy = 80
  const circumference = 2 * Math.PI * R
  let offset = 0

  return (
    <div style={{
      background: 'var(--material-regular)',
      border: '1px solid var(--separator)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
      boxShadow: '0 0 0 0.5px var(--separator)',
    }}>
      <div style={{
        fontSize: 'var(--text-caption1)',
        color: 'var(--text-tertiary)',
        fontWeight: 'var(--weight-medium)',
        marginBottom: 'var(--space-3)',
      }}>
        Token 构成
      </div>
      <div className="flex items-center" style={{ gap: 'var(--space-6)', flexWrap: 'wrap' }}>
        <svg viewBox="0 0 160 160" style={{ width: 140, height: 140, flexShrink: 0 }}>
          {segments.map((seg) => {
            const pct = seg.tokens / total
            const dashLen = pct * circumference
            const dashGap = circumference - dashLen
            const currentOffset = offset
            offset += dashLen
            return (
              <circle
                key={seg.label}
                cx={cx}
                cy={cy}
                r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dashLen} ${dashGap}`}
                strokeDashoffset={-currentOffset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            )
          })}
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize={12} fontWeight="700" fill="var(--text-primary)">
            {fmtTokens(total)}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="var(--text-tertiary)">
            总计
          </text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {segments.map(seg => (
            <div key={seg.label} className="flex items-center" style={{ gap: 'var(--space-2)', fontSize: 'var(--text-footnote)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)', fontWeight: 'var(--weight-medium)' }}>{seg.label}</span>
              <span style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtTokens(seg.tokens)} ({((seg.tokens / total) * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
