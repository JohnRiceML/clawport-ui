'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import type { Agent } from '@/lib/types'
import type { KanbanTicket, RelevantFile, TicketStatus, TicketPriority, TeamRole } from '@/lib/kanban/types'
import { PRIORITY_COLORS, ROLE_LABELS, COLUMNS } from '@/lib/kanban/types'
import { AgentAvatar } from '@/components/AgentAvatar'
import { AgentPicker } from '@/components/kanban/AgentPicker'
import { DriveFilePicker } from '@/components/kanban/DriveFilePicker'
import { generateId } from '@/lib/id'
import { exportAsPdf, exportAsDocx } from '@/lib/export-markdown'
import { humanizeKanbanChatError, readKanbanChatErrorResponse } from '@/lib/kanban/chat-errors'
import { formatMessage } from '@/lib/format-message'

/* ── Chat message type (local to kanban) ─────────────── */

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
}

/* ── Main component ──────────────────────────────────── */

interface TicketDetailPanelProps {
  ticket: KanbanTicket
  agent: Agent | null
  agents: Agent[]
  onClose: () => void
  onStatusChange: (status: TicketStatus) => void
  onUpdateTicket: (updates: Partial<KanbanTicket>) => void
  onDelete: () => void
  onRetryWork?: () => void
}

export function TicketDetailPanel({
  ticket,
  agent,
  agents,
  onClose,
  onStatusChange,
  onUpdateTicket,
  onDelete,
  onRetryWork,
}: TicketDetailPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [titleDraft, setTitleDraft] = useState(ticket.title)
  const [isStreaming, setIsStreaming] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [mdModalContent, setMdModalContent] = useState<string | null>(null)
  const [googleDriveEnabled, setGoogleDriveEnabled] = useState(false)
  const [googleDocExporting, setGoogleDocExporting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const assigneeEditable = ticket.status === 'backlog' || ticket.status === 'todo'
  const roleOptions: TeamRole[] = ['lead-dev', 'ux-ui', 'qa']

  const updateAssignee = useCallback((agentId: string) => {
    onUpdateTicket({
      assigneeId: agentId || null,
      assigneeRole: agentId ? ticket.assigneeRole : null,
    })
  }, [onUpdateTicket, ticket.assigneeRole])

  useEffect(() => {
    setTitleDraft(ticket.title)
  }, [ticket.id, ticket.title])

  // Check Google Drive integration status
  useEffect(() => {
    fetch('/api/export/google-doc')
      .then(res => res.ok ? res.json() : { enabled: false })
      .then((data: { enabled: boolean }) => setGoogleDriveEnabled(data.enabled))
      .catch(() => setGoogleDriveEnabled(false))
  }, [])

  // Load messages from API on mount / ticket change
  useEffect(() => {
    let cancelled = false
    fetch(`/api/kanban/chat-history/${ticket.id}`)
      .then(res => res.ok ? res.json() : [])
      .then((msgs: ChatMessage[]) => {
        if (cancelled) return
        if (msgs.length > 0) {
          setMessages(msgs)
          return
        }
        if (ticket.workResult) {
          setMessages([
            {
              id: `work-result-${ticket.id}`,
              role: 'assistant',
              content: ticket.workResult,
              timestamp: ticket.updatedAt || Date.now(),
            },
          ])
          return
        }
        setMessages([])
      })
      .catch(() => { if (!cancelled) setMessages([]) })
    return () => { cancelled = true }
  }, [ticket.id, ticket.workResult, ticket.updatedAt])

  useEffect(() => {
    const workResult = ticket.workResult
    if (!workResult) return
    const workResultNorm = workResult.trim().toLowerCase()
    setMessages(prev => {
      // Skip if any assistant message already contains this work result
      // (may have been loaded from persisted history with a different ID)
      if (prev.some(msg =>
        msg.role === 'assistant' && (
          msg.id === `work-result-${ticket.id}` ||
          msg.content.trim().toLowerCase() === workResultNorm
        )
      )) {
        return prev
      }
      return [
        ...prev,
        {
          id: `work-result-${ticket.id}`,
          role: 'assistant',
          content: workResult,
          timestamp: ticket.updatedAt || Date.now(),
        },
      ]
    })
  }, [ticket.id, ticket.workResult, ticket.updatedAt])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Escape key to close (modal first, then panel)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (mdModalContent) {
          setMdModalContent(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, mdModalContent])

  // Focus close button on mount
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  const openMarkdownDocument = useCallback((content: string) => {
    if (!content) return
    setMdModalContent(content)
  }, [])

  const exportAsGoogleDoc = useCallback(async (content: string) => {
    if (!content || googleDocExporting) return
    setGoogleDocExporting(true)
    try {
      const res = await fetch('/api/export/google-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${ticket.title || 'Response'} — ${new Date().toLocaleDateString()}`,
          markdown: content,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      } else {
        console.error('Google Doc export failed:', data.error)
      }
    } catch (err) {
      console.error('Google Doc export failed:', err)
    } finally {
      setGoogleDocExporting(false)
    }
  }, [googleDocExporting, ticket.title])

  /* ── Send message + stream response ─────────────── */

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming || !agent) return

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    const assistantMsgId = generateId()
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setIsStreaming(true)

    // Build API messages (just role + content)
    const allMessages = [...messages, userMsg]
    const apiMessages = allMessages.map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch(`/api/kanban/chat/${agent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          ticket: {
            title: ticket.title,
            description: ticket.description,
            useSessionMemory: ticket.useSessionMemory,
            relevantFiles: ticket.relevantFiles,
            status: ticket.status,
            priority: ticket.priority,
            assigneeRole: ticket.assigneeRole,
            workResult: ticket.workResult,
          },
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error(await readKanbanChatErrorResponse(res))
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            let chunk: { content?: string; error?: string } | null = null
            try {
              chunk = JSON.parse(line.slice(6))
            } catch { /* skip malformed chunks */ }

            if (chunk?.error) {
              throw new Error(humanizeKanbanChatError(chunk.error))
            }

            if (chunk?.content) {
              fullContent += chunk.content
              const captured = fullContent
              setMessages(prev =>
                prev.map(m => m.id === assistantMsgId
                  ? { ...m, content: captured, isStreaming: true }
                  : m
                )
              )
            }
          }
        }
      }

      if (!fullContent.trim()) {
        throw new Error('Agent runtime did not return a response.')
      }

      const finalContent = fullContent
      setMessages(prev =>
        prev.map(m => m.id === assistantMsgId
          ? { ...m, content: finalContent, isStreaming: false }
          : m
        )
      )

      // Persist user + assistant messages to filesystem
      const completedAssistant = { ...assistantMsg, content: finalContent, isStreaming: undefined, timestamp: Date.now() }
      fetch(`/api/kanban/chat-history/${ticket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [userMsg, completedAssistant] }),
      }).catch(() => { /* persist best-effort */ })
    } catch (err) {
      const errorContent = humanizeKanbanChatError(err)
      setMessages(prev =>
        prev.map(m => m.id === assistantMsgId
          ? { ...m, content: errorContent, isStreaming: false }
          : m
        )
      )

      // Persist user message + error response
      const errorAssistant = { ...assistantMsg, content: errorContent, isStreaming: undefined, timestamp: Date.now() }
      fetch(`/api/kanban/chat-history/${ticket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [userMsg, errorAssistant] }),
      }).catch(() => { /* persist best-effort */ })
    } finally {
      setIsStreaming(false)
      textareaRef.current?.focus()
    }
  }, [input, isStreaming, agent, messages, ticket])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handleDelete() {
    if (window.confirm(`Delete ticket "${ticket.title}"? This cannot be undone.`)) {
      onDelete()
    }
  }

  const accentColor = 'var(--accent)'

  return (
    <>
    <div
      className="fixed inset-0 z-40 md:absolute md:inset-y-0 md:right-0 md:left-auto md:z-30 panel-slide-in"
    >
      <div
        className="h-full flex flex-col ml-auto"
        style={{
          width: '100%',
          maxWidth: expanded ? 680 : 420,
          flexShrink: 0,
          transition: 'max-width 200ms var(--ease-smooth)',
          background: 'var(--material-regular)',
          backdropFilter: 'var(--sidebar-backdrop)',
          WebkitBackdropFilter: 'var(--sidebar-backdrop)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Color strip */}
        <div style={{ height: 3, background: accentColor, flexShrink: 0 }} />

        {/* Scrollable top section */}
        <div style={{ flex: '0 0 auto', overflowY: 'auto', maxHeight: ticket.workResult ? '48%' : '36%' }}>
          {/* Panel controls */}
          <div style={{
            padding: 'var(--space-4) var(--space-5) 0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-2)',
          }}>
            <button
              onClick={() => setExpanded(e => !e)}
              className="focus-ring"
              aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--fill-secondary)',
                color: 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 150ms var(--ease-spring)',
              }}
            >
              {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            <button
              ref={closeRef}
              onClick={onClose}
              className="focus-ring"
              aria-label="Close detail panel"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--fill-secondary)',
                color: 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-footnote)',
                transition: 'all 150ms var(--ease-spring)',
              }}
            >
              &#x2715;
            </button>
          </div>

          {/* Title + meta */}
          <div style={{ padding: 'var(--space-2) var(--space-5) var(--space-4)' }}>
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                const nextTitle = titleDraft.trim()
                setTitleDraft(nextTitle || ticket.title)
                if (nextTitle && nextTitle !== ticket.title) {
                  onUpdateTicket({ title: nextTitle })
                }
              }}
              className="apple-input focus-ring"
              aria-label="Ticket title"
              style={{
                width: '100%',
                fontSize: 'var(--text-title3)',
                fontWeight: 700,
                letterSpacing: '-0.3px',
                color: 'var(--text-primary)',
                lineHeight: 1.25,
                padding: '10px 12px',
              }}
            />

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-2)',
              flexWrap: 'wrap',
            }}>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <select
                  value={ticket.status}
                  onChange={(e) => onStatusChange(e.target.value as TicketStatus)}
                  className="focus-ring"
                  aria-label="Ticket status"
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    fontSize: 'var(--text-caption2)',
                    fontWeight: 700,
                    color: accentColor,
                    background: 'var(--accent-fill)',
                    border: `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)`,
                    padding: '5px 28px 5px var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {COLUMNS.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    right: 10,
                    pointerEvents: 'none',
                    color: accentColor,
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                >
                  ▼
                </span>
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {(['low', 'medium', 'high'] as TicketPriority[]).map((priority) => {
                  const isSelected = ticket.priority === priority
                  return (
                    <button
                      key={priority}
                      type="button"
                      className="focus-ring"
                      onClick={() => onUpdateTicket({ priority })}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        padding: '5px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: isSelected ? `1px solid ${PRIORITY_COLORS[priority]}` : '1px solid var(--separator)',
                        background: isSelected ? 'var(--fill-tertiary)' : 'transparent',
                        color: isSelected ? PRIORITY_COLORS[priority] : 'var(--text-tertiary)',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        fontSize: 'var(--text-caption2)',
                        fontWeight: 600,
                        letterSpacing: '0.3px',
                      }}
                    >
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: PRIORITY_COLORS[priority],
                      }} />
                      {priority}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Assignee */}
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{
                fontSize: 'var(--text-caption1)',
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Assignment
              </div>
              {assigneeEditable ? (
                <>
                  <AgentPicker
                    agents={agents}
                    value={ticket.assigneeId || ''}
                    onChange={updateAssignee}
                  />
                  {ticket.assigneeId && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      {roleOptions.map((role) => {
                        const isSelected = ticket.assigneeRole === role
                        return (
                          <button
                            key={role}
                            type="button"
                            className="focus-ring"
                            onClick={() => onUpdateTicket({ assigneeRole: isSelected ? null : role })}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: isSelected ? '1px solid var(--accent)' : '1px solid var(--separator)',
                              background: isSelected ? 'var(--accent-fill)' : 'transparent',
                              color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)',
                              cursor: 'pointer',
                              fontSize: 'var(--text-caption2)',
                              fontWeight: 600,
                            }}
                          >
                            {ROLE_LABELS[role]}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {agent ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--text-footnote)',
                      color: 'var(--text-secondary)',
                    }}>
                      <AgentAvatar agent={agent} size={24} borderRadius={7} />
                      <span>{agent.name}</span>
                      {ticket.assigneeRole && (
                        <span style={{ color: 'var(--text-tertiary)' }}>
                          ({ROLE_LABELS[ticket.assigneeRole]})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      fontSize: 'var(--text-footnote)',
                      color: 'var(--text-tertiary)',
                      fontStyle: 'italic',
                    }}>
                      Unassigned
                    </div>
                  )}
                  <div style={{
                    fontSize: 'var(--text-caption2)',
                    color: 'var(--text-tertiary)',
                    lineHeight: 1.4,
                  }}>
                    Assignee and role can only be changed while the ticket is in Backlog or To Do.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          <div style={{ padding: '0 var(--space-5) var(--space-4)' }}>
            <div style={{
              height: 1,
              background: 'var(--separator)',
              marginBottom: 'var(--space-3)',
            }} />
            <div style={{
              fontSize: 'var(--text-caption1)',
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 'var(--space-2)',
            }}>
              Description
            </div>
            <textarea
              value={ticket.description}
              onChange={(e) => onUpdateTicket({ description: e.target.value })}
              className="apple-input focus-ring"
              placeholder="Add details..."
              aria-label="Ticket description"
              rows={4}
              style={{
                width: '100%',
                fontSize: 'var(--text-footnote)',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                resize: 'vertical',
                minHeight: 96,
              }}
            />
          </div>

          {/* Relevant Files */}
          {(googleDriveEnabled || ticket.relevantFiles.length > 0) && (
            <div style={{ padding: '0 var(--space-5) var(--space-4)' }}>
              <div style={{
                height: 1,
                background: 'var(--separator)',
                marginBottom: 'var(--space-3)',
              }} />
              {googleDriveEnabled ? (
                <DriveFilePicker
                  value={ticket.relevantFiles}
                  onChange={(files) => onUpdateTicket({ relevantFiles: files })}
                />
              ) : (
                <div>
                  <div style={{
                    fontSize: 'var(--text-caption1)',
                    fontWeight: 600,
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 'var(--space-2)',
                  }}>
                    Relevant Files
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    {ticket.relevantFiles.map((f) => (
                      <a
                        key={f.id}
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 'var(--text-footnote)',
                          color: 'var(--accent)',
                          textDecoration: 'none',
                        }}
                      >
                        {f.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ padding: '0 var(--space-5) var(--space-4)' }}>
            <div style={{
              height: 1,
              background: 'var(--separator)',
              marginBottom: 'var(--space-3)',
            }} />
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-3)',
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={ticket.useSessionMemory}
                onChange={(e) => onUpdateTicket({ useSessionMemory: e.target.checked })}
                style={{ marginTop: 2 }}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{
                  fontSize: 'var(--text-caption1)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}>
                  Allow session memory
                </span>
                <span style={{
                  fontSize: 'var(--text-caption2)',
                  color: 'var(--text-tertiary)',
                  lineHeight: 1.4,
                }}>
                  When enabled, the agent may rely on prior hidden session context and treat this as a continuation.
                </span>
              </span>
            </label>
          </div>

          {/* Agent work result */}
          {ticket.workResult && (
            <div style={{ padding: '0 var(--space-5) var(--space-4)' }}>
              <div style={{
                height: 1,
                background: 'var(--separator)',
                marginBottom: 'var(--space-3)',
              }} />
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-2)',
              }}>
                <div style={{
                  fontSize: 'var(--text-caption1)',
                  fontWeight: 600,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Agent Work
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                </div>
              </div>
              <div style={{
                fontSize: 'var(--text-footnote)',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                borderLeft: `2px solid ${accentColor}`,
                paddingLeft: 'var(--space-3)',
              }}>
                {formatMessage(ticket.workResult)}
              </div>
            </div>
          )}

          {/* Work failed / empty result banner */}
          {(ticket.workState === 'failed' || (ticket.workState === 'done' && !ticket.workResult)) && (
            <div style={{
              padding: '0 var(--space-5) var(--space-4)',
            }}>
              <div style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${ticket.workState === 'failed' ? 'var(--system-red)' : 'var(--system-orange)'}`,
                background: `color-mix(in srgb, ${ticket.workState === 'failed' ? 'var(--system-red)' : 'var(--system-orange)'} 8%, transparent)`,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}>
                <div style={{
                  fontSize: 'var(--text-footnote)',
                  fontWeight: 600,
                  color: ticket.workState === 'failed' ? 'var(--system-red)' : 'var(--system-orange)',
                }}>
                  {ticket.workState === 'failed' ? 'Agent work failed' : 'Agent work completed but returned no result'}
                </div>
                {ticket.workError && (
                  <div style={{
                    fontSize: 'var(--text-caption2)',
                    color: 'var(--text-secondary)',
                  }}>
                    {ticket.workError}
                  </div>
                )}
                {onRetryWork && (
                  <button
                    onClick={onRetryWork}
                    className="focus-ring"
                    style={{
                      alignSelf: 'flex-start',
                      fontSize: 'var(--text-caption2)',
                      fontWeight: 600,
                      padding: '3px var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${ticket.workState === 'failed' ? 'var(--system-red)' : 'var(--system-orange)'}`,
                      background: 'transparent',
                      color: ticket.workState === 'failed' ? 'var(--system-red)' : 'var(--system-orange)',
                      cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{
          height: 1,
          background: 'var(--separator)',
          flexShrink: 0,
          margin: '0 var(--space-5)',
        }} />

        {/* Chat section (bottom half) */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          padding: 'var(--space-3) var(--space-5) 0',
        }}>
          <div style={{
            fontSize: 'var(--text-caption1)',
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 'var(--space-2)',
            flexShrink: 0,
          }}>
            Agent Chat
          </div>

          {!agent ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 'var(--text-footnote)',
              fontStyle: 'italic',
            }}>
              No agent assigned
            </div>
          ) : (
            <>
              {/* Messages */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                paddingBottom: 'var(--space-2)',
                minHeight: 0,
              }}>
                {messages.length === 0 && (
                  <div style={{
                    color: 'var(--text-tertiary)',
                    fontSize: 'var(--text-caption1)',
                    textAlign: 'center',
                    padding: 'var(--space-6) 0',
                    fontStyle: 'italic',
                  }}>
                    Ask {agent.name} about this ticket...
                  </div>
                )}

                {messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div style={{
                      maxWidth: '85%',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-footnote)',
                      lineHeight: 1.45,
                      background: msg.role === 'user' ? accentColor : 'var(--fill-tertiary)',
                      color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                    }}>
                      {formatMessage(msg.content)}
                      {msg.isStreaming && !msg.content && (
                        <span style={{ opacity: 0.5 }}>Thinking...</span>
                      )}
                      {msg.isStreaming && msg.content && (
                        <span style={{
                          display: 'inline-block',
                          width: 4,
                          height: 14,
                          background: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                          marginLeft: 2,
                          opacity: 0.6,
                          animation: 'blink 1s infinite',
                          verticalAlign: 'text-bottom',
                        }} />
                      )}
                    </div>
                    {msg.role === 'assistant' && !msg.isStreaming && msg.content.trim().length > 200 && (
                      <button
                        type="button"
                        onClick={() => openMarkdownDocument(msg.content)}
                        className="focus-ring"
                      style={{
                          marginTop: 'var(--space-1)',
                          fontSize: 'var(--text-caption2)',
                          fontWeight: 600,
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-md)',
                          border: 'none',
                          background: accentColor,
                          color: '#fff',
                          cursor: 'pointer',
                          boxShadow: `0 6px 16px color-mix(in srgb, ${accentColor} 25%, transparent)`,
                          transition: 'all 120ms ease',
                        }}
                      >
                        Open .md
                      </button>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{
                flexShrink: 0,
                padding: 'var(--space-2) 0 var(--space-3)',
                display: 'flex',
                gap: 'var(--space-2)',
                alignItems: 'flex-end',
              }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${agent.name}...`}
                  rows={1}
                  disabled={isStreaming}
                  style={{
                    flex: 1,
                    resize: 'none',
                    border: '1px solid var(--separator)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--fill-tertiary)',
                    color: 'var(--text-primary)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--text-footnote)',
                    fontFamily: 'inherit',
                    outline: 'none',
                    lineHeight: 1.4,
                    maxHeight: 80,
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  className="focus-ring"
                  aria-label="Send message"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    cursor: !input.trim() || isStreaming ? 'default' : 'pointer',
                    background: !input.trim() || isStreaming ? 'var(--fill-tertiary)' : accentColor,
                    color: !input.trim() || isStreaming ? 'var(--text-tertiary)' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    flexShrink: 0,
                    transition: 'all 120ms ease',
                  }}
                >
                  &#x2191;
                </button>
              </div>
            </>
          )}
        </div>

        {/* Delete button */}
        <div style={{
          flexShrink: 0,
          padding: 'var(--space-2) var(--space-5) var(--space-4)',
          borderTop: '1px solid var(--separator)',
        }}>
          <button
            onClick={handleDelete}
            className="focus-ring"
            style={{
              width: '100%',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--system-red)',
              background: 'transparent',
              color: 'var(--system-red)',
              fontSize: 'var(--text-footnote)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
          >
            Delete Ticket
          </button>
        </div>
      </div>
    </div>

    {/* Markdown modal */}
    {mdModalContent && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={() => setMdModalContent(null)}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--separator)',
            borderRadius: 'var(--radius-lg)',
            width: '90vw',
            maxWidth: 720,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
          }}
        >
          {/* Modal header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--separator)',
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 'var(--text-footnote)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              Response
            </span>
            <button
              type="button"
              onClick={() => setMdModalContent(null)}
              className="focus-ring"
              style={{
                background: 'var(--fill-tertiary)',
                border: '1px solid var(--separator)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: 'var(--text-caption2)',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>

          {/* Export toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-4)',
            borderBottom: '1px solid var(--separator)',
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 'var(--text-caption2)',
              color: 'var(--text-tertiary)',
              fontWeight: 500,
              marginRight: 'var(--space-1)',
            }}>
              Save as
            </span>
            {[
              { label: 'PDF', onClick: () => exportAsPdf(mdModalContent!) },
              { label: 'DOCX', onClick: () => { exportAsDocx(mdModalContent!) } },
              ...(googleDriveEnabled
                ? [{
                    label: googleDocExporting ? 'Creating...' : 'Google Doc',
                    onClick: () => { exportAsGoogleDoc(mdModalContent!) },
                  }]
                : []),
            ].map(btn => (
              <button
                key={btn.label}
                type="button"
                onClick={btn.onClick}
                disabled={btn.label === 'Creating...'}
                className="focus-ring"
                style={{
                  padding: '3px 10px',
                  fontSize: 'var(--text-caption2)',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--separator)',
                  background: 'var(--fill-secondary)',
                  color: 'var(--text-secondary)',
                  cursor: btn.label === 'Creating...' ? 'wait' : 'pointer',
                  opacity: btn.label === 'Creating...' ? 0.6 : 1,
                  transition: 'all 120ms ease',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Modal body */}
          <div style={{
            padding: 'var(--space-4)',
            overflowY: 'auto',
            fontSize: 'var(--text-footnote)',
            lineHeight: 1.6,
            color: 'var(--text-primary)',
          }}>
            {formatMessage(mdModalContent)}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
