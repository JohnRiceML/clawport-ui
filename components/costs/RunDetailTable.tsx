'use client'

import { useState } from 'react'
import type { RunCost } from '@/lib/types'
import { fmtCost, fmtDate, fmtTokens } from './formatters'

export function RunDetailTable({ runCosts, jobName }: { runCosts: RunCost[]; jobName: (id: string) => string }) {
  const [showAll, setShowAll] = useState(false)
  const sorted = [...runCosts].sort((a, b) => b.ts - a.ts)
  const visible = showAll ? sorted : sorted.slice(0, 50)
  const hasMore = sorted.length > 50

  if (sorted.length === 0) return null

  return (
    <div style={{
      background: 'var(--material-regular)',
      border: '1px solid var(--separator)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      marginTop: 'var(--space-4)',
    }}>
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        borderBottom: '1px solid var(--separator)',
        fontSize: 'var(--text-caption1)',
        color: 'var(--text-tertiary)',
        fontWeight: 'var(--weight-medium)',
      }}>
        单次运行明细（{sorted.length} 次）
      </div>

      {/* Header */}
      <div className="flex items-center run-detail-row" style={{
        padding: 'var(--space-2) var(--space-4)',
        borderBottom: '1px solid var(--separator)',
        fontSize: 'var(--text-caption1)',
        color: 'var(--text-tertiary)',
        fontWeight: 'var(--weight-medium)',
        gap: 'var(--space-3)',
      }}>
        <span style={{ width: 120, flexShrink: 0 }}>时间</span>
        <span style={{ flex: 2, minWidth: 0 }}>任务</span>
        <span className="hidden-mobile" style={{ width: 120 }}>模型</span>
        <span style={{ width: 60, textAlign: 'right' }}>输入</span>
        <span style={{ width: 60, textAlign: 'right' }}>输出</span>
        <span className="hidden-mobile" style={{ width: 60, textAlign: 'right' }}>缓存</span>
        <span style={{ width: 70, textAlign: 'right' }}>成本</span>
      </div>

      {/* Rows */}
      {visible.map((rc, i) => (
        <div
          key={`${rc.ts}-${rc.jobId}-${i}`}
          className="flex items-center run-detail-row"
          style={{
            padding: 'var(--space-2) var(--space-4)',
            borderBottom: i < visible.length - 1 ? '1px solid var(--separator)' : undefined,
            fontSize: 'var(--text-footnote)',
            color: 'var(--text-primary)',
            gap: 'var(--space-3)',
          }}
        >
          <span style={{ width: 120, flexShrink: 0, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--text-caption1)' }}>
            {fmtDate(rc.ts)}
          </span>
          <span style={{ flex: 2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'var(--weight-medium)' }}>
            {jobName(rc.jobId)}
          </span>
          <span className="hidden-mobile" style={{ width: 120, color: 'var(--text-tertiary)', fontSize: 'var(--text-caption1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rc.model}
          </span>
          <span style={{ width: 60, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtTokens(rc.inputTokens)}
          </span>
          <span style={{ width: 60, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtTokens(rc.outputTokens)}
          </span>
          <span className="hidden-mobile" style={{ width: 60, textAlign: 'right', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtTokens(rc.cacheTokens)}
          </span>
          <span style={{ width: 70, textAlign: 'right', fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtCost(rc.minCost)}
          </span>
        </div>
      ))}

      {/* Show more */}
      {hasMore && !showAll && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
          <button
            onClick={() => setShowAll(true)}
            style={{
              fontSize: 'var(--text-footnote)',
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'var(--weight-medium)',
            }}
          >
            显示全部 {sorted.length} 条记录
          </button>
        </div>
      )}
    </div>
  )
}
