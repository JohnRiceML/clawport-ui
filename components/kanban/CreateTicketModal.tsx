'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus } from 'lucide-react'
import type { Agent } from '@/lib/types'
import type { TicketPriority, TeamRole, RelevantFile } from '@/lib/kanban/types'
import { PRIORITY_COLORS, ROLE_LABELS } from '@/lib/kanban/types'
import { AgentPicker } from '@/components/kanban/AgentPicker'
import { DriveFilePicker } from '@/components/kanban/DriveFilePicker'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface CreateTicketModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: Agent[]
  onSubmit: (ticket: {
    title: string
    description: string
    useSessionMemory: boolean
    relevantFiles: RelevantFile[]
    priority: TicketPriority
    assigneeId: string | null
    assigneeRole: TeamRole | null
  }) => void
}

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high']
const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Med',
  high: 'High',
}

const ROLES: TeamRole[] = ['lead-dev', 'ux-ui', 'qa']

const initialState = {
  title: '',
  description: '',
  useSessionMemory: false,
  relevantFiles: [] as RelevantFile[],
  priority: 'medium' as TicketPriority,
  assigneeId: '' as string,
  assigneeRole: null as TeamRole | null,
}

export function CreateTicketModal({
  open,
  onOpenChange,
  agents,
  onSubmit,
}: CreateTicketModalProps) {
  const [form, setForm] = useState(initialState)
  const [driveEnabled, setDriveEnabled] = useState(false)

  useEffect(() => {
    fetch('/api/export/google-doc')
      .then((res) => res.json())
      .then((data) => setDriveEnabled(data.enabled === true))
      .catch(() => {})
  }, [])

  const resetForm = useCallback(() => {
    setForm(initialState)
  }, [])

  function handleOpenChange(next: boolean) {
    if (!next) resetForm()
    onOpenChange(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return

    onSubmit({
      title: form.title.trim(),
      description: form.description.trim(),
      useSessionMemory: form.useSessionMemory,
      relevantFiles: form.relevantFiles,
      priority: form.priority,
      assigneeId: form.assigneeId || null,
      assigneeRole: form.assigneeId ? form.assigneeRole : null,
    })

    resetForm()
    onOpenChange(false)
  }

  const selectedAgent = agents.find((a) => a.id === form.assigneeId) ?? null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--separator)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
          maxWidth: 480,
        }}
      >
        <DialogHeader>
          <DialogTitle
            style={{
              fontSize: 'var(--text-title3)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--text-primary)',
            }}
          >
            Create Ticket
          </DialogTitle>
          <DialogDescription
            style={{
              fontSize: 'var(--text-caption1)',
              color: 'var(--text-tertiary)',
            }}
          >
            Add a new ticket to the backlog.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <label
              htmlFor="ticket-title"
              style={{
                fontSize: 'var(--text-caption1)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-secondary)',
              }}
            >
              Title
            </label>
            <input
              id="ticket-title"
              type="text"
              className="apple-input focus-ring"
              placeholder="What needs to be done?"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              autoFocus
              style={{
                fontSize: 'var(--text-body)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <label
              htmlFor="ticket-description"
              style={{
                fontSize: 'var(--text-caption1)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-secondary)',
              }}
            >
              Description
            </label>
            <textarea
              id="ticket-description"
              className="apple-input focus-ring"
              placeholder="Add details..."
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              style={{
                fontSize: 'var(--text-body)',
                color: 'var(--text-primary)',
                resize: 'vertical',
                minHeight: 72,
              }}
            />
          </div>

          {/* Relevant Files (Google Drive) */}
          {driveEnabled && (
            <DriveFilePicker
              value={form.relevantFiles}
              onChange={(files) => setForm((f) => ({ ...f, relevantFiles: files }))}
            />
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              alignItems: 'start',
              gap: 'var(--space-3)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--separator)',
                background: 'var(--fill-quaternary)',
                cursor: 'pointer',
                minWidth: 0,
              }}
            >
              <input
                type="checkbox"
                checked={form.useSessionMemory}
                onChange={(e) => setForm((f) => ({ ...f, useSessionMemory: e.target.checked }))}
                style={{ marginTop: 2 }}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 'var(--text-caption1)',
                    fontWeight: 'var(--weight-medium)',
                    color: 'var(--text-primary)',
                  }}
                >
                  Allow session memory
                </span>
                <span
                  style={{
                    fontSize: 'var(--text-caption2)',
                    color: 'var(--text-tertiary)',
                    lineHeight: 1.4,
                  }}
                >
                  Let the agent rely on prior hidden session context for continuation tickets.
                </span>
              </span>
            </label>

            {/* Priority */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 'var(--space-2)',
                paddingTop: 2,
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-caption1)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-secondary)',
                }}
              >
                Priority
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
                {PRIORITIES.map((p) => {
                  const isSelected = form.priority === p
                  return (
                    <button
                      key={p}
                      type="button"
                      className="focus-ring"
                      onClick={() => setForm((f) => ({ ...f, priority: p }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--space-1)',
                        minWidth: 74,
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected
                          ? `2px solid ${PRIORITY_COLORS[p]}`
                          : '2px solid var(--separator)',
                        background: isSelected ? 'var(--fill-tertiary)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: 'var(--text-caption1)',
                        fontWeight: 'var(--weight-medium)',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        transition: 'all 150ms var(--ease-smooth)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: PRIORITY_COLORS[p],
                          flexShrink: 0,
                        }}
                      />
                      {PRIORITY_LABELS[p]}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Assignee */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <label
              style={{
                fontSize: 'var(--text-caption1)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-secondary)',
              }}
            >
              Assignee
            </label>
            <AgentPicker
              agents={agents}
              value={form.assigneeId}
              onChange={(agentId) =>
                setForm((f) => ({
                  ...f,
                  assigneeId: agentId,
                  assigneeRole: agentId ? f.assigneeRole : null,
                }))
              }
            />
          </div>

          {/* Role (only shown when assignee is selected) */}
          {form.assigneeId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span
                style={{
                  fontSize: 'var(--text-caption1)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-secondary)',
                }}
              >
                Role
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {ROLES.map((r) => {
                  const isSelected = form.assigneeRole === r
                  return (
                    <button
                      key={r}
                      type="button"
                      className="focus-ring"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          assigneeRole: f.assigneeRole === r ? null : r,
                        }))
                      }
                      style={{
                        flex: 1,
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected
                          ? '2px solid var(--accent)'
                          : '2px solid var(--separator)',
                        background: isSelected ? 'var(--accent-fill)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: 'var(--text-caption2)',
                        fontWeight: 'var(--weight-medium)',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        transition: 'all 150ms var(--ease-smooth)',
                        textAlign: 'center',
                      }}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="btn-primary focus-ring"
            disabled={!form.title.trim()}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: '12px 20px',
              width: '100%',
              fontSize: 'var(--text-body)',
              fontWeight: 'var(--weight-semibold)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              marginTop: 'var(--space-2)',
            }}
          >
            <Plus size={16} />
            Create Ticket
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
