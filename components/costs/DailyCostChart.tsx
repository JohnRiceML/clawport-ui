'use client'

import { useState } from 'react'
import type { CostSummary } from '@/lib/types'
import { fmtCost } from './formatters'

export function DailyCostChart({ dailyCosts }: { dailyCosts: CostSummary['dailyCosts'] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (dailyCosts.length === 0) return null

  const maxCost = Math.max(...dailyCosts.map(d => d.cost))
  const W = 600
  const H = 200
  const PAD_L = 50
  const PAD_B = 24
  const PAD_T = 12
  const chartW = W - PAD_L
  const chartH = H - PAD_B - PAD_T
  const barW = Math.max(8, Math.min(40, (chartW - dailyCosts.length * 2) / dailyCosts.length))
  const gap = 2

  const ticks = maxCost > 0
    ? [0, maxCost * 0.25, maxCost * 0.5, maxCost * 0.75, maxCost]
    : [0]

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
        每日预估成本
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', maxHeight: 220, display: 'block' }}
      >
        {ticks.map((t, i) => {
          const y = PAD_T + chartH - (maxCost > 0 ? (t / maxCost) * chartH : 0)
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={W} y2={y} stroke="var(--separator)" strokeWidth={0.5} />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--text-tertiary)">
                ${t.toFixed(2)}
              </text>
            </g>
          )
        })}
        {dailyCosts.map((d, i) => {
          const barH = maxCost > 0 ? (d.cost / maxCost) * chartH : 0
          const x = PAD_L + i * (barW + gap)
          const y = PAD_T + chartH - barH
          const isHovered = hover === i
          return (
            <g
              key={d.date}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'default' }}
            >
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(1, barH)}
                rx={2}
                fill={isHovered ? 'var(--text-primary)' : 'var(--accent)'}
                opacity={isHovered ? 1 : 0.8}
              />
              {(i === 0 || i === dailyCosts.length - 1 || i % 7 === 0) && (
                <text
                  x={x + barW / 2}
                  y={H - 4}
                  textAnchor="middle"
                  fontSize={8}
                  fill="var(--text-tertiary)"
                >
                  {d.date.slice(5)}
                </text>
              )}
              {isHovered && (
                <>
                  <rect
                    x={Math.min(x - 20, W - 100)}
                    y={Math.max(0, y - 30)}
                    width={90}
                    height={22}
                    rx={4}
                    fill="var(--material-thick)"
                  />
                  <text
                    x={Math.min(x - 20, W - 100) + 45}
                    y={Math.max(0, y - 30) + 15}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--text-primary)"
                    fontWeight="600"
                  >
                    {d.date.slice(5)} — {fmtCost(d.cost)}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
