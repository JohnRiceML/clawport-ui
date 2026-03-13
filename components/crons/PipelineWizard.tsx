"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type { Agent, CronJob } from "@/lib/types"
import type { Pipeline } from "@/lib/cron-pipelines"

interface PipelineWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: Agent[]
  crons: CronJob[]
  onSaved: () => void
}

const PROMPT_TEMPLATE = `Analyze these cron jobs and suggest a pipelines.json that maps file I/O dependencies between them. Look at job names, schedules, and descriptions to infer which jobs produce files that other jobs consume.

Return ONLY a JSON code block in this exact format:
\`\`\`json
[{ "name": "Pipeline Name", "edges": [{ "from": "source-job", "to": "dest-job", "artifact": "filename.json" }] }]
\`\`\`

If no dependencies are detectable, return an empty array: \`\`\`json\n[]\n\`\`\`

Cron jobs:
{cronList}`

function buildCronList(crons: CronJob[]): string {
  return crons
    .map(c => `- ${c.name} (${c.scheduleDescription || c.schedule})${c.description ? ` — ${c.description}` : ""}`)
    .join("\n")
}

function extractJson(text: string): string | null {
  const match = text.match(/```json\s*([\s\S]*?)```/)
  return match ? match[1].trim() : null
}

function validatePipelines(json: string): { valid: boolean; error: string | null; data: Pipeline[] | null } {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { valid: false, error: "Invalid JSON syntax", data: null }
  }

  if (!Array.isArray(parsed)) {
    return { valid: false, error: "Must be an array", data: null }
  }

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i] as Record<string, unknown>
    if (typeof p.name !== "string") {
      return { valid: false, error: `Pipeline ${i}: missing "name" string`, data: null }
    }
    if (!Array.isArray(p.edges)) {
      return { valid: false, error: `Pipeline "${p.name}": missing "edges" array`, data: null }
    }
    for (let j = 0; j < (p.edges as unknown[]).length; j++) {
      const e = (p.edges as Record<string, unknown>[])[j]
      if (typeof e.from !== "string" || typeof e.to !== "string" || typeof e.artifact !== "string") {
        return { valid: false, error: `Pipeline "${p.name}", edge ${j}: requires "from", "to", and "artifact" strings`, data: null }
      }
    }
  }

  return { valid: true, error: null, data: parsed as Pipeline[] }
}

function useElapsed(running: boolean) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(0)
  useEffect(() => {
    if (!running) { setElapsed(0); return }
    startRef.current = Date.now()
    const tick = () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [running])
  return elapsed
}

function formatElapsed(s: number): string {
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export function PipelineWizard({ open, onOpenChange, agents, crons, onSaved }: PipelineWizardProps) {
  const [step, setStep] = useState(0)
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [agentResponse, setAgentResponse] = useState("")
  const [pipelineJson, setPipelineJson] = useState("")
  const [parseError, setParseError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const responseRef = useRef<HTMLDivElement>(null)
  const elapsed = useElapsed(isStreaming)

  // Default to root orchestrator
  useEffect(() => {
    if (open && agents.length > 0 && !selectedAgentId) {
      const root = agents.find(a => a.reportsTo === null)
      setSelectedAgentId(root?.id || agents[0].id)
    }
  }, [open, agents, selectedAgentId])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(0)
      setIsStreaming(false)
      setAgentResponse("")
      setPipelineJson("")
      setParseError(null)
      setIsSaving(false)
    }
  }, [open])

  // Auto-scroll response area
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight
    }
  }, [agentResponse])

  // Validate JSON on change
  useEffect(() => {
    if (!pipelineJson.trim()) {
      setParseError(null)
      return
    }
    const { valid, error } = validatePipelines(pipelineJson)
    setParseError(valid ? null : error)
  }, [pipelineJson])

  const handleAnalyze = useCallback(async () => {
    setStep(1)
    setIsStreaming(true)
    setAgentResponse("")
    setPipelineJson("")
    setParseError(null)

    const cronList = buildCronList(crons)
    const prompt = PROMPT_TEMPLATE.replace("{cronList}", cronList)

    try {
      const res = await fetch(`/api/chat/${selectedAgentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
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
                setAgentResponse(fullContent)

                // Try to extract JSON as it streams
                const extracted = extractJson(fullContent)
                if (extracted) {
                  setPipelineJson(extracted)
                }
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      }

      // Final extraction attempt
      const extracted = extractJson(fullContent)
      if (extracted) {
        setPipelineJson(extracted)
      }
    } catch {
      setAgentResponse(prev => prev + "\n\n[Error: Failed to connect to agent]")
    } finally {
      setIsStreaming(false)
    }
  }, [crons, selectedAgentId])

  const handleSave = useCallback(async () => {
    const { valid, data } = validatePipelines(pipelineJson)
    if (!valid || !data) return

    setIsSaving(true)
    try {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save")
      }

      setStep(2)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to save pipelines")
    } finally {
      setIsSaving(false)
    }
  }, [pipelineJson])

  const handleClose = useCallback(() => {
    if (step === 2) {
      onSaved()
    }
    onOpenChange(false)
  }, [step, onSaved, onOpenChange])

  if (!open) return null

  const selectedAgent = agents.find(a => a.id === selectedAgentId)
  const jsonIsValid = pipelineJson.trim() !== "" && !parseError

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.25)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isStreaming) onOpenChange(false)
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: "100%",
          maxWidth: 600,
          margin: "0 var(--space-4)",
          background: "var(--material-regular)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--separator)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div style={{ padding: "var(--space-5) var(--space-5) 0", position: "relative" }}>
          {/* Close button */}
          {!isStreaming && (
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "transparent",
                color: "var(--text-tertiary)",
                cursor: "pointer",
                fontSize: 18,
              }}
            >
              &times;
            </button>
          )}

          <div style={{ fontSize: "var(--text-title3)", fontWeight: "var(--weight-bold)", color: "var(--text-primary)", marginBottom: "var(--space-1)" }}>
            {step === 0 && "Set Up Pipelines"}
            {step === 1 && "Pipeline Analysis"}
            {step === 2 && "Pipelines Saved"}
          </div>
          <div style={{ fontSize: "var(--text-footnote)", color: "var(--text-secondary)", lineHeight: "var(--leading-relaxed)" }}>
            {step === 0 && "An AI agent will analyze your cron jobs to detect file dependencies between them, then generate a pipeline config you can review and save."}
            {step === 1 && (isStreaming
              ? "Your agent is analyzing " + crons.length + " cron job" + (crons.length !== 1 ? "s" : "") + " to map out your system's data flow."
              : "Review the suggested pipeline configuration below."
            )}
            {step === 2 && "Your pipeline configuration has been saved successfully."}
          </div>

          {/* Step indicator */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "var(--space-4) 0 0" }}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  width: i === step ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i <= step ? "var(--accent)" : "var(--fill-tertiary)",
                  opacity: i < step ? 0.5 : 1,
                  transition: "all 200ms var(--ease-smooth)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "var(--space-4) var(--space-5) var(--space-5)", overflowY: "auto", flex: 1 }}>
          {/* ─── Step 0: Agent Selection ─── */}
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {/* What will happen */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
                padding: "var(--space-4)",
                borderRadius: "var(--radius-md, 10px)",
                background: "var(--fill-secondary)",
                border: "1px solid var(--separator)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: "var(--radius-sm)",
                    background: "var(--accent-fill, rgba(99,102,241,0.1))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    flexShrink: 0,
                  }}>
                    {selectedAgent?.emoji || "🤖"}
                  </div>
                  <div>
                    <div style={{ fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--text-primary)" }}>
                      {crons.length} cron job{crons.length !== 1 ? "s" : ""} to analyze
                    </div>
                    <div style={{ fontSize: "var(--text-caption2)", color: "var(--text-tertiary)", lineHeight: 1.4, marginTop: 2 }}>
                      The agent will map file I/O dependencies between your jobs
                    </div>
                  </div>
                </div>

                {/* How it works steps */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { icon: "1", text: "Reads job names, schedules, and descriptions" },
                    { icon: "2", text: "Infers which jobs produce files others consume" },
                    { icon: "3", text: "Generates a pipeline config for you to review" },
                  ].map(item => (
                    <div key={item.icon} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <div style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "var(--accent-fill, rgba(99,102,241,0.1))",
                        color: "var(--accent)",
                        fontSize: 10,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        {item.icon}
                      </div>
                      <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time expectation */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-sm)",
                background: "rgba(255,149,0,0.06)",
                border: "1px solid rgba(255,149,0,0.15)",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--system-orange, #f59e0b)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  {crons.length <= 5
                    ? "This usually takes 15\u201330 seconds."
                    : crons.length <= 20
                      ? "With " + crons.length + " jobs, this may take 30\u201360 seconds."
                      : "With " + crons.length + " jobs, this may take a minute or more. Sit tight!"
                  }
                </span>
              </div>

              {/* Agent selector */}
              <div>
                <label
                  htmlFor="agent-select"
                  style={{ display: "block", fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}
                >
                  Analyzing agent
                </label>
                <select
                  id="agent-select"
                  value={selectedAgentId}
                  onChange={e => setSelectedAgentId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: "var(--text-footnote)",
                    color: "var(--text-primary)",
                    background: "var(--fill-secondary)",
                    border: "1px solid var(--separator)",
                    borderRadius: "var(--radius-sm)",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.emoji} {a.name} — {a.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
                <button
                  onClick={() => onOpenChange(false)}
                  className="btn-ghost focus-ring"
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "var(--text-footnote)",
                    fontWeight: "var(--weight-medium)",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={crons.length === 0}
                  className="focus-ring"
                  style={{
                    padding: "8px 20px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "var(--text-footnote)",
                    fontWeight: "var(--weight-semibold)",
                    border: "none",
                    cursor: crons.length === 0 ? "not-allowed" : "pointer",
                    background: "var(--accent)",
                    color: "#fff",
                    opacity: crons.length === 0 ? 0.5 : 1,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v1l2 9h12l2-9v-1a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
                    <line x1="12" y1="12" x2="12" y2="16" /><line x1="10" y1="14" x2="14" y2="14" />
                  </svg>
                  Analyze My Scheduled Jobs
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 1: AI Generation + Review ─── */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {/* Progress banner while streaming */}
              {isStreaming && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-md, 10px)",
                  background: "var(--accent-fill, rgba(99,102,241,0.08))",
                  border: "1px solid color-mix(in srgb, var(--accent, #6366f1) 20%, transparent)",
                }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    border: "2px solid var(--separator)",
                    borderTopColor: "var(--accent)",
                    animation: "spin 0.8s linear infinite",
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--text-primary)" }}>
                      {!agentResponse
                        ? "Connecting to " + (selectedAgent?.name || "agent") + "..."
                        : pipelineJson
                          ? "Finalizing pipeline config..."
                          : "Mapping job dependencies..."
                      }
                    </div>
                    <div style={{ fontSize: "var(--text-caption2)", color: "var(--text-tertiary)", marginTop: 2 }}>
                      {formatElapsed(elapsed)} elapsed
                      {crons.length > 10 && !agentResponse && " \u00b7 Larger workspaces take longer"}
                    </div>
                  </div>
                  {selectedAgent && (
                    <div style={{
                      fontSize: 16,
                      width: 28,
                      height: 28,
                      borderRadius: "var(--radius-sm)",
                      background: "var(--material-thin, rgba(255,255,255,0.04))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {selectedAgent.emoji}
                    </div>
                  )}
                </div>
              )}

              {/* Done banner */}
              {!isStreaming && agentResponse && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(34,197,94,0.06)",
                  border: "1px solid rgba(34,197,94,0.15)",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--system-green, #22c55e)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" /><polyline points="8 12 11 15 16 9" />
                  </svg>
                  <span style={{ fontSize: "var(--text-caption1)", color: "var(--system-green, #22c55e)", fontWeight: 600 }}>
                    Analysis complete
                  </span>
                  <span style={{ fontSize: "var(--text-caption2)", color: "var(--text-tertiary)" }}>
                    {pipelineJson ? "Review the config below and save when ready." : "No dependencies detected. You can edit the JSON manually."}
                  </span>
                </div>
              )}

              {/* Agent response area */}
              <div>
                <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
                  {selectedAgent?.emoji} {selectedAgent?.name}&apos;s Analysis
                </div>
                {/* Skeleton while waiting for first chunk */}
                {isStreaming && !agentResponse && (
                  <div style={{
                    fontSize: "var(--text-caption1)",
                    background: "var(--code-bg, rgba(0,0,0,0.1))",
                    border: "1px solid var(--code-border, var(--separator))",
                    borderRadius: "var(--radius-sm)",
                    padding: "var(--space-3)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}>
                    {[0.9, 0.75, 0.85, 0.55, 0.7].map((w, i) => (
                      <div key={i} style={{
                        height: 10,
                        borderRadius: 4,
                        background: "var(--fill-tertiary, rgba(255,255,255,0.06))",
                        width: `${w * 100}%`,
                        animation: `shimmer 1.5s ease-in-out ${i * 0.12}s infinite`,
                      }} />
                    ))}
                    <style>{`
                      @keyframes shimmer { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }
                      @keyframes spin { to { transform: rotate(360deg); } }
                    `}</style>
                  </div>
                )}
                {/* Actual streamed response */}
                {agentResponse && (
                  <div
                    ref={responseRef}
                    style={{
                      maxHeight: 180,
                      overflowY: "auto",
                      fontSize: "var(--text-caption1)",
                      fontFamily: "var(--font-mono, monospace)",
                      color: "var(--text-secondary)",
                      background: "var(--code-bg, rgba(0,0,0,0.1))",
                      border: "1px solid var(--code-border, var(--separator))",
                      borderRadius: "var(--radius-sm)",
                      padding: "var(--space-3)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      lineHeight: "var(--leading-relaxed)",
                    }}
                  >
                    {agentResponse}
                    {isStreaming && (
                      <span style={{
                        display: "inline-block",
                        width: 4,
                        height: 12,
                        background: "var(--text-primary)",
                        marginLeft: 2,
                        opacity: 0.6,
                        animation: "blink 1s infinite",
                        verticalAlign: "text-bottom",
                      }} />
                    )}
                  </div>
                )}
              </div>

              {/* Editable JSON textarea */}
              <div>
                <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
                  Pipeline Configuration
                </div>
                <textarea
                  value={pipelineJson}
                  onChange={e => setPipelineJson(e.target.value)}
                  placeholder="JSON will appear here once the agent responds..."
                  spellCheck={false}
                  style={{
                    width: "100%",
                    minHeight: 120,
                    resize: "vertical",
                    fontSize: "var(--text-caption1)",
                    fontFamily: "var(--font-mono, monospace)",
                    color: "var(--text-primary)",
                    background: "var(--fill-secondary)",
                    border: `1px solid ${parseError ? "var(--system-red)" : pipelineJson.trim() && !parseError ? "var(--system-green)" : "var(--separator)"}`,
                    borderRadius: "var(--radius-sm)",
                    padding: "var(--space-3)",
                    outline: "none",
                    lineHeight: "var(--leading-relaxed)",
                  }}
                />
                {parseError && (
                  <div style={{ fontSize: "var(--text-caption2)", color: "var(--system-red)", marginTop: "var(--space-1)" }}>
                    {parseError}
                  </div>
                )}
                {!parseError && pipelineJson.trim() && (
                  <div style={{ fontSize: "var(--text-caption2)", color: "var(--system-green)", marginTop: "var(--space-1)" }}>
                    Valid pipeline configuration
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
                <button
                  onClick={() => { setStep(0); setAgentResponse(""); setPipelineJson(""); setParseError(null) }}
                  className="btn-ghost focus-ring"
                  disabled={isStreaming}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "var(--text-footnote)",
                    fontWeight: "var(--weight-medium)",
                    border: "none",
                    cursor: isStreaming ? "not-allowed" : "pointer",
                    color: "var(--text-secondary)",
                    opacity: isStreaming ? 0.5 : 1,
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={!jsonIsValid || isStreaming || isSaving}
                  className="focus-ring"
                  style={{
                    padding: "8px 20px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "var(--text-footnote)",
                    fontWeight: "var(--weight-semibold)",
                    border: "none",
                    cursor: (!jsonIsValid || isStreaming || isSaving) ? "not-allowed" : "pointer",
                    background: "var(--accent)",
                    color: "#fff",
                    opacity: (!jsonIsValid || isStreaming || isSaving) ? 0.5 : 1,
                  }}
                >
                  {isSaving ? "Saving..." : "Save Pipelines"}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Success ─── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-4) 0" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "var(--text-subheadline)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)", marginBottom: "var(--space-1)" }}>
                  Pipelines saved
                </div>
                <div
                  style={{
                    fontSize: "var(--text-caption1)",
                    fontFamily: "var(--font-mono, monospace)",
                    color: "var(--accent)",
                    background: "var(--code-bg, rgba(0,0,0,0.1))",
                    border: "1px solid var(--code-border, var(--separator))",
                    borderRadius: 6,
                    padding: "6px 14px",
                    display: "inline-block",
                    marginTop: "var(--space-2)",
                  }}
                >
                  $WORKSPACE_PATH/clawport/pipelines.json
                </div>
              </div>
              <button
                onClick={handleClose}
                className="focus-ring"
                style={{
                  padding: "8px 24px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "var(--text-footnote)",
                  fontWeight: "var(--weight-semibold)",
                  border: "none",
                  cursor: "pointer",
                  background: "var(--accent)",
                  color: "#fff",
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
