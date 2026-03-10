'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from '@/app/settings-provider'
import type { Agent, CostSummary, CronJob, RunCost, ClaudeCodeUsage } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, TrendingDown, TrendingUp, Activity, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { generateId } from '@/lib/id'
import { buildCostAnalysisPrompt } from '@/lib/costs'
import { renderMarkdown } from '@/lib/sanitize'
import { fmtCost, fmtTokens } from './formatters'
import { SummaryCard } from './SummaryCard'
import { DailyCostChart } from './DailyCostChart'
import { TokenDonut } from './TokenDonut'
import { TopCrons } from './TopCrons'
import { RunDetailTable } from './RunDetailTable'
import { OptScoreRing, InsightCard } from './OptimizationPanel'
import { ClaudeUsageRow } from './ClaudeUsageRow'

/* ── Chat message type ───────────────────────────────────────── */

interface CostChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

/* ── CostsPage ───────────────────────────────────────────────── */

export function CostsPage() {
  const { t } = useSettings()
  const [data, setData] = useState<CostSummary | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [jobNames, setJobNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // AI Cost Analysis state
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysisStreaming, setAnalysisStreaming] = useState(false)
  const [analysisContent, setAnalysisContent] = useState('')
  const analysisRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [chatMessages, setChatMessages] = useState<CostChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatStreaming, setChatStreaming] = useState(false)

  // Claude Code usage state
  const [claudeUsage, setClaudeUsage] = useState<ClaudeCodeUsage | null>(null)

  // Insights collapse
  const [insightsExpanded, setInsightsExpanded] = useState(false)

  const rootAgent = useMemo(
    () => agents.find(a => a.reportsTo === null) || agents[0] || null,
    [agents],
  )

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      fetch('/api/costs').then(r => {
        if (!r.ok) throw new Error('加载成本数据失败')
        return r.json()
      }),
      fetch('/api/crons').then(r => {
        if (!r.ok) throw new Error('加载定时任务失败')
        return r.json()
      }),
      fetch('/api/agents').then(r => {
        if (!r.ok) throw new Error('加载智能体失败')
        return r.json()
      }),
    ])
      .then(([costData, cronData, agentData]: [CostSummary, { crons: CronJob[] }, Agent[]]) => {
        setData(costData)
        setAgents(agentData)
        const names: Record<string, string> = {}
        for (const c of cronData.crons) {
          names[c.id] = c.name
        }
        setJobNames(names)
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : '未知错误')
        setLoading(false)
      })
  }, [])

  // Claude Code usage SSE stream
  useEffect(() => {
    const es = new EventSource('/api/usage/stream')
    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data)
        if (parsed.type === 'usage' && parsed.data) {
          const d = parsed.data
          // Only show when we have real utilization data
          if (d.fiveHour?.utilization > 0 || d.sevenDay?.utilization > 0) {
            setClaudeUsage(d)
          }
        }
      } catch { /* skip */ }
    }
    es.onerror = () => { /* keep last good value */ }
    return () => es.close()
  }, [])

  // Auto-scroll analysis
  useEffect(() => {
    if (analysisRef.current) analysisRef.current.scrollTop = analysisRef.current.scrollHeight
  }, [analysisContent])

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const jobName = (id: string) => jobNames[id] || id

  // Date range from run costs
  const dateRange = data && data.runCosts.length > 0
    ? {
        oldest: new Date(Math.min(...data.runCosts.map(r => r.ts))),
        newest: new Date(Math.max(...data.runCosts.map(r => r.ts))),
      }
    : null

  // Total projected savings from all insights
  const totalProjectedSavings = useMemo(
    () => data?.insights.reduce((s, i) => s + (i.projectedSavings ?? 0), 0) ?? 0,
    [data],
  )

  // Run AI cost analysis
  const runAnalysis = useCallback(async () => {
    if (!rootAgent || analysisStreaming || !data) return
    setAnalysisOpen(true)
    setAnalysisStreaming(true)
    setAnalysisContent('')
    setChatMessages([])

    const prompt = buildCostAnalysisPrompt(data, jobNames)

    try {
      const res = await fetch(`/api/chat/${rootAgent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      if (!res.ok || !res.body) throw new Error('流式请求失败')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const chunk = JSON.parse(line.slice(6))
              if (chunk.content) {
                fullContent += chunk.content
                setAnalysisContent(fullContent)
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      setAnalysisContent(prev => prev + '\n\n[错误：连接智能体失败]')
    } finally {
      setAnalysisStreaming(false)
    }
  }, [rootAgent, analysisStreaming, data, jobNames])

  // Send follow-up chat message
  const sendChatMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? chatInput).trim()
    if (!text || chatStreaming || !rootAgent || !data) return
    if (!overrideText) setChatInput('')

    const userMsg: CostChatMessage = { id: generateId(), role: 'user', content: text }
    const assistantMsgId = generateId()
    const assistantMsg: CostChatMessage = { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true }

    setChatMessages(prev => [...prev, userMsg, assistantMsg])
    setChatStreaming(true)

    const prompt = buildCostAnalysisPrompt(data, jobNames)
    const allMessages = [...chatMessages, userMsg]
    const apiMessages = [
      { role: 'user' as const, content: prompt },
      ...(analysisContent ? [{ role: 'assistant' as const, content: analysisContent }] : []),
      ...allMessages.map(m => ({ role: m.role, content: m.content })),
    ]

    try {
      const res = await fetch(`/api/chat/${rootAgent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })
      if (!res.ok || !res.body) throw new Error('流式请求失败')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const chunk = JSON.parse(line.slice(6))
              if (chunk.content) {
                fullContent += chunk.content
                const captured = fullContent
                setChatMessages(prev =>
                  prev.map(m => m.id === assistantMsgId ? { ...m, content: captured, isStreaming: true } : m)
                )
              }
            } catch { /* skip */ }
          }
        }
      }

      const finalContent = fullContent
      setChatMessages(prev =>
        prev.map(m => m.id === assistantMsgId ? { ...m, content: finalContent, isStreaming: false } : m)
      )
    } catch {
      setChatMessages(prev =>
        prev.map(m => m.id === assistantMsgId ? { ...m, content: '获取回复失败，请检查 API 连接。', isStreaming: false } : m)
      )
    } finally {
      setChatStreaming(false)
      chatTextareaRef.current?.focus()
    }
  }, [chatInput, chatStreaming, rootAgent, chatMessages, analysisContent, data, jobNames])

  // Handle insight action -- open analysis if needed, then send
  const handleInsightAction = useCallback((prompt: string) => {
    if (!analysisOpen) setAnalysisOpen(true)
    // If no analysis has been run, run it first then the user's action will be available in chat
    if (!analysisContent && !analysisStreaming) {
      runAnalysis()
      return
    }
    sendChatMessage(prompt)
  }, [analysisOpen, analysisContent, analysisStreaming, runAnalysis, sendChatMessage])

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
          padding: 'var(--space-4) var(--space-6)',
        }}
      >
        <h1 style={{
          fontSize: 'var(--text-title1)',
          fontWeight: 'var(--weight-bold)',
          color: 'var(--text-primary)',
          letterSpacing: '-0.5px',
          lineHeight: 'var(--leading-tight)',
        }}>
          {t('costs.title')}
        </h1>
        {!loading && data && (
          <p style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
            {dateRange
              ? `${dateRange.oldest.toLocaleDateString()} - ${dateRange.newest.toLocaleDateString()}`
              : '暂无数据'}
            {' \u00b7 '}
            含成本数据的运行：{data.runCosts.length} 次
          </p>
        )}
      </header>

      {/* ── Scrollable content ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-4) var(--space-6) var(--space-6)', minHeight: 0 }}>
        {error && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            color: 'var(--system-red)',
            fontSize: 'var(--text-footnote)',
          }}>
            {error}
          </div>
        )}

        {loading && (
          <div>
            <div className="costs-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                  <Skeleton style={{ width: 100, height: 10, marginBottom: 8 }} />
                  <Skeleton style={{ width: 60, height: 20 }} />
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center" style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: i < 4 ? '1px solid var(--separator)' : undefined, gap: 'var(--space-3)' }}>
                  <Skeleton style={{ width: 140, height: 14 }} />
                  <Skeleton style={{ width: 60, height: 14, flex: 1 }} />
                  <Skeleton style={{ width: 80, height: 14 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && (!data || data.runCosts.length === 0) && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            color: 'var(--text-tertiary)',
            fontSize: 'var(--text-footnote)',
          }}>
            {t('costs.noData')}
          </div>
        )}

        {!loading && !error && data && data.runCosts.length > 0 && (
          <>
            {/* ── Anomaly banner ─────────────────────────────────── */}
            {data.anomalies.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                background: 'rgba(255, 149, 0, 0.08)',
                border: '1px solid rgba(255, 149, 0, 0.25)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--text-footnote)',
                color: 'var(--system-orange)',
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>{data.anomalies.length} 个异常</strong>
                  {' -- '}
                  {data.anomalies.slice(0, 3).map((a, i) => (
                    <span key={i}>
                      {i > 0 && ', '}
                      {jobName(a.jobId)}（中位数的 {a.ratio.toFixed(1)} 倍）
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Claude Code Usage ──────────────────────────────── */}
            {claudeUsage && <ClaudeUsageRow usage={claudeUsage} />}

            {/* ── Summary cards (4-col) ──────────────────────────── */}
            <div className="costs-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {/* Total Estimated Cost */}
              <SummaryCard label={t('costs.totalEstimated')}>
                <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-title2)', color: 'var(--text-primary)', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCost(data.totalCost)}
                  </span>
                  {data.weekOverWeek.changePct !== null && (
                    <span className="flex items-center" style={{
                      fontSize: 'var(--text-caption1)',
                      fontWeight: 'var(--weight-semibold)',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-sm)',
                      background: data.weekOverWeek.changePct <= 0 ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)',
                      color: data.weekOverWeek.changePct <= 0 ? 'var(--system-green)' : 'var(--system-red)',
                      gap: 2,
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}>
                      {data.weekOverWeek.changePct <= 0
                        ? <TrendingDown size={10} />
                        : <TrendingUp size={10} />}
                      {Math.abs(data.weekOverWeek.changePct).toFixed(0)}%
                    </span>
                  )}
                </div>
              </SummaryCard>

              {/* This Week vs Last Week */}
              <SummaryCard label={t('costs.thisWeek')}>
                <div style={{ fontSize: 'var(--text-title2)', color: 'var(--text-primary)', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCost(data.weekOverWeek.thisWeek)}
                </div>
                <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {t('costs.lastWeek', { value: fmtCost(data.weekOverWeek.lastWeek) })}
                </div>
              </SummaryCard>

              {/* Cache Savings */}
              <SummaryCard label={t('costs.cacheSavings')}>
                <div style={{ fontSize: 'var(--text-title2)', color: 'var(--system-green)', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCost(data.cacheSavings.estimatedSavings)}
                </div>
                <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  缓存 Token：{fmtTokens(data.cacheSavings.cacheTokens)}
                </div>
              </SummaryCard>

              {/* Anomalies */}
              <SummaryCard label="异常">
                <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
                  {data.anomalies.length > 0 && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--system-orange)', flexShrink: 0 }} />
                  )}
                  <span style={{
                    fontSize: 'var(--text-title2)',
                    fontWeight: 'var(--weight-bold)',
                    color: data.anomalies.length > 0 ? 'var(--system-orange)' : 'var(--system-green)',
                  }}>
                    {data.anomalies.length}
                  </span>
                </div>
              </SummaryCard>
            </div>

            {/* ── Optimization Score + Insights ─────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}
              className="opt-row">

              {/* Score card */}
              <div style={{
                background: 'var(--material-regular)',
                border: '1px solid var(--separator)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-3)',
              }}>
                <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)' }}>
                  {t('costs.optimizationScore')}
                </div>
                <OptScoreRing score={data.optimizationScore.overall} size={80} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', width: '100%' }}>
                  {([
                    ['缓存', data.optimizationScore.cacheScore],
                    ['分层', data.optimizationScore.tieringScore],
                    ['异常', data.optimizationScore.anomalyScore],
                    ['效率', data.optimizationScore.efficiencyScore],
                  ] as [string, number][]).map(([label, score]) => (
                    <div key={label} className="flex items-center" style={{ gap: 4, fontSize: 'var(--text-caption2)' }}>
                      <div style={{
                        width: 32, height: 4, borderRadius: 2,
                        background: 'var(--fill-tertiary)', overflow: 'hidden', flexShrink: 0,
                      }}>
                        <div style={{
                          width: `${score}%`, height: '100%', borderRadius: 2,
                          background: score >= 75 ? 'var(--system-green)' : score >= 50 ? 'var(--system-orange)' : 'var(--system-red)',
                          transition: 'width 600ms ease',
                        }} />
                      </div>
                      <span style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{label}</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600, marginLeft: 'auto' }}>{score}</span>
                    </div>
                  ))}
                </div>
                {totalProjectedSavings > 0 && (
                  <div style={{
                    marginTop: 'var(--space-1)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(48,209,88,0.10)',
                    fontSize: 'var(--text-caption1)',
                    fontWeight: 600,
                    color: 'var(--system-green)',
                    textAlign: 'center',
                  }}>
                    {t('costs.potentialSavings', { value: fmtCost(totalProjectedSavings) })}
                  </div>
                )}
              </div>

              {/* Insights list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', marginBottom: 2 }}>
                  {t('costs.optimizationInsights')}
                </div>
                {data.insights.length === 0 ? (
                  <div style={{
                    padding: 'var(--space-4)',
                    background: 'var(--material-regular)',
                    border: '1px solid var(--separator)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                    fontSize: 'var(--text-footnote)',
                    color: 'var(--system-green)',
                  }}>
                    {t('costs.allClear')}
                  </div>
                ) : (
                  <>
                    {(insightsExpanded ? data.insights : data.insights.slice(0, 2)).map(insight => (
                      <div key={insight.id} style={{ opacity: 1, transition: 'opacity 150ms ease' }}>
                        <InsightCard insight={insight} onAction={handleInsightAction} />
                      </div>
                    ))}
                    {data.insights.length > 2 && (
                      <button
                        onClick={() => setInsightsExpanded(prev => !prev)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 0',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 'var(--text-caption1)',
                          fontWeight: 'var(--weight-medium)',
                          color: 'var(--accent)',
                        }}
                      >
                        {insightsExpanded ? (
                          <><ChevronUp size={12} /> {t('costs.showLess')}</>
                        ) : (
                          <><ChevronDown size={12} /> {t('costs.showAllInsights', { count: data.insights.length })}</>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── AI Cost Analysis ────────────────────────────────── */}
            <div style={{
              background: 'var(--material-regular)',
              border: '1px solid var(--separator)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-4)',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => {
                  if (!analysisOpen) {
                    setAnalysisOpen(true)
                    if (!analysisContent && !analysisStreaming) runAnalysis()
                  } else {
                    setAnalysisOpen(!analysisOpen)
                  }
                }}
                className="focus-ring"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'var(--text-footnote)',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--text-primary)',
                }}
              >
                <Activity size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                {t('costs.aiAnalysis')}
                {analysisStreaming && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 'var(--text-caption1)', color: 'var(--accent)', fontWeight: 500,
                    }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
                      animation: 'pulse 1.2s infinite',
                    }} />
                    分析中...
                  </span>
                )}
                {analysisContent && !analysisStreaming && (
                  <span style={{
                    fontSize: 'var(--text-caption2)', fontWeight: 600,
                    padding: '1px 8px', borderRadius: 10,
                    background: 'rgba(48,209,88,0.12)', color: 'var(--system-green)',
                  }}>
                    已完成
                  </span>
                )}
                <ChevronDown
                  size={14}
                  style={{
                    marginLeft: 'auto', color: 'var(--text-tertiary)',
                    transform: analysisOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms ease',
                  }}
                />
              </button>

              {analysisOpen && (
                <div style={{ borderTop: '1px solid var(--separator)' }}>
                  {/* Analysis content */}
                  {analysisStreaming && !analysisContent && (
                    <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[180, 220, 160, 200].map((w, i) => (
                        <div key={i} style={{
                          width: w, height: 12, borderRadius: 4,
                          background: 'var(--fill-tertiary)',
                          animation: `shimmer 1.6s ease-in-out ${i * 0.15}s infinite`,
                        }} />
                      ))}
                    </div>
                  )}

                  {analysisContent && (
                    <div
                      ref={analysisRef}
                      className="markdown-body"
                      style={{
                        padding: 'var(--space-4)',
                        maxHeight: 480,
                        overflowY: 'auto',
                        fontSize: 'var(--text-footnote)',
                        lineHeight: 1.6,
                        color: 'var(--text-primary)',
                      }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(analysisContent) }}
                    />
                  )}

                  {/* Inline chat (after analysis complete) */}
                  {analysisContent && !analysisStreaming && (
                    <>
                      <div style={{ borderTop: '1px solid var(--separator)' }} />

                      {/* Chat messages */}
                      {chatMessages.length > 0 && (
                        <div style={{ maxHeight: 300, overflowY: 'auto', padding: 'var(--space-3) var(--space-4)' }}>
                          {chatMessages.map(msg => (
                            <div key={msg.id} style={{
                              marginBottom: 'var(--space-3)',
                              display: 'flex',
                              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            }}>
                              <div style={{
                                maxWidth: '85%',
                                padding: 'var(--space-2) var(--space-3)',
                                borderRadius: 'var(--radius-md, 10px)',
                                fontSize: 'var(--text-footnote)',
                                lineHeight: 1.5,
                                ...(msg.role === 'user' ? {
                                  background: 'var(--accent)',
                                  color: 'white',
                                } : {
                                  background: 'var(--fill-secondary)',
                                  color: 'var(--text-primary)',
                                }),
                              }}>
                                {msg.role === 'assistant' ? (
                                  <div
                                    className="markdown-body"
                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || '…') }}
                                  />
                                ) : (
                                  msg.content
                                )}
                                {msg.isStreaming && (
                                  <span style={{
                                    display: 'inline-block', width: 6, height: 14,
                                    background: 'var(--text-tertiary)', borderRadius: 1,
                                    marginLeft: 2, animation: 'blink 1s step-end infinite',
                                  }} />
                                )}
                              </div>
                            </div>
                          ))}
                          <div ref={chatEndRef} />
                        </div>
                      )}

                      {/* Chat input */}
                      <div style={{
                        display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)',
                        padding: 'var(--space-3) var(--space-4)',
                        borderTop: chatMessages.length > 0 ? '1px solid var(--separator)' : undefined,
                      }}>
                        <MessageSquare size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginBottom: 6 }} />
                        <textarea
                          ref={chatTextareaRef}
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              sendChatMessage()
                            }
                          }}
                          placeholder="继续问成本优化相关问题..."
                          disabled={chatStreaming}
                          rows={1}
                          style={{
                            flex: 1, resize: 'none',
                            background: 'var(--fill-tertiary)',
                            border: '1px solid var(--separator)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 10px',
                            fontSize: 'var(--text-footnote)',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            lineHeight: 1.4,
                            fontFamily: 'inherit',
                          }}
                        />
                        <button
                          onClick={() => sendChatMessage()}
                          disabled={chatStreaming || !chatInput.trim()}
                          className="btn-ghost focus-ring"
                          style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--text-caption1)',
                            fontWeight: 600,
                            background: 'var(--accent)',
                            color: 'white',
                            border: 'none',
                            cursor: chatStreaming || !chatInput.trim() ? 'not-allowed' : 'pointer',
                            opacity: chatStreaming || !chatInput.trim() ? 0.5 : 1,
                          }}
                        >
                          发送
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Most Expensive Crons ───────────────────────────── */}
            <TopCrons jobCosts={data.jobCosts} jobName={jobName} />

            {/* ── Charts row: daily cost + token donut ────────────── */}
            <div className="charts-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <DailyCostChart dailyCosts={data.dailyCosts} />
              <TokenDonut data={data} />
            </div>

            {/* ── Job cost table ──────────────────────────────────── */}
            <div style={{
              background: 'var(--material-regular)',
              border: '1px solid var(--separator)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div className="flex items-center" style={{
                padding: 'var(--space-2) var(--space-4)',
                borderBottom: '1px solid var(--separator)',
                fontSize: 'var(--text-caption1)',
                color: 'var(--text-tertiary)',
                fontWeight: 'var(--weight-medium)',
                gap: 'var(--space-3)',
              }}>
                <span style={{ flex: 2, minWidth: 0 }}>任务</span>
                <span style={{ width: 50, textAlign: 'right' }}>运行</span>
                <span style={{ width: 80, textAlign: 'right' }}>输入</span>
                <span style={{ width: 80, textAlign: 'right' }}>输出</span>
                <span className="hidden-mobile" style={{ width: 80, textAlign: 'right' }}>缓存</span>
                <span style={{ width: 80, textAlign: 'right' }}>预估成本</span>
              </div>

              {data.jobCosts.length === 0 ? (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-footnote)' }}>
                  暂无带成本数据的任务
                </div>
              ) : (
                data.jobCosts.map((job, i) => (
                  <div
                    key={job.jobId}
                    className="flex items-center"
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderBottom: i < data.jobCosts.length - 1 ? '1px solid var(--separator)' : undefined,
                      fontSize: 'var(--text-footnote)',
                      color: 'var(--text-primary)',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <span style={{ flex: 2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'var(--weight-medium)' }}>
                      {jobName(job.jobId)}
                    </span>
                    <span style={{ width: 50, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {job.runs}
                    </span>
                    <span style={{ width: 80, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtTokens(job.totalInputTokens)}
                    </span>
                    <span style={{ width: 80, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtTokens(job.totalOutputTokens)}
                    </span>
                    <span className="hidden-mobile" style={{ width: 80, textAlign: 'right', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtTokens(job.totalCacheTokens)}
                    </span>
                    <span style={{ width: 80, textAlign: 'right', fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtCost(job.totalCost)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* ── Model breakdown (inline) ────────────────────────── */}
            {data.modelBreakdown.length > 0 && (
              <div style={{
                marginTop: 'var(--space-4)',
                display: 'flex',
                gap: 'var(--space-3)',
                flexWrap: 'wrap',
                fontSize: 'var(--text-caption1)',
                color: 'var(--text-tertiary)',
              }}>
                {data.modelBreakdown.map(m => (
                  <span key={m.model}>
                    <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)' }}>
                      {m.model}
                    </span>
                    {' '}
                    {m.pct.toFixed(0)}%
                  </span>
                ))}
              </div>
            )}

            {/* ── Per-run detail table ────────────────────────────── */}
            <RunDetailTable runCosts={data.runCosts} jobName={jobName} />
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
        .summary-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        @media (max-width: 768px) {
          .costs-summary-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .top-crons-grid {
            grid-template-columns: 1fr !important;
          }
          .charts-row {
            grid-template-columns: 1fr !important;
          }
          .opt-row {
            grid-template-columns: 1fr !important;
          }
          .usage-row {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .costs-summary-grid {
            grid-template-columns: 1fr !important;
          }
          .hidden-mobile { display: none !important; }
        }
      `}</style>
    </div>
  )
}
