'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { KanbanColumn as KanbanColumnType, KanbanTicket, TicketStatus } from '@/lib/kanban/types'
import type { Agent } from '@/lib/types'
import { useSettings } from '@/app/settings-provider'

interface KanbanColumnProps {
  column: KanbanColumnType
  tickets: KanbanTicket[]
  agents: Agent[]
  onTicketClick: (ticket: KanbanTicket) => void
  onDrop: (ticketId: string, status: TicketStatus) => void
  onCreateTicket?: () => void
  renderTicket: (ticket: KanbanTicket) => React.ReactNode
}

export function KanbanColumn({
  column,
  tickets,
  agents,
  onTicketClick,
  onDrop,
  onCreateTicket,
  renderTicket,
}: KanbanColumnProps) {
  const { copy } = useSettings()
  const kanbanCopy = copy.kanban
  const [isDragOver, setIsDragOver] = useState(false)
  const columnTitleMap: Record<TicketStatus, string> = {
    backlog: kanbanCopy.columns.backlog,
    todo: kanbanCopy.columns.todo,
    'in-progress': kanbanCopy.columns.inProgress,
    review: kanbanCopy.columns.review,
    done: kanbanCopy.columns.done,
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only set false when leaving the column itself, not a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const ticketId = e.dataTransfer.getData('text/plain')
    if (ticketId) {
      onDrop(ticketId, column.id)
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 280,
        maxWidth: 320,
        flex: '1 0 280px',
        height: '100%',
        borderRadius: 'var(--radius-lg)',
        background: isDragOver ? 'var(--fill-secondary)' : 'var(--fill-tertiary)',
        border: isDragOver
          ? '2px dashed var(--accent)'
          : '2px dashed transparent',
        transition: 'background 200ms var(--ease-smooth), border-color 200ms var(--ease-smooth)',
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            style={{
              fontSize: 'var(--text-footnote)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
            >
            {columnTitleMap[column.id]}
          </span>
          <span
            style={{
              fontSize: 'var(--text-caption2)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--text-tertiary)',
              background: 'var(--fill-secondary)',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px',
              minWidth: 20,
              textAlign: 'center',
            }}
          >
            {tickets.length}
          </span>
        </div>

        {column.id === 'backlog' && onCreateTicket && (
          <button
            onClick={onCreateTicket}
            className="focus-ring hover-bg"
            aria-label={kanbanCopy.createNewTicketAria}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 0,
              transition: 'color 150ms var(--ease-smooth)',
            }}
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* Scrollable ticket area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 var(--space-2) var(--space-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        {tickets.map((ticket) => (
          <div key={ticket.id}>
            {renderTicket(ticket)}
          </div>
        ))}

        {/* Empty state */}
        {tickets.length === 0 && (
          <div
            style={{
              padding: 'var(--space-8) var(--space-4)',
              textAlign: 'center',
              fontSize: 'var(--text-caption1)',
              color: 'var(--text-tertiary)',
            }}
            >
            {kanbanCopy.emptyColumn}
          </div>
        )}
      </div>
    </div>
  )
}
