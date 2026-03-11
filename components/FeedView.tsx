"use client"

import { useState, useRef, useCallback } from "react"
import type { Agent, CronJob } from "@/lib/types"
import { AgentAvatar } from "@/components/AgentAvatar"
import { useSettings } from "@/app/settings-provider"

interface FeedViewProps {
  agents: Agent[]
  crons: CronJob[]
  selectedId: string | null
  onSelect: (agent: Agent) => void
}

type Filter = "all" | "error" | "ok"

function relativeTime(
  dateStr: string,
  labels: {
    justNow: string
    minutesAgo: (count: number) => string
    hoursAgo: (count: number) => string
    daysAgo: (count: number) => string
    yesterday: string
  },
): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  if (isNaN(then)) return dateStr
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return labels.justNow
  if (mins < 60) return labels.minutesAgo(mins)
  const hours = Math.floor(mins / 60)
  if (hours < 24) return labels.hoursAgo(hours)
  const days = Math.floor(hours / 24)
  if (days === 1) return labels.yesterday
  if (days < 7) return labels.daysAgo(days)
  return new Date(dateStr).toLocaleDateString()
}

function StatusBadge({ status }: { status: CronJob["status"] }) {
  const { copy } = useSettings()
  const feedCopy = copy.feed
  const bg =
    status === "ok"
      ? "color-mix(in srgb, var(--system-green) 15%, transparent)"
      : status === "error"
        ? "color-mix(in srgb, var(--system-red) 15%, transparent)"
        : "var(--fill-tertiary)"
  const color =
    status === "ok"
      ? "var(--system-green)"
      : status === "error"
        ? "var(--system-red)"
        : "var(--text-tertiary)"
  const label = status === "ok" ? feedCopy.status.healthy : status

  return (
    <span
      style={{
        fontSize: "var(--text-caption2)",
        fontWeight: "var(--weight-semibold)",
        color,
        background: bg,
        padding: "2px 8px",
        borderRadius: 10,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
      }}
    >
      {label}
    </span>
  )
}

function StatCard({
  value,
  label,
  color,
  icon,
}: {
  value: number
  label: string
  color: string
  icon: React.ReactNode
}) {
  return (
    <div
      style={{
        flex: 1,
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3) var(--space-4)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: "var(--text-title3)",
            fontWeight: "var(--weight-bold)",
            color,
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: "var(--text-caption2)",
            color: "var(--text-tertiary)",
            marginTop: 2,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  )
}

export function FeedView({ agents, crons, selectedId, onSelect }: FeedViewProps) {
  const { copy } = useSettings()
  const feedCopy = copy.feed
  const [filter, setFilter] = useState<Filter>("all")
  const pillsRef = useRef<HTMLDivElement>(null)
  const pills: { key: Filter; label: string; dotColor: string }[] = [
    { key: "all", label: feedCopy.pills.all, dotColor: "var(--text-primary)" },
    { key: "ok", label: feedCopy.pills.ok, dotColor: "var(--system-green)" },
    { key: "error", label: feedCopy.pills.error, dotColor: "var(--system-red)" },
  ]

  const agentMap = new Map(agents.map((a) => [a.id, a]))

  const counts = {
    all: crons.length,
    ok: crons.filter((c) => c.status === "ok").length,
    error: crons.filter((c) => c.status === "error").length,
  }
  const idleCount = crons.filter((c) => c.status === "idle").length

  const filtered = crons
    .filter((c) => {
      if (filter === "all") return true
      return c.status === filter
    })
    .sort((a, b) => {
      if (a.status === "error" && b.status !== "error") return -1
      if (b.status === "error" && a.status !== "error") return 1
      if (a.lastRun && b.lastRun) return new Date(b.lastRun).getTime() - new Date(a.lastRun).getTime()
      if (a.lastRun && !b.lastRun) return -1
      if (!a.lastRun && b.lastRun) return 1
      return 0
    })

  const handlePillKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
      e.preventDefault()
      const pills = pillsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      if (!pills) return
      const idx = Array.from(pills).findIndex((p) => p.getAttribute("aria-selected") === "true")
      const next = e.key === "ArrowRight" ? (idx + 1) % pills.length : (idx - 1 + pills.length) % pills.length
      pills[next].focus()
      pills[next].click()
    },
    [],
  )

  return (
    <div
      className="h-full"
      style={{
        overflowY: "auto",
        padding: "var(--space-6)",
        paddingTop: 52,
      }}
    >
      {/* Stat cards row */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          marginBottom: "var(--space-5)",
        }}
      >
        <StatCard
          value={counts.all}
          label={feedCopy.statCards.totalCrons}
          color="var(--text-primary)"
          icon={
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="var(--text-secondary)" strokeWidth="1.2" />
              <polyline points="8 4.5 8 8 10.5 10" stroke="var(--text-secondary)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <StatCard
          value={counts.ok}
          label={feedCopy.statCards.healthy}
          color="var(--system-green)"
          icon={
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="var(--system-green)" strokeWidth="1.2" />
              <polyline points="5 8 7 10 11 6" stroke="var(--system-green)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <StatCard
          value={counts.error}
          label={feedCopy.statCards.errors}
          color={counts.error > 0 ? "var(--system-red)" : "var(--text-tertiary)"}
          icon={
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke={counts.error > 0 ? "var(--system-red)" : "var(--text-tertiary)"} strokeWidth="1.2" />
              <line x1="8" y1="5" x2="8" y2="8.5" stroke={counts.error > 0 ? "var(--system-red)" : "var(--text-tertiary)"} strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="8" cy="10.5" r="0.6" fill={counts.error > 0 ? "var(--system-red)" : "var(--text-tertiary)"} />
            </svg>
          }
        />
        <StatCard
          value={idleCount}
          label={feedCopy.statCards.idle}
          color="var(--text-tertiary)"
          icon={
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="var(--text-tertiary)" strokeWidth="1.2" />
              <line x1="5.5" y1="8" x2="10.5" y2="8" stroke="var(--text-tertiary)" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          }
        />
      </div>

      {/* Filter pills */}
      <div
        ref={pillsRef}
        role="tablist"
        onKeyDown={handlePillKeyDown}
        style={{
          display: "flex",
          gap: "var(--space-2)",
          marginBottom: "var(--space-4)",
        }}
      >
        {pills.map((pill) => {
          const isActive = filter === pill.key
          return (
            <button
              key={pill.key}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setFilter(pill.key)}
              className="focus-ring"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                borderRadius: 20,
                padding: "6px 14px",
                fontSize: "var(--text-footnote)",
                fontWeight: "var(--weight-medium)",
                border: "none",
                cursor: "pointer",
                transition: "all 200ms var(--ease-smooth)",
                ...(isActive
                  ? {
                      background: "var(--accent-fill)",
                      color: "var(--accent)",
                      boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent)",
                    }
                  : {
                      background: "var(--fill-secondary)",
                      color: "var(--text-primary)",
                    }),
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: pill.dotColor,
                  display: "inline-block",
                }}
                className={pill.key === "error" && counts.error > 0 ? "animate-error-pulse" : ""}
              />
              <span>{pill.label}</span>
              <span
                style={{
                  fontWeight: "var(--weight-semibold)",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {counts[pill.key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Feed entries */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "var(--space-16) var(--space-4)",
            color: "var(--text-tertiary)",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 16 16"
            fill="none"
            style={{ margin: "0 auto var(--space-3)" }}
          >
            <circle cx="8" cy="8" r="6.5" stroke="var(--fill-tertiary)" strokeWidth="1.2" />
            <polyline points="8 4.5 8 8 10.5 10" stroke="var(--fill-tertiary)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: "var(--text-body)", fontWeight: "var(--weight-medium)" }}>
            {filter === "all" ? feedCopy.empty.allTitle : feedCopy.empty.filteredTitle(filter)}
          </div>
          <div style={{ fontSize: "var(--text-caption1)", marginTop: "var(--space-1)" }}>
            {filter !== "all" ? feedCopy.empty.tryFilter : feedCopy.empty.noCronsYet}
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "var(--bg-secondary)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--separator)",
            overflow: "hidden",
          }}
        >
          {filtered.map((cron, idx) => {
            const agent = cron.agentId ? agentMap.get(cron.agentId) : null
            const isSelected = agent ? selectedId === agent.id : false

            return (
              <button
                key={cron.id}
                className="hover-bg focus-ring"
                onClick={() => agent && onSelect(agent)}
                disabled={!agent}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-3) var(--space-4)",
                  width: "100%",
                  background: isSelected
                    ? "var(--fill-secondary)"
                    : "transparent",
                  border: "none",
                  borderTop: idx > 0 ? "1px solid var(--separator)" : undefined,
                  cursor: agent ? "pointer" : "default",
                  textAlign: "left",
                  transition: "background 150ms var(--ease-smooth)",
                }}
              >
                {/* Agent avatar */}
                {agent ? (
                  <AgentAvatar
                    agent={agent}
                    size={34}
                    borderRadius={9}
                    style={{ border: `1px solid ${agent.color}30` }}
                  />
                ) : (
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: "var(--fill-tertiary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                      flexShrink: 0,
                    }}
                  >
                    &#x2699;&#xFE0F;
                  </span>
                )}

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span
                      style={{
                        fontSize: "var(--text-body)",
                        fontWeight: "var(--weight-semibold)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {agent?.name ?? feedCopy.unknownAgent}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--text-body)",
                        color: "var(--text-secondary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {cron.name}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      marginTop: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--text-caption1)",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {cron.scheduleDescription}
                    </span>
                    {cron.lastRun && (
                      <>
                        <span style={{ color: "var(--text-quaternary)", fontSize: "var(--text-caption2)" }}>&middot;</span>
                        <span
                          style={{
                            fontSize: "var(--text-caption1)",
                            color: "var(--text-quaternary)",
                          }}
                        >
                          {relativeTime(cron.lastRun, feedCopy.relative)}
                        </span>
                      </>
                    )}
                  </div>
                  {cron.lastError && cron.status === "error" && (
                    <div
                      style={{
                        fontSize: "var(--text-caption1)",
                        color: "var(--system-red)",
                        marginTop: 3,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {cron.lastError}
                    </div>
                  )}
                </div>

                {/* Right: status badge + schedule */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    flexShrink: 0,
                  }}
                >
                  <StatusBadge status={cron.status} />
                  <span
                    style={{
                      fontSize: "var(--text-caption1)",
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-tertiary)",
                      background: "var(--fill-quaternary)",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {cron.schedule}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
