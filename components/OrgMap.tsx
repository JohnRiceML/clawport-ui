"use client"
import {
  ReactFlow,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  ConnectionLineType,
} from "@xyflow/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import dagre from "@dagrejs/dagre"
import type { Agent, CronJob } from "@/lib/types"
import { buildTeams } from "@/lib/teams"
import { nodeTypes } from "@/components/AgentNode"

interface OrgMapProps {
  agents: Agent[]
  crons: CronJob[]
  selectedId: string | null
  onNodeClick: (agent: Agent) => void
}

type MapLayout = "teams" | "hierarchy"

const NODE_W = 260
const NODE_H = 110

// ── Shared helpers ─────────────────────────────────────────────

function mergeAgentsWithCrons(agents: Agent[], crons: CronJob[]) {
  const withCrons = agents.map((a) => ({
    ...a,
    crons: crons.filter((c) => c.agentId === a.id),
  }))
  return new Map(withCrons.map((a) => [a.id, a]))
}

function buildEdges(
  agents: Agent[],
  selectedId: string | null,
): Edge[] {
  const agentMap = new Map(agents.map((a) => [a.id, a]))
  const selectedAgentIds = new Set<string>()
  if (selectedId) {
    selectedAgentIds.add(selectedId)
    const sel = agentMap.get(selectedId)
    if (sel) {
      if (sel.reportsTo) selectedAgentIds.add(sel.reportsTo)
      sel.directReports.forEach((id) => selectedAgentIds.add(id))
    }
  }

  const edges: Edge[] = []
  for (const agent of agents) {
    for (const childId of agent.directReports) {
      if (!agentMap.has(childId)) continue
      const isHighlighted =
        selectedId && selectedAgentIds.has(agent.id) && selectedAgentIds.has(childId)

      edges.push({
        id: `${agent.id}-${childId}`,
        source: agent.id,
        target: childId,
        type: "smoothstep",
        style: {
          stroke: isHighlighted ? "var(--accent)" : "var(--text-quaternary)",
          strokeWidth: isHighlighted ? 2.5 : 1.5,
          opacity: isHighlighted ? 1 : 0.7,
        },
        animated: !!isHighlighted,
      })
    }
  }
  return edges
}

// ── Dagre helper ───────────────────────────────────────────────

function dagreLayout(
  nodeIds: string[],
  parentChildEdges: [string, string][],
  opts: { rankdir?: string; nodesep?: number; ranksep?: number } = {},
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: opts.rankdir ?? "TB",
    nodesep: opts.nodesep ?? 60,
    ranksep: opts.ranksep ?? 120,
    marginx: 20,
    marginy: 20,
  })

  for (const id of nodeIds) {
    g.setNode(id, { width: NODE_W, height: NODE_H })
  }
  for (const [src, tgt] of parentChildEdges) {
    g.setEdge(src, tgt)
  }

  dagre.layout(g)

  const positions = new Map<string, { x: number; y: number }>()
  for (const id of nodeIds) {
    const n = g.node(id)
    // dagre returns center coords — convert to top-left for React Flow
    positions.set(id, { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2 })
  }
  return positions
}

// ── Team-column layout (dagre per column) ──────────────────────

const COL_GAP = 80
const GROUP_PAD_X = 30
const GROUP_PAD_TOP = 36
const GROUP_PAD_BOTTOM = 24

/** Compute dagre positions for team layout (expensive, depends only on agents/crons structure). */
function computeTeamPositions(
  agents: Agent[],
  crons: CronJob[],
): { nodes: Node[]; agentMap: Map<string, Agent> } {
  const agentMapWithCrons = mergeAgentsWithCrons(agents, crons)
  const { root, teams, soloOps } = buildTeams(agents)
  if (!root) return { nodes: [], agentMap: agentMapWithCrons }

  // Collect all placed IDs
  const placedIds = new Set<string>([root.id])
  for (const t of teams) {
    placedIds.add(t.manager.id)
    t.members.forEach((m) => placedIds.add(m.id))
  }
  soloOps.forEach((a) => placedIds.add(a.id))
  const disconnected = agents.filter((a) => !placedIds.has(a.id))

  // Build columns
  type Column = { label: string; color?: string; agentIds: string[]; edges: [string, string][] }
  const columns: Column[] = []

  const agentMap = new Map(agents.map((a) => [a.id, a]))
  for (const t of teams) {
    const ids = [t.manager.id, ...t.members.map((m) => m.id)]
    const colEdges: [string, string][] = []
    for (const id of ids) {
      const a = agentMap.get(id)
      if (!a) continue
      for (const cid of a.directReports) {
        if (ids.includes(cid)) colEdges.push([id, cid])
      }
    }
    columns.push({ label: `Team ${t.manager.name}`, color: t.manager.color, agentIds: ids, edges: colEdges })
  }
  if (soloOps.length > 0) {
    columns.push({ label: "Solo Ops", agentIds: soloOps.map((a) => a.id), edges: [] })
  }
  if (disconnected.length > 0) {
    columns.push({ label: "Unlinked", agentIds: disconnected.map((a) => a.id), edges: [] })
  }

  // Layout each column with dagre independently, then offset horizontally
  const nodes: Node[] = []
  let cursorX = 0
  const ROOT_Y = 0
  const COLUMNS_TOP = 200

  // Place root centered (we'll adjust x after computing total width)
  const rootAgent = agentMapWithCrons.get(root.id)

  type ColumnResult = { groupNode: Node; childNodes: Node[]; width: number }
  const columnResults: ColumnResult[] = []

  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci]
    const positions = dagreLayout(col.agentIds, col.edges, { nodesep: 40, ranksep: 90 })

    // Compute bounding box of dagre output
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const pos of positions.values()) {
      minX = Math.min(minX, pos.x)
      maxX = Math.max(maxX, pos.x + NODE_W)
      minY = Math.min(minY, pos.y)
      maxY = Math.max(maxY, pos.y + NODE_H)
    }
    const contentW = maxX - minX
    const contentH = maxY - minY
    const groupW = contentW + GROUP_PAD_X * 2
    const groupH = GROUP_PAD_TOP + contentH + GROUP_PAD_BOTTOM

    const groupId = `group-${ci}`
    const groupNode: Node = {
      id: groupId,
      type: "teamGroup",
      data: { label: col.label, color: col.color },
      position: { x: cursorX, y: COLUMNS_TOP },
      style: {
        width: groupW,
        height: groupH,
        background: "var(--fill-quaternary)",
        borderRadius: 12,
        border: "1px solid var(--separator)",
        padding: 0,
      },
      selectable: false,
      draggable: false,
    }

    const childNodes: Node[] = []
    for (const id of col.agentIds) {
      const agent = agentMapWithCrons.get(id)
      const pos = positions.get(id)
      if (!agent || !pos) continue
      childNodes.push({
        id,
        type: "agentNode",
        data: agent as unknown as Record<string, unknown>,
        position: { x: pos.x - minX + GROUP_PAD_X, y: pos.y - minY + GROUP_PAD_TOP },
        parentId: groupId,
        extent: "parent" as const,
      })
    }

    columnResults.push({ groupNode, childNodes, width: groupW })
    cursorX += groupW + COL_GAP
  }

  const totalWidth = cursorX - COL_GAP

  // Root node
  if (rootAgent) {
    nodes.push({
      id: root.id,
      type: "agentNode",
      data: rootAgent as unknown as Record<string, unknown>,
      position: { x: totalWidth / 2 - NODE_W / 2, y: ROOT_Y },
    })
  }

  for (const cr of columnResults) {
    nodes.push(cr.groupNode)
    nodes.push(...cr.childNodes)
  }

  return { nodes, agentMap: agentMapWithCrons }
}

// ── Hierarchy layout (full dagre) ──────────────────────────────

/** Compute dagre positions for hierarchy layout (expensive, depends only on agents/crons structure). */
function computeHierarchyPositions(
  agents: Agent[],
  crons: CronJob[],
): { nodes: Node[]; agentMap: Map<string, Agent> } {
  const agentMapWithCrons = mergeAgentsWithCrons(agents, crons)
  const agentMap = new Map(agents.map((a) => [a.id, a]))

  const allIds = agents.map((a) => a.id)
  const allEdges: [string, string][] = []
  for (const a of agents) {
    for (const cid of a.directReports) {
      if (agentMap.has(cid)) allEdges.push([a.id, cid])
    }
  }

  const positions = dagreLayout(allIds, allEdges, { nodesep: 60, ranksep: 140 })

  const nodes: Node[] = []
  for (const a of agents) {
    const agent = agentMapWithCrons.get(a.id)
    const pos = positions.get(a.id)
    if (!agent || !pos) continue
    nodes.push({
      id: a.id,
      type: "agentNode",
      data: agent as unknown as Record<string, unknown>,
      position: pos,
    })
  }

  return { nodes, agentMap: agentMapWithCrons }
}

/** Apply selection styling to pre-computed nodes/edges (cheap). */
function applySelection(
  positionedNodes: Node[],
  agents: Agent[],
  selectedId: string | null,
): { nodes: Node[]; edges: Edge[] } {
  const nodes = positionedNodes.map((n) => ({
    ...n,
    selected: n.id === selectedId,
  }))
  return { nodes, edges: buildEdges(agents, selectedId) }
}

// ── Component ──────────────────────────────────────────────────

export function OrgMap({ agents, crons, selectedId, onNodeClick }: OrgMapProps) {
  const [layout, setLayout] = useState<MapLayout>("hierarchy")

  // Expensive dagre computation -- only recomputes when agents/crons/layout change
  const positionedNodes = useMemo(() => {
    const compute = layout === "teams" ? computeTeamPositions : computeHierarchyPositions
    return compute(agents, crons).nodes
  }, [agents, crons, layout])

  // Cheap selection styling -- runs on every selectedId change without dagre
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => applySelection(positionedNodes, agents, selectedId),
    [positionedNodes, agents, selectedId],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    const { nodes: n, edges: e } = applySelection(positionedNodes, agents, selectedId)
    setNodes(n)
    setEdges(e)
  }, [positionedNodes, agents, selectedId, setNodes, setEdges])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const agent = agents.find((a) => a.id === node.id)
      if (agent) onNodeClick(agent)
    },
    [agents, onNodeClick],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      connectionLineType={ConnectionLineType.SmoothStep}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Controls
        position="bottom-left"
        style={{ left: 16, bottom: 16 }}
      />

      {/* Layout toggle */}
      <Panel
        position="bottom-center"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: 3,
          borderRadius: "var(--radius-sm)",
          background: "var(--material-regular)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid var(--separator)",
        }}
      >
        {(["teams", "hierarchy"] as const).map((opt) => {
          const isActive = layout === opt
          return (
            <button
              key={opt}
              onClick={() => setLayout(opt)}
              className="focus-ring"
              style={{
                padding: "4px 12px",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-caption1)",
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
                      background: "transparent",
                      color: "var(--text-secondary)",
                    }),
              }}
            >
              {opt === "teams" ? "Teams" : "Hierarchy"}
            </button>
          )
        })}
      </Panel>
    </ReactFlow>
  )
}
