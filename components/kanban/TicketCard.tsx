'use client'

import { useState } from 'react'
import type { Agent } from '@/lib/types'
import {
  KanbanTicket,
  PRIORITY_COLORS,
} from '@/lib/kanban/types'
import { AgentAvatar } from '@/components/AgentAvatar'
import { useSettings } from '@/app/settings-provider'

function relativeTime(
  ts: number,
  labels: {
    justNow: string
    minutesAgo: (count: number) => string
    hoursAgo: (count: number) => string
    daysAgo: (count: number) => string
    monthsAgo: (count: number) => string
  },
): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return labels.justNow
  if (mins < 60) return labels.minutesAgo(mins)
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return labels.hoursAgo(hrs)
  const days = Math.floor(hrs / 24)
  if (days < 30) return labels.daysAgo(days)
  return labels.monthsAgo(Math.floor(days / 30))
}

interface TicketCardProps {
  ticket: KanbanTicket
  agent: Agent | null
  onClick: () => void
  isWorking?: boolean
}

export function TicketCard({ ticket, agent, onClick, isWorking }: TicketCardProps) {
  const { copy } = useSettings()
  const kanbanCopy = copy.kanban
  const [isDragging, setIsDragging] = useState(false)

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData('text/plain', ticket.id)
    e.dataTransfer.effectAllowed = 'move'
    setIsDragging(true)
  }

  function handleDragEnd() {
    setIsDragging(false)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onClick}
      className="hover-lift focus-ring"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      style={{
        background: 'var(--material-regular)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.6 : 1,
        border: '1px solid var(--separator)',
        borderLeft: agent ? `3px solid ${agent.color}` : '1px solid var(--separator)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        userSelect: 'none',
        transition: 'opacity 150ms var(--ease-smooth)',
      }}
    >
      {/* Agent row */}
      {agent && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <AgentAvatar agent={agent} size={28} borderRadius={8} />
          <span
            style={{
              fontSize: 'var(--text-caption1)',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              lineHeight: 1.2,
            }}
          >
            {agent.name}
          </span>
        </div>
      )}

      {/* Priority + Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-2)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 'var(--text-caption2)',
            fontWeight: 600,
            color: PRIORITY_COLORS[ticket.priority],
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: PRIORITY_COLORS[ticket.priority],
            }}
          />
          {ticket.priority === 'medium' ? kanbanCopy.priorityLabels.mediumShort : kanbanCopy.priorityLabels[ticket.priority]}
        </span>
        <span
          style={{
            fontSize: 'var(--text-footnote)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {ticket.title}
        </span>
      </div>

      {/* Description preview */}
      {ticket.description && (
        <div
          style={{
            fontSize: 'var(--text-caption2)',
            color: 'var(--text-tertiary)',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {ticket.description}
        </div>
      )}

      {/* Bottom row: role badge + assignee + timestamp */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
        }}
      >
        {ticket.assigneeRole && (
          <span
            style={{
              fontSize: 'var(--text-caption2)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--text-secondary)',
              background: 'var(--fill-tertiary)',
              borderRadius: 'var(--radius-sm)',
              padding: '1px var(--space-2)',
              lineHeight: 1.5,
            }}
          >
            {kanbanCopy.roleLabels[ticket.assigneeRole]}
          </span>
        )}

        <span
          style={{
            fontSize: 'var(--text-caption2)',
            color: 'var(--text-quaternary)',
            marginLeft: 'auto',
          }}
          title={new Date(ticket.createdAt).toLocaleString()}
        >
          {relativeTime(ticket.createdAt, kanbanCopy.relative)}
        </span>
      </div>

      {/* Work state indicators */}
      {(ticket.workState === 'working' || isWorking) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            fontSize: 'var(--text-caption2)',
            fontWeight: 600,
            color: 'var(--system-orange)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--system-orange)',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          {kanbanCopy.working}
        </div>
      )}

      {ticket.workState === 'failed' && (
        <div
          style={{
            fontSize: 'var(--text-caption2)',
            fontWeight: 600,
            color: 'var(--system-red)',
            background: 'color-mix(in srgb, var(--system-red) 10%, transparent)',
            borderRadius: 'var(--radius-sm)',
            padding: '1px var(--space-2)',
          }}
        >
          {kanbanCopy.failed}
        </div>
      )}
    </div>
  )
}
