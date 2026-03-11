"use client"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import type { Agent, CronJob } from "@/lib/types"
import { AgentAvatar } from "@/components/AgentAvatar"
import { useSettings } from "@/app/settings-provider"
import { localizeAgentDescription } from "@/lib/i18n"

type AgentNodeData = Agent & { crons: CronJob[] } & Record<string, unknown>

export function AgentNode({ data, selected }: NodeProps) {
  const { copy, resolvedLocale } = useSettings()
  const orgMapCopy = copy.orgMap
  const agent = data as AgentNodeData
  const localizedDescription = localizeAgentDescription(agent.id, agent.description, resolvedLocale)
  const hasCrons = agent.crons && agent.crons.length > 0
  const hasErrors = hasCrons && agent.crons.some((c: CronJob) => c.status === "error")
  const cronCount = hasCrons ? agent.crons.length : 0
  const toolCount = agent.tools?.length ?? 0
  const reportCount = agent.directReports?.length ?? 0

  return (
    <div
      className={`hover-lift focus-ring${selected ? " node-selected" : ""}`}
      title={agent.title}
      style={{
        background: "var(--material-regular)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderRadius: "var(--radius-md)",
        borderTop: `2px solid ${agent.color}`,
        borderRight: `1px solid ${selected ? "var(--accent)" : "var(--separator)"}`,
        borderBottom: `1px solid ${selected ? "var(--accent)" : "var(--separator)"}`,
        borderLeft: `1px solid ${selected ? "var(--accent)" : "var(--separator)"}`,
        padding: "var(--space-3) var(--space-4)",
        width: 260,
        cursor: "pointer",
        position: "relative",
        boxShadow: selected ? "0 0 0 1px var(--accent), var(--shadow-card)" : "var(--shadow-card)",
      }}
    >
      {/* Emoji + Name + Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          marginBottom: "var(--space-1)",
        }}
      >
        <AgentAvatar agent={agent} size={30} borderRadius={8} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "var(--text-body)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: "var(--leading-tight)",
            }}
          >
            {agent.name}
          </div>
          <div
            style={{
              fontSize: "var(--text-caption2)",
              color: agent.color,
              opacity: 0.85,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: 1,
            }}
          >
            {agent.title}
          </div>
        </div>
      </div>

      {/* Description — allow 2 lines */}
      {localizedDescription && (
        <div
          style={{
            fontSize: "var(--text-caption2)",
            lineHeight: 1.4,
            color: "var(--text-tertiary)",
            marginTop: "var(--space-1)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {localizedDescription}
        </div>
      )}

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          marginTop: "var(--space-2)",
          flexWrap: "wrap",
        }}
      >
        {toolCount > 0 && (
          <span
            style={{
              fontSize: "var(--text-caption2)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--accent)",
              background: "var(--accent-fill)",
              padding: "1px 7px",
              borderRadius: 10,
            }}
          >
            {orgMapCopy.badges.tools(toolCount)}
          </span>
        )}
        {reportCount > 0 && (
          <span
            style={{
              fontSize: "var(--text-caption2)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-secondary)",
              background: "var(--fill-secondary)",
              padding: "1px 7px",
              borderRadius: 10,
            }}
          >
            {orgMapCopy.badges.reports(reportCount)}
          </span>
        )}
        {agent.model && (
          <span
            style={{
              fontSize: "var(--text-caption2)",
              fontWeight: "var(--weight-medium)",
              color: "var(--text-tertiary)",
              background: "var(--fill-tertiary)",
              padding: "1px 7px",
              borderRadius: 10,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 120,
            }}
          >
            {agent.model.split("/").pop()}
          </span>
        )}
        {hasCrons && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: "var(--text-caption2)",
              fontWeight: "var(--weight-medium)",
              color: hasErrors ? "var(--system-red)" : "var(--system-green)",
              background: hasErrors ? "var(--system-red)10" : "var(--system-green)10",
              padding: "1px 7px",
              borderRadius: 10,
            }}
          >
            <span
              className={hasErrors ? "animate-error-pulse" : ""}
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: hasErrors ? "var(--system-red)" : "var(--system-green)",
              }}
            />
            {orgMapCopy.badges.crons(cronCount)}
          </span>
        )}
      </div>

      {/* Handles - invisible */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}

function TeamGroupNode({ data }: NodeProps) {
  const { label, color } = data as { label: string; color?: string } & Record<string, unknown>
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: "var(--text-caption2)",
          fontWeight: "var(--weight-semibold)",
          letterSpacing: "var(--tracking-wide)",
          textTransform: "uppercase",
          color: color ?? "var(--text-tertiary)",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {label}
      </div>
    </div>
  )
}

export const nodeTypes = { agentNode: AgentNode, teamGroup: TeamGroupNode }
