'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Agent } from '@/lib/types'
import type { KanbanTicket, TicketStatus, TicketPriority, TeamRole } from '@/lib/kanban/types'
import {
  loadTickets,
  saveTickets,
  createTicket,
  updateTicket,
  moveTicket,
  deleteTicket,
  type KanbanStore,
} from '@/lib/kanban/store'
import { useAgentWork } from '@/lib/kanban/useAgentWork'
import { Plus } from 'lucide-react'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { CreateTicketModal } from '@/components/kanban/CreateTicketModal'
import { TicketDetailPanel } from '@/components/kanban/TicketDetailPanel'
import { AgentAvatar } from '@/components/AgentAvatar'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useSettings } from '@/app/settings-provider'

export default function KanbanPage() {
  const { copy } = useSettings()
  const kanbanCopy = copy.kanban
  const [tickets, setTickets] = useState<KanbanStore>({})
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<KanbanTicket | null>(null)
  const [filterAgentId, setFilterAgentId] = useState<string | null>(null)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)

    // Load tickets from localStorage
    const stored = loadTickets()
    setTickets(stored)

    // Load agents from API
    fetch('/api/agents')
      .then((r) => {
        if (!r.ok) throw new Error(kanbanCopy.errors.fetchAgents)
        return r.json()
      })
      .then((a: Agent[]) => setAgents(a))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [kanbanCopy.errors.fetchAgents])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Persist tickets whenever they change
  useEffect(() => {
    if (!loading) {
      saveTickets(tickets)
    }
  }, [tickets, loading])

  // Keep selectedTicket in sync with store
  useEffect(() => {
    if (selectedTicket && tickets[selectedTicket.id]) {
      const current = tickets[selectedTicket.id]
      if (current.updatedAt !== selectedTicket.updatedAt) {
        setSelectedTicket(current)
      }
    }
  }, [tickets, selectedTicket])

  function handleCreateTicket(data: {
    title: string
    description: string
    priority: TicketPriority
    assigneeId: string | null
    assigneeRole: TeamRole | null
  }) {
    setTickets((prev) =>
      createTicket(prev, {
        ...data,
        status: 'backlog',
      }),
    )
  }

  function handleMoveTicket(ticketId: string, status: TicketStatus) {
    // Block manual moves while agent work is in-flight
    const ticket = tickets[ticketId]
    if (ticket && (ticket.workState === 'working' || ticket.workState === 'starting')) {
      return
    }
    setTickets((prev) => moveTicket(prev, ticketId, status))
  }

  function handleDeleteTicket(ticketId: string) {
    setTickets((prev) => deleteTicket(prev, ticketId))
    setSelectedTicket(null)
  }

  const handleUpdateTicket = useCallback(
    (ticketId: string, updates: Partial<KanbanTicket>) => {
      setTickets((prev) => updateTicket(prev, ticketId, updates))
    },
    [],
  )

  const { isWorking } = useAgentWork({
    tickets,
    onUpdateTicket: handleUpdateTicket,
  })

  function handleRetryWork(ticketId: string) {
    setTickets((prev) =>
      updateTicket(prev, ticketId, {
        status: 'todo',
        workState: 'idle',
        workError: null,
        workStartedAt: null,
      }),
    )
  }

  function handleTicketClick(ticket: KanbanTicket) {
    setSelectedTicket(ticket)
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />
  }

  const selectedAgent = selectedTicket?.assigneeId
    ? agents.find((a) => a.id === selectedTicket.assigneeId) ?? null
    : null

  const ticketCount = Object.keys(tickets).length

  // Agents that have at least one ticket assigned
  const assignedAgentIds = new Set(
    Object.values(tickets)
      .map((t) => t.assigneeId)
      .filter(Boolean),
  )
  const assignedAgents = agents.filter((a) => assignedAgentIds.has(a.id))

  return (
    <div className="flex h-full relative" style={{ background: 'var(--bg)' }}>
      {/* Board area */}
      <div className="flex-1 h-full flex flex-col" style={{ minWidth: 0 }}>
        {/* Header */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            borderBottom: '1px solid var(--separator)',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 'var(--text-title2)',
                fontWeight: 'var(--weight-bold)',
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '-0.3px',
              }}
            >
              {kanbanCopy.pageTitle}
            </h1>
            <p
              style={{
                fontSize: 'var(--text-caption1)',
                color: 'var(--text-tertiary)',
                margin: '2px 0 0',
              }}
            >
              {kanbanCopy.ticketCount(ticketCount)}
            </p>
          </div>

          <button
            onClick={() => setCreateOpen(true)}
            className="btn-primary focus-ring btn-scale"
            style={{
              borderRadius: 'var(--radius-md)',
              padding: '8px 16px',
              fontSize: 'var(--text-footnote)',
              fontWeight: 'var(--weight-semibold)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <Plus size={16} />
            {kanbanCopy.newTicket}
          </button>
        </div>

        {/* Agent filter bar */}
        {assignedAgents.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-5)',
              overflowX: 'auto',
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setFilterAgentId(null)}
              className="focus-ring"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                fontSize: 'var(--text-caption1)',
                fontWeight: 600,
                cursor: 'pointer',
                background: filterAgentId === null ? 'var(--accent)' : 'var(--fill-tertiary)',
                color: filterAgentId === null ? 'white' : 'var(--text-secondary)',
                flexShrink: 0,
              }}
            >
              {kanbanCopy.allAgents}
            </button>
            {assignedAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() =>
                  setFilterAgentId(filterAgentId === agent.id ? null : agent.id)
                }
                className="focus-ring"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: '4px 12px 4px 4px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  fontSize: 'var(--text-caption1)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background:
                    filterAgentId === agent.id
                      ? `${agent.color}30`
                      : 'var(--fill-tertiary)',
                  color:
                    filterAgentId === agent.id
                      ? agent.color
                      : 'var(--text-secondary)',
                  flexShrink: 0,
                }}
              >
                <AgentAvatar agent={agent} size={20} borderRadius={10} />
                {agent.name}
              </button>
            ))}
          </div>
        )}

        {/* Board */}
        <div style={{ flex: 1, padding: '0 var(--space-3)', minHeight: 0 }}>
          {loading ? (
            <div
              className="flex gap-3 h-full"
              style={{ padding: 'var(--space-4) 0' }}
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ flex: '1 0 200px' }}>
                  <Skeleton
                    width="100%"
                    height="100%"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <KanbanBoard
              tickets={tickets}
              agents={agents}
              onTicketClick={handleTicketClick}
              onMoveTicket={handleMoveTicket}
              onCreateTicket={() => setCreateOpen(true)}
              isWorking={isWorking}
              filterAgentId={filterAgentId}
            />
          )}
        </div>
      </div>

      {/* Mobile backdrop */}
      {selectedTicket && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSelectedTicket(null)}
        />
      )}

      {/* Detail panel */}
      {selectedTicket && (
        <TicketDetailPanel
          ticket={selectedTicket}
          agent={selectedAgent}
          onClose={() => setSelectedTicket(null)}
          onStatusChange={(status) => handleMoveTicket(selectedTicket.id, status)}
          onDelete={() => handleDeleteTicket(selectedTicket.id)}
          onRetryWork={() => handleRetryWork(selectedTicket.id)}
        />
      )}

      {/* Create ticket modal */}
      <CreateTicketModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        agents={agents}
        onSubmit={handleCreateTicket}
      />
    </div>
  )
}
