"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Copy, Check } from "lucide-react"
import { useSettings } from "@/app/settings-provider"
import type { Copy as I18nCopy } from "@/lib/i18n"
import type { Agent, CronJob, CronRun } from "@/lib/types"
import type { Pipeline } from "@/lib/cron-pipelines"
import { formatDuration, timeAgo, nextRunLabel } from "@/lib/cron-utils"
import { computePipelineContext, buildCronContext } from "@/lib/pipeline-utils"
import { Skeleton } from "@/components/ui/skeleton"
import { generateId } from "@/lib/id"

/* ─── Chat message type ────────────────────────────────────────── */

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
}

type CronCopy = I18nCopy["crons"]

function localizeRelativeLabel(value: string, copy: CronCopy): string {
  if (value === "just now") return copy.relative.justNow
  if (value === "never") return copy.relative.never
  if (value === "not scheduled") return copy.relative.notScheduled
  if (value === "overdue") return copy.relative.overdue
  if (value === "\u2014") return copy.relative.noValue

  const future = value.match(/^in (\d+)([mhd])$/)
  if (future) {
    const count = Number(future[1])
    const unit = future[2]
    if (unit === "m") return copy.relative.inMinutes(count)
    if (unit === "h") return copy.relative.inHours(count)
    if (unit === "d") return copy.relative.inDays(count)
  }

  const past = value.match(/^(\d+)([mhd]) ago$/)
  if (past) {
    const count = Number(past[1])
    const unit = past[2]
    if (unit === "m") return copy.relative.minutesAgo(count)
    if (unit === "h") return copy.relative.hoursAgo(count)
    if (unit === "d") return copy.relative.daysAgo(count)
  }

  return value
}

function localizeDurationLabel(value: string, copy: CronCopy): string {
  if (value === "\u2014") return copy.relative.noValue
  return value
    .replace(/(\d+)h/g, (_, count: string) => copy.relative.hours(Number(count)))
    .replace(/(\d+)m/g, (_, count: string) => copy.relative.minutes(Number(count)))
    .replace(/(\d+)s/g, (_, count: string) => copy.relative.seconds(Number(count)))
}

function localizeDeliveryStatus(value: string | null | undefined, copy: CronCopy): string {
  if (!value) return copy.relative.noValue
  if (value === "delivered") return copy.deliveryStatus.delivered
  if (value === "unknown") return copy.deliveryStatus.unknown
  return value
}

/* ─── Recent Runs (lazy-loaded) ────────────────────────────────── */

function RecentRuns({ jobId }: { jobId: string }) {
  const { copy } = useSettings()
  const cronsCopy = copy.crons
  const [runs, setRuns] = useState<CronRun[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/cron-runs?jobId=${encodeURIComponent(jobId)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setRuns((data as CronRun[]).slice(0, 5)); setLoading(false) })
      .catch(() => { setRuns([]); setLoading(false) })
  }, [jobId])

  if (loading) {
    return (
      <div>
        <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "var(--space-2)" }}>
          {cronsCopy.recentRuns}
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} style={{ height: 16, marginBottom: 4, width: "80%" }} />
        ))}
      </div>
    )
  }

  if (!runs || runs.length === 0) {
    return (
      <div>
        <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "var(--space-2)" }}>
          {cronsCopy.recentRuns}
        </div>
        <div style={{ fontSize: "var(--text-caption2)", color: "var(--text-tertiary)" }}>{cronsCopy.noRunHistory}</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "var(--space-2)" }}>
        {cronsCopy.recentRuns}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {runs.map((run, i) => {
          const statusDot = run.status === "ok" ? "var(--system-green)" : "var(--system-red)"
          const ago = localizeRelativeLabel(timeAgo(new Date(run.ts).toISOString()), cronsCopy)
          const duration = localizeDurationLabel(formatDuration(run.durationMs), cronsCopy)
          const deliveryStat = localizeDeliveryStatus(run.deliveryStatus, cronsCopy)
          const summaryText = run.status === "error" ? (run.error || cronsCopy.statusLabels.error) : (run.summary || "\u2014")
          const truncatedSummary = summaryText.length > 60 ? summaryText.slice(0, 57) + "..." : summaryText

          return (
            <div
              key={`${run.ts}-${i}`}
              className="flex items-center"
              style={{ gap: "var(--space-2)", fontSize: "var(--text-caption2)", minHeight: 22, padding: "2px 0" }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusDot, flexShrink: 0 }} />
              <span style={{ color: "var(--text-tertiary)", minWidth: 52, flexShrink: 0 }}>{ago}</span>
              <span style={{ color: "var(--text-secondary)", minWidth: 52, flexShrink: 0 }}>{duration}</span>
              <span style={{ color: run.deliveryStatus === "delivered" ? "var(--system-green)" : "var(--text-tertiary)", minWidth: 60, flexShrink: 0 }}>
                {deliveryStat}
              </span>
              <span className="truncate" style={{ color: "var(--text-tertiary)", minWidth: 0, flex: 1 }}>
                {truncatedSummary}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Main component ───────────────────────────────────────────── */

interface PipelineDetailPanelProps {
  jobName: string
  crons: CronJob[]
  agents: Agent[]
  pipelines: Pipeline[]
  onClose: () => void
}

export function PipelineDetailPanel({ jobName, crons, agents, pipelines, onClose }: PipelineDetailPanelProps) {
  const { copy } = useSettings()
  const cronsCopy = copy.crons
  const detailCopy = copy.crons.pipelines.detailPanel
  const closeRef = useRef<HTMLButtonElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [copiedError, setCopiedError] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)

  const cron = crons.find(c => c.name === jobName) || null
  const agent = cron?.agentId ? agents.find(a => a.id === cron.agentId) || null : null

  // Compute pipeline context
  const { inputs, outputs } = computePipelineContext(jobName, pipelines)

  const statusColor = cron?.status === "ok" ? "var(--system-green)" : cron?.status === "error" ? "var(--system-red)" : "var(--text-tertiary)"
  const statusLabel = cron ? cronsCopy.statusLabels[cron.status] : copy.crons.deliveryStatus.unknown
  const isOverdue = cron?.nextRun && nextRunLabel(cron.nextRun) === "overdue"

  // Build context string for the agent (memoize-ish via ref to avoid rebuilding)
  const cronContext = buildCronContext(jobName, cron, inputs, outputs)

  // Reset chat when job changes
  useEffect(() => {
    setMessages([])
    setInput("")
    setIsStreaming(false)
  }, [jobName])

  // Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  // Focus close button on mount
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function copyError() {
    if (!cron?.lastError) return
    navigator.clipboard.writeText(cron.lastError).then(() => {
      setCopiedError(true)
      setTimeout(() => setCopiedError(false), 2000)
    })
  }

  /* ── Send message + stream response ─────────────── */

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming || !agent) return

    const userMsg: ChatMessage = { id: generateId(), role: "user", content: text }
    const assistantMsgId = generateId()
    const assistantMsg: ChatMessage = { id: assistantMsgId, role: "assistant", content: "", isStreaming: true }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput("")
    setIsStreaming(true)

    // Build API messages: inject cron context as a system-level user message at the start
    const allMessages = [...messages, userMsg]
    const apiMessages = [
      { role: "user" as const, content: cronContext },
      { role: "assistant" as const, content: `Understood, I have context about the "${jobName}" cron job. How can I help?` },
      ...allMessages.map(m => ({ role: m.role, content: m.content })),
    ]

    try {
      const res = await fetch(`/api/chat/${agent.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!res.ok || !res.body) throw new Error("Stream failed")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let fullContent = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const chunk = JSON.parse(line.slice(6))
              if (chunk.content) {
                fullContent += chunk.content
                const captured = fullContent
                setMessages(prev =>
                  prev.map(m => m.id === assistantMsgId
                    ? { ...m, content: captured, isStreaming: true }
                    : m
                  )
                )
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      }

      const finalContent = fullContent
      setMessages(prev =>
        prev.map(m => m.id === assistantMsgId
          ? { ...m, content: finalContent, isStreaming: false }
          : m
        )
      )
    } catch {
      setMessages(prev =>
        prev.map(m => m.id === assistantMsgId
          ? { ...m, content: copy.chat.responseError, isStreaming: false }
          : m
        )
      )
    } finally {
      setIsStreaming(false)
      textareaRef.current?.focus()
    }
  }, [input, isStreaming, agent, messages, cronContext, jobName])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const accentColor = agent?.color || "var(--accent)"

  return (
    <div
      className="fixed inset-0 z-40 md:absolute md:inset-y-0 md:right-0 md:left-auto md:z-30 panel-slide-in"
    >
      <div
        className="h-full flex flex-col ml-auto"
        style={{
          width: "100%",
          maxWidth: 420,
          flexShrink: 0,
          background: "var(--material-regular)",
          backdropFilter: "var(--sidebar-backdrop)",
          WebkitBackdropFilter: "var(--sidebar-backdrop)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Color strip */}
        <div style={{ height: 3, background: accentColor, flexShrink: 0 }} />

        {/* Scrollable top section */}
        <div style={{ flex: "0 0 auto", overflowY: "auto", maxHeight: "50%" }}>
          {/* Panel controls */}
          <div style={{
            padding: "var(--space-4) var(--space-5) 0",
            display: "flex",
            justifyContent: "flex-end",
          }}>
            <button
              ref={closeRef}
              onClick={onClose}
              className="focus-ring"
              aria-label={detailCopy.closeAria}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--fill-secondary)",
                color: "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
                fontSize: "var(--text-footnote)",
                transition: "all 150ms var(--ease-spring)",
              }}
            >
              &#x2715;
            </button>
          </div>

          {/* ─── Job Info ─────────────────────────────────────── */}
          <div style={{ padding: "var(--space-2) var(--space-5) var(--space-4)" }}>
            <div className="flex items-center" style={{ gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
              <h2 style={{
                fontSize: "var(--text-title3)",
                fontWeight: 700,
                letterSpacing: "-0.3px",
                color: "var(--text-primary)",
                margin: 0,
                lineHeight: 1.25,
              }}>
                {jobName}
              </h2>
              <span style={{
                fontSize: "var(--text-caption2)",
                fontWeight: 600,
                padding: "2px var(--space-2)",
                borderRadius: "var(--radius-sm)",
                background: statusColor,
                color: "#fff",
                textTransform: "capitalize",
              }}>
                {statusLabel}
              </span>
            </div>

            {/* Agent link */}
            {agent && (
              <Link
                href={`/chat/${agent.id}`}
                className="focus-ring"
                style={{
                  fontSize: "var(--text-footnote)",
                  color: "var(--system-blue)",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-1)",
                }}
              >
                {agent.emoji && <span>{agent.emoji}</span>}
                {agent.name}
              </Link>
            )}
          </div>

          {/* ─── Details Grid ─────────────────────────────────── */}
          <div style={{ padding: "0 var(--space-5) var(--space-4)" }}>
            <div style={{ height: 1, background: "var(--separator)", marginBottom: "var(--space-3)" }} />

            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--space-1) var(--space-4)" }}>
              {/* Schedule */}
              <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>{cronsCopy.details.schedule}</span>
              <div>
                {cron?.scheduleDescription && (
                  <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>{cron.scheduleDescription}</div>
                )}
                <div className="font-mono" style={{ fontSize: "var(--text-caption2)", color: "var(--text-tertiary)", marginTop: cron?.scheduleDescription ? 2 : 0 }}>
                  {cron?.schedule || "\u2014"}
                  {cron?.timezone && <span style={{ marginLeft: 8 }}>({cron.timezone})</span>}
                </div>
              </div>

              {/* Last run */}
              <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>{cronsCopy.details.lastRun}</span>
              <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>{localizeRelativeLabel(timeAgo(cron?.lastRun || null), cronsCopy)}</span>

              {/* Next run */}
              <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>{cronsCopy.details.nextRun}</span>
              <span style={{
                fontSize: "var(--text-caption1)",
                color: isOverdue ? "var(--system-orange)" : "var(--text-secondary)",
                fontWeight: isOverdue ? 600 : undefined,
              }}>
                {localizeRelativeLabel(nextRunLabel(cron?.nextRun || null), cronsCopy)}
              </span>

              {/* Duration */}
              {cron?.lastDurationMs != null && (
                <>
                  <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>{cronsCopy.details.duration}</span>
                  <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>{localizeDurationLabel(formatDuration(cron.lastDurationMs), cronsCopy)}</span>
                </>
              )}

              {/* Delivery */}
              {cron?.delivery && (
                <>
                  <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>{cronsCopy.details.delivery}</span>
                  <span style={{ fontSize: "var(--text-caption1)" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{cron.delivery.channel}</span>
                    {cron.delivery.to && (
                      <span style={{ color: "var(--text-tertiary)", marginLeft: 4 }}>
                        {cron.delivery.to.length > 20 ? cron.delivery.to.slice(0, 17) + "..." : cron.delivery.to}
                      </span>
                    )}
                    {cron.lastDeliveryStatus && (
                      <span style={{
                        color: cron.lastDeliveryStatus === "delivered" ? "var(--system-green)" : "var(--system-orange)",
                        marginLeft: 8,
                        fontWeight: 500,
                      }}>
                        {localizeDeliveryStatus(cron.lastDeliveryStatus, cronsCopy)}
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ─── Error box ────────────────────────────────────── */}
          {cron?.lastError && (
            <div style={{ padding: "0 var(--space-5) var(--space-4)" }}>
              <div style={{
                borderRadius: "var(--radius-sm)",
                background: "var(--code-bg)",
                border: "1px solid var(--code-border)",
                padding: "var(--space-3)",
              }}>
                <div className="flex items-start justify-between" style={{ gap: "var(--space-2)" }}>
                  <pre className="font-mono" style={{
                    fontSize: "var(--text-caption1)",
                    color: "var(--system-red)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    margin: 0,
                    flex: 1,
                    lineHeight: "var(--leading-relaxed)",
                  }}>
                    {cron.lastError}
                  </pre>
                  <button
                    onClick={copyError}
                    className="btn-ghost focus-ring flex-shrink-0"
                    aria-label={cronsCopy.details.copyErrorText}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "var(--text-caption2)",
                      fontWeight: 500,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    {copiedError ? <Check size={12} /> : <Copy size={12} />}
                    {copiedError ? cronsCopy.banners.copied : cronsCopy.banners.copy}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Pipeline Context ─────────────────────────────── */}
          {(inputs.length > 0 || outputs.length > 0) && (
            <div style={{ padding: "0 var(--space-5) var(--space-4)" }}>
              <div style={{ height: 1, background: "var(--separator)", marginBottom: "var(--space-3)" }} />

              <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "var(--space-2)" }}>
                {detailCopy.pipelineContext}
              </div>

              {inputs.length > 0 && (
                <div style={{ marginBottom: inputs.length > 0 && outputs.length > 0 ? "var(--space-3)" : 0 }}>
                  <div style={{ fontSize: "var(--text-caption2)", color: "var(--text-tertiary)", marginBottom: "var(--space-1)" }}>
                    {detailCopy.inputs}
                  </div>
                  {inputs.map((inp, i) => (
                    <div key={i} className="flex items-center" style={{ gap: "var(--space-2)", fontSize: "var(--text-caption1)", marginBottom: 2 }}>
                      <span style={{ color: "var(--system-green)" }}>&larr;</span>
                      <span className="font-mono" style={{ color: "var(--accent)", fontSize: "var(--text-caption2)" }}>{inp.artifact}</span>
                      <span style={{ color: "var(--text-tertiary)" }}>{detailCopy.from}</span>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{inp.from}</span>
                    </div>
                  ))}
                </div>
              )}

              {outputs.length > 0 && (
                <div>
                  <div style={{ fontSize: "var(--text-caption2)", color: "var(--text-tertiary)", marginBottom: "var(--space-1)" }}>
                    {detailCopy.outputs}
                  </div>
                  {outputs.map((out, i) => (
                    <div key={i} className="flex items-center" style={{ gap: "var(--space-2)", fontSize: "var(--text-caption1)", marginBottom: 2 }}>
                      <span style={{ color: "var(--system-blue)" }}>&rarr;</span>
                      <span className="font-mono" style={{ color: "var(--accent)", fontSize: "var(--text-caption2)" }}>{out.artifact}</span>
                      <span style={{ color: "var(--text-tertiary)" }}>{detailCopy.to}</span>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{out.to}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Recent Runs ──────────────────────────────────── */}
          {cron && (
            <div style={{ padding: "0 var(--space-5) var(--space-4)" }}>
              <div style={{ height: 1, background: "var(--separator)", marginBottom: "var(--space-3)" }} />
              <RecentRuns jobId={cron.id} />
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{
          height: 1,
          background: "var(--separator)",
          flexShrink: 0,
          margin: "0 var(--space-5)",
        }} />

        {/* ─── Agent Chat ─────────────────────────────────────── */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          padding: "var(--space-3) var(--space-5) 0",
        }}>
          <div style={{
            fontSize: "var(--text-caption1)",
            fontWeight: 600,
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "var(--space-2)",
            flexShrink: 0,
          }}>
            {agent ? cronsCopy.details.chatWith(agent.name) : detailCopy.agentChat}
          </div>

          {!agent ? (
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-tertiary)",
              fontSize: "var(--text-footnote)",
              fontStyle: "italic",
            }}>
              {detailCopy.noAgent}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                paddingBottom: "var(--space-2)",
                minHeight: 0,
              }}>
                {messages.length === 0 && (
                  <div style={{
                    color: "var(--text-tertiary)",
                    fontSize: "var(--text-caption1)",
                    textAlign: "center",
                    padding: "var(--space-6) 0",
                    fontStyle: "italic",
                    lineHeight: 1.5,
                  }}>
                    {detailCopy.askAgentAbout(agent.name, jobName)}
                    <br />
                    <span style={{ fontSize: "var(--text-caption2)" }}>
                      {detailCopy.contextIncluded}
                    </span>
                  </div>
                )}

                {messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div style={{
                      maxWidth: "85%",
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-footnote)",
                      lineHeight: 1.45,
                      background: msg.role === "user" ? accentColor : "var(--fill-tertiary)",
                      color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}>
                      {msg.content}
                      {msg.isStreaming && !msg.content && (
                        <span style={{ opacity: 0.5 }}>{copy.crons.pipelines.healthCheck.thinking}</span>
                      )}
                      {msg.isStreaming && msg.content && (
                        <span style={{
                          display: "inline-block",
                          width: 4,
                          height: 14,
                          background: msg.role === "user" ? "#fff" : "var(--text-primary)",
                          marginLeft: 2,
                          opacity: 0.6,
                          animation: "blink 1s infinite",
                          verticalAlign: "text-bottom",
                        }} />
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{
                flexShrink: 0,
                padding: "var(--space-2) 0 var(--space-3)",
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "flex-end",
              }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={copy.chat.messagePlaceholder(agent.name)}
                  rows={1}
                  disabled={isStreaming}
                  style={{
                    flex: 1,
                    resize: "none",
                    border: "1px solid var(--separator)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--fill-tertiary)",
                    color: "var(--text-primary)",
                    padding: "var(--space-2) var(--space-3)",
                    fontSize: "var(--text-footnote)",
                    fontFamily: "inherit",
                    outline: "none",
                    lineHeight: 1.4,
                    maxHeight: 80,
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  className="focus-ring"
                  aria-label={detailCopy.sendMessageAria}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    cursor: !input.trim() || isStreaming ? "default" : "pointer",
                    background: !input.trim() || isStreaming ? "var(--fill-tertiary)" : accentColor,
                    color: !input.trim() || isStreaming ? "var(--text-tertiary)" : "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    flexShrink: 0,
                    transition: "all 120ms ease",
                  }}
                >
                  &#x2191;
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
