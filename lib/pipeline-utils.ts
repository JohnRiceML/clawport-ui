/**
 * Pure functions extracted from pipeline components for testability.
 * No React or DOM dependencies.
 */

import type { Agent, CronJob } from "@/lib/types"
import type { Pipeline } from "@/lib/cron-pipelines"
import { formatDuration, timeAgo, nextRunLabel } from "@/lib/cron-utils"

/* ─── Node ID parsing ──────────────────────────────────────────── */

/**
 * Extract the job name from a pipeline node ID.
 * Node IDs are formatted as "pipelineName::jobName".
 * Returns null for label nodes or invalid IDs.
 */
export function extractJobNameFromNodeId(nodeId: string): string | null {
  if (!nodeId) return null
  const parts = nodeId.split("::")
  if (parts.length !== 2) return null
  return parts[1] || null
}

/* ─── Pipeline context computation ─────────────────────────────── */

export interface PipelineInput {
  pipeline: string
  from: string
  artifact: string
}

export interface PipelineOutput {
  pipeline: string
  to: string
  artifact: string
}

/**
 * Compute the pipeline inputs and outputs for a given job name.
 */
export function computePipelineContext(
  jobName: string,
  pipelines: Pipeline[],
): { inputs: PipelineInput[]; outputs: PipelineOutput[] } {
  const inputs: PipelineInput[] = []
  const outputs: PipelineOutput[] = []

  for (const p of pipelines) {
    for (const e of p.edges) {
      if (e.to === jobName) {
        inputs.push({ pipeline: p.name, from: e.from, artifact: e.artifact })
      }
      if (e.from === jobName) {
        outputs.push({ pipeline: p.name, to: e.to, artifact: e.artifact })
      }
    }
  }

  return { inputs, outputs }
}

/* ─── Agent chat context builder ───────────────────────────────── */

/**
 * Build a context string for the agent chat panel describing a cron job.
 */
export function buildCronContext(
  jobName: string,
  cron: CronJob | null,
  inputs: { from: string; artifact: string }[],
  outputs: { to: string; artifact: string }[],
): string {
  const parts = [`The operator is asking about the cron job "${jobName}".`]

  if (cron) {
    parts.push(`Status: ${cron.status}`)
    parts.push(`Schedule: ${cron.scheduleDescription || cron.schedule}${cron.timezone ? ` (${cron.timezone})` : ""}`)
    if (cron.lastRun) parts.push(`Last run: ${timeAgo(cron.lastRun)}`)
    if (cron.nextRun) parts.push(`Next run: ${nextRunLabel(cron.nextRun)}`)
    if (cron.lastDurationMs != null) parts.push(`Last duration: ${formatDuration(cron.lastDurationMs)}`)
    if (cron.lastError) parts.push(`Last error: ${cron.lastError}`)
    if (cron.consecutiveErrors > 0) parts.push(`Consecutive errors: ${cron.consecutiveErrors}`)
    if (cron.delivery) {
      parts.push(`Delivery: ${cron.delivery.channel} -> ${cron.delivery.to || "MISSING TARGET"}`)
      if (cron.lastDeliveryStatus) parts.push(`Delivery status: ${cron.lastDeliveryStatus}`)
    }
  }

  if (inputs.length > 0) {
    parts.push(`Pipeline inputs: ${inputs.map(i => `${i.artifact} from ${i.from}`).join(", ")}`)
  }
  if (outputs.length > 0) {
    parts.push(`Pipeline outputs: ${outputs.map(o => `${o.artifact} to ${o.to}`).join(", ")}`)
  }

  parts.push("Answer questions about this specific cron job. Be concise and helpful.")
  return parts.join("\n")
}

/* ─── Health check prompt builder ──────────────────────────────── */

/**
 * Build the AI health check prompt from cron and pipeline data.
 */
export function buildHealthCheckPrompt(crons: CronJob[], pipelines: Pipeline[], agents?: Agent[], availableServices?: string[]): string {
  const agentMap = new Map((agents || []).map(a => [a.id, a.name]))

  const pipelinesSummary = pipelines.map(p => {
    const edgeList = p.edges.map(e => `  ${e.from} --[${e.artifact}]--> ${e.to}`).join("\n")
    return `Pipeline: ${p.name}\n${edgeList}`
  }).join("\n\n")

  const jobsSummary = crons.map(c => {
    const ownerName = c.agentId ? agentMap.get(c.agentId) || `unknown (${c.agentId})` : null
    const parts = [
      `Job: ${c.name}`,
      `  Owner: ${ownerName || "UNOWNED"}`,
      `  Status: ${c.status}`,
      `  Schedule: ${c.scheduleDescription || c.schedule}`,
      c.lastRun ? `  Last run: ${c.lastRun}` : null,
      c.nextRun ? `  Next run: ${c.nextRun}` : null,
      c.lastError ? `  Error: ${c.lastError}` : null,
      c.consecutiveErrors > 0 ? `  Consecutive errors: ${c.consecutiveErrors}` : null,
      c.delivery ? `  Delivery: ${c.delivery.channel} -> ${c.delivery.to || "MISSING TARGET"}` : null,
      c.lastDeliveryStatus ? `  Delivery status: ${c.lastDeliveryStatus}` : null,
    ].filter(Boolean)
    return parts.join("\n")
  }).join("\n\n")

  return `You are analyzing the health of a cron pipeline system. Provide a concise health assessment covering:

1. **Overall Health** - Quick summary of system state
2. **Agent Ownership** - Every job should be owned by an agent. Flag any UNOWNED jobs as a problem -- an agent should be responsible for each job/sequence
3. **Broken Edges** - Any pipeline edges where the source job is errored (data flow is interrupted)
4. **Schedule Gaps** - Any jobs that haven't run recently or are overdue
5. **Missing Deliveries** - Jobs with delivery configured but no target
6. **Recommendations** - Top 2-3 actionable items to improve reliability

Be direct and specific. Use job names and agent names. Keep it under 400 words.
${availableServices && availableServices.length > 0 ? `
## Available Services

The following external services are connected and available for cron jobs to use: ${availableServices.join(', ')}.
If any jobs could benefit from these services but aren't using them, mention it in recommendations.
` : ''}
## Pipelines

${pipelinesSummary || "No pipelines configured"}

## Jobs

${jobsSummary || "No jobs found"}`
}

/* ─── Cron job suggestion prompt builder ───────────────────────── */

/**
 * Build a prompt that suggests new cron jobs based on available services,
 * existing jobs, and agent capabilities.
 */
export function buildCronSuggestionsPrompt(
  crons: CronJob[],
  agents: Agent[],
  availableServices: string[],
): string {
  const existingJobs = crons.map(c => {
    const parts = [c.name, `(${c.scheduleDescription || c.schedule})`]
    if (c.description) parts.push(`-- ${c.description}`)
    if (c.delivery) parts.push(`-> ${c.delivery.channel}`)
    return parts.join(' ')
  }).join('\n')

  const agentList = agents.map(a => {
    const tools = a.tools.length > 0 ? ` [tools: ${a.tools.join(', ')}]` : ''
    return `- ${a.name} (${a.title})${tools}`
  }).join('\n')

  return `You are suggesting new cron jobs for an AI agent system. Analyze what's already running, what services are available, and what agents can do, then suggest useful automations that aren't already covered.

## Connected Services

${availableServices.join(', ')}

## Existing Cron Jobs

${existingJobs || 'No jobs configured yet'}

## Available Agents

${agentList}

Suggest 3-5 new cron jobs that would be valuable. For each suggestion:
- **Job name** (kebab-case, e.g. "daily-email-digest")
- **Schedule** (cron expression + human description)
- **Agent** (which agent should own it)
- **What it does** (1-2 sentences)
- **Services used** (which connected services it leverages)

Focus on practical automations that combine the connected services with agent capabilities. Don't suggest jobs that duplicate existing ones. Be concise.`
}

/* ─── Pipeline layout builder ──────────────────────────────────── */

export interface LayoutNode {
  id: string
  type: string
  data: Record<string, unknown>
  position: { x: number; y: number }
  selectable?: boolean
  draggable?: boolean
  style?: Record<string, unknown>
}

export interface LayoutEdge {
  id: string
  source: string
  target: string
  type: string
  label: string
  labelStyle: Record<string, unknown>
  style: Record<string, unknown>
  animated: boolean
}

/**
 * Build the topological layout of pipeline nodes and edges for React Flow.
 */
export function buildPipelineLayout(
  crons: CronJob[],
  pipelines: Pipeline[],
  agentColorMap: Map<string, string>,
  selectedJob?: string | null,
): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const cronMap = new Map(crons.map(c => [c.name, c]))
  const nodes: LayoutNode[] = []
  const edges: LayoutEdge[] = []

  let groupY = 0

  for (const pipeline of pipelines) {
    // Group label node
    nodes.push({
      id: `label-${pipeline.name}`,
      type: "default",
      data: { label: pipeline.name },
      position: { x: 0, y: groupY },
      selectable: false,
      draggable: false,
      style: {
        background: "transparent",
        border: "none",
        fontSize: 13,
        fontWeight: 700,
        color: "var(--text-secondary)",
        padding: 0,
        width: 200,
      },
    })

    groupY += 36

    // Determine node positions using topological ordering
    const jobNames: string[] = []
    for (const edge of pipeline.edges) {
      if (!jobNames.includes(edge.from)) jobNames.push(edge.from)
      if (!jobNames.includes(edge.to)) jobNames.push(edge.to)
    }

    // Assign columns by dependency depth
    const depth = new Map<string, number>()
    for (const name of jobNames) depth.set(name, 0)
    for (let pass = 0; pass < jobNames.length; pass++) {
      for (const edge of pipeline.edges) {
        const fromD = depth.get(edge.from) || 0
        const toD = depth.get(edge.to) || 0
        if (fromD + 1 > toD) depth.set(edge.to, fromD + 1)
      }
    }

    // Group by depth for vertical stacking
    const byDepth = new Map<number, string[]>()
    for (const [name, d] of depth) {
      const arr = byDepth.get(d) || []
      arr.push(name)
      byDepth.set(d, arr)
    }

    const maxDepth = Math.max(...Array.from(byDepth.keys()), 0)
    const colSpacing = 280
    const rowSpacing = 80

    for (let d = 0; d <= maxDepth; d++) {
      const namesAtDepth = byDepth.get(d) || []
      namesAtDepth.forEach((name, i) => {
        const cron = cronMap.get(name)
        const nodeId = `${pipeline.name}::${name}`

        nodes.push({
          id: nodeId,
          type: "cronPipelineNode",
          data: {
            name,
            schedule: cron?.scheduleDescription || "\u2014",
            status: cron?.status || "idle",
            deliveryTo: cron?.delivery?.to || null,
            color: agentColorMap.get(cron?.agentId || "") || "var(--text-secondary)",
            selected: selectedJob === name,
          } as Record<string, unknown>,
          position: { x: d * colSpacing + 20, y: groupY + i * rowSpacing },
        })
      })
    }

    // Edges
    for (let ei = 0; ei < pipeline.edges.length; ei++) {
      const pEdge = pipeline.edges[ei]
      const sourceId = `${pipeline.name}::${pEdge.from}`
      const targetId = `${pipeline.name}::${pEdge.to}`
      const sourceCron = cronMap.get(pEdge.from)
      const isErrored = sourceCron?.status === "error"

      edges.push({
        id: `${sourceId}->${targetId}::${ei}`,
        source: sourceId,
        target: targetId,
        type: "smoothstep",
        label: pEdge.artifact,
        labelStyle: { fontSize: 9, fill: "var(--text-muted)" },
        style: {
          stroke: isErrored ? "#ef4444" : "var(--accent, #6366f1)",
          strokeWidth: 1.5,
          strokeDasharray: isErrored ? "6 4" : undefined,
          opacity: isErrored ? 0.7 : 1,
        },
        animated: !isErrored,
      })
    }

    // Advance Y for next group
    const maxNodesPerCol = Math.max(
      ...Array.from(byDepth.values()).map(arr => arr.length),
      1
    )
    groupY += maxNodesPerCol * rowSpacing + 40
  }

  return { nodes, edges }
}
