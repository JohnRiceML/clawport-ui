import type { OptimizationInsight, OptimizationScore } from '@/lib/types'
import { useSettings } from '@/app/settings-provider'
import { Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
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

function scoreColor(v: number): string {
  return v >= 75 ? 'var(--system-green)' : v >= 50 ? 'var(--system-orange)' : 'var(--system-red)'
}

/** Replace raw UUIDs in text with job names or truncated IDs */
function resolveIds(text: string, jobName: (id: string) => string): string {
  return text.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    (uuid) => {
      const name = jobName(uuid)
      return name !== uuid ? name : uuid.slice(0, 8) + '\u2026'
    },
  )
}

function InsightRow({ insight, jobName, onAction }: {
  insight: OptimizationInsight
  jobName: (id: string) => string
  onAction: (prompt: string) => void
}) {
  const { copy } = useSettings()
  const optimizationCopy = copy.costs.optimization
  const color = SEV_COLORS[insight.severity]
  return (
    <div style={{
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: color,
        flexShrink: 0, marginTop: 5,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', flexWrap: 'wrap',
          gap: '4px 10px', marginBottom: 4,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {resolveIds(insight.title, jobName)}
          </span>
          {insight.projectedSavings !== null && insight.projectedSavings > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'var(--system-green)',
              background: 'rgba(48,209,88,0.10)', padding: '1px 8px', borderRadius: 10,
            }}>
              {optimizationCopy.savePerPeriod(fmtCost(insight.projectedSavings))}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55,
          overflowWrap: 'anywhere',
        }}>
          {resolveIds(insight.description, jobName)}
        </div>
      </div>
      <button
        onClick={() => onAction(insight.action)}
        className="btn-ghost focus-ring"
        style={{
          padding: '4px 10px', borderRadius: 14,
          fontSize: 11, fontWeight: 600,
          border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
          background: 'transparent', color, cursor: 'pointer',
          whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4,
          flexShrink: 0, marginTop: 2,
        }}
      >
        <Zap size={10} />
        {optimizationCopy.howToFix}
      </button>
    </div>
  )
}

/** Unified optimization card: score + sub-scores + insights in one surface */
export function OptimizationCard({ score, insights, totalSavings, jobName, onAction }: {
  score: OptimizationScore
  insights: OptimizationInsight[]
  totalSavings: number
  jobName: (id: string) => string
  onAction: (prompt: string) => void
}) {
  const { copy } = useSettings()
  const optimizationCopy = copy.costs.optimization
  const [expanded, setExpanded] = useState(false)
  const dims = [
    [optimizationCopy.dimensions.cache, score.cacheScore],
    [optimizationCopy.dimensions.tiering, score.tieringScore],
    [optimizationCopy.dimensions.anomaly, score.anomalyScore],
    [optimizationCopy.dimensions.efficiency, score.efficiencyScore],
  ] as [string, number][]

  return (
    <div style={{
      background: 'var(--material-regular)',
      border: '1px solid var(--separator)',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 'var(--space-4)',
    }}>
      {/* Header: score ring + dimensions + savings */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <OptScoreRing score={score.overall} size={72} />
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
            color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 10,
          }}>
            {optimizationCopy.score}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '6px 16px' }}>
            {dims.map(([label, val]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: 'var(--fill-tertiary)', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${val}%`, height: '100%', borderRadius: 2,
                    background: scoreColor(val),
                    transition: 'width 600ms ease',
                  }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 52 }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'right' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
        {totalSavings > 0 && (
          <div style={{
            padding: '6px 14px', borderRadius: 10,
            background: 'rgba(48,209,88,0.08)',
            fontSize: 12, fontWeight: 600, color: 'var(--system-green)',
            whiteSpace: 'nowrap', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, fontWeight: 500, opacity: 0.7, marginBottom: 2 }}>{optimizationCopy.potential}</div>
            {optimizationCopy.savePerPeriod(fmtCost(totalSavings))}
          </div>
        )}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <>
          <div style={{ height: 1, background: 'var(--separator)' }} />
          <div style={{
            padding: '10px 20px 4px', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.04em', color: 'var(--text-tertiary)', textTransform: 'uppercase',
          }}>
            {optimizationCopy.insights}
          </div>
          {(expanded ? insights : insights.slice(0, 2)).map(insight => (
            <InsightRow key={insight.id} insight={insight} jobName={jobName} onAction={onAction} />
          ))}
          {insights.length > 2 && (
            <div style={{ padding: '4px 20px 12px' }}>
              <button
                onClick={() => setExpanded(prev => !prev)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 500, color: 'var(--accent)',
                  padding: 0,
                }}
              >
                {expanded
                  ? <><ChevronUp size={12} /> {optimizationCopy.showLess}</>
                  : <><ChevronDown size={12} /> {optimizationCopy.showAllInsights(insights.length)}</>}
              </button>
            </div>
          )}
        </>
      )}
      {insights.length === 0 && (
        <>
          <div style={{ height: 1, background: 'var(--separator)' }} />
          <div style={{
            padding: '16px 20px', textAlign: 'center',
            fontSize: 13, color: 'var(--system-green)',
          }}>
            {optimizationCopy.allClear}
          </div>
        </>
      )}
    </div>
  )
}
