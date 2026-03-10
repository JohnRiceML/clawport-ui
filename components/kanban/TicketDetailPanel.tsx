'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import type { Agent } from '@/lib/types'
import type { KanbanTicket, TicketStatus, TicketPriority } from '@/lib/kanban/types'
import { PRIORITY_COLORS, ROLE_LABELS, COLUMNS } from '@/lib/kanban/types'
import { AgentAvatar } from '@/components/AgentAvatar'
import { generateId } from '@/lib/id'

/* ── Chat message type (local to kanban) ─────────────── */

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
}

/* ── Simple markdown formatting (matches ConversationView pattern) ── */

function formatInline(text: string): React.ReactNode {
  // Handle **bold**, `code`, and plain text segments
  const parts: React.ReactNode[] = []
  const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[2]) {
      parts.push(<strong key={match.index} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{match[2]}</strong>)
    } else if (match[3]) {
      parts.push(
        <code key={match.index} style={{
          background: 'var(--code-bg)',
          border: '1px solid var(--code-border)',
          borderRadius: 4,
          padding: '1px 5px',
          fontSize: '0.9em',
          fontFamily: 'var(--font-mono)',
          color: 'var(--code-text)',
        }}>{match[3]}</code>
      )
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

function formatContent(content: string): React.ReactNode {
  if (!content) return null
  const lines = content.split('\n')
  const result: React.ReactNode[] = []
  let inCode = false
  const codeBlock: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code fence toggle
    if (line.startsWith('```')) {
      if (inCode) {
        result.push(
          <pre key={`code-${i}`} style={{
            background: 'var(--code-bg)',
            border: '1px solid var(--code-border)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--text-caption1)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--code-text)',
            overflowX: 'auto',
            margin: '4px 0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {codeBlock.join('\n')}
          </pre>
        )
        codeBlock.length = 0
      }
      inCode = !inCode
      continue
    }

    if (inCode) {
      codeBlock.push(line)
      continue
    }

    if (line.trim() === '') {
      result.push(<div key={`space-${i}`} style={{ height: 4 }} />)
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      result.push(
        <div key={i} style={{
          fontSize: level === 1 ? 'var(--text-subheadline)' : 'var(--text-footnote)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginTop: 6,
          marginBottom: 2,
        }}>
          {formatInline(headingMatch[2])}
        </div>
      )
      continue
    }

    // Bullet points
    if (line.match(/^[-*] /)) {
      result.push(
        <div key={i} style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 1 }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0 }}>&bull;</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>
      )
      continue
    }

    // Numbered lists
    const numMatch = line.match(/^(\d+)[.)]\s+(.+)/)
    if (numMatch) {
      result.push(
        <div key={i} style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 1 }}>
          <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, minWidth: 16, textAlign: 'right' }}>{numMatch[1]}.</span>
          <span>{formatInline(numMatch[2])}</span>
        </div>
      )
      continue
    }

    result.push(<div key={i} style={{ marginBottom: 1 }}>{formatInline(line)}</div>)
  }
  return <>{result}</>
}

/* ── Priority badge ──────────────────────────────────── */

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const label = priority === 'high' ? '高' : priority === 'medium' ? '中' : '低'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-1)',
      fontSize: 'var(--text-caption2)',
      fontWeight: 600,
      color: PRIORITY_COLORS[priority],
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: PRIORITY_COLORS[priority],
      }} />
      {label}
    </span>
  )
}

/* ── Status badge ────────────────────────────────────── */

function StatusBadge({ status }: { status: TicketStatus }) {
  const label = COLUMNS.find(c => c.id === status)?.title ?? status
  return (
    <span style={{
      fontSize: 'var(--text-caption2)',
      fontWeight: 600,
      color: 'var(--text-secondary)',
      background: 'var(--fill-tertiary)',
      padding: '2px var(--space-2)',
      borderRadius: 'var(--radius-sm)',
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
    }}>
      {label}
    </span>
  )
}

/* ── Main component ──────────────────────────────────── */

interface TicketDetailPanelProps {
  ticket: KanbanTicket
  agent: Agent | null
  onClose: () => void
  onStatusChange: (status: TicketStatus) => void
  onDelete: () => void
  onRetryWork?: () => void
}

export function TicketDetailPanel({
  ticket,
  agent,
  onClose,
  onStatusChange,
  onDelete,
  onRetryWork,
}: TicketDetailPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Load messages from API on mount / ticket change
  useEffect(() => {
    let cancelled = false
    fetch(`/api/kanban/chat-history/${ticket.id}`)
      .then(res => res.ok ? res.json() : [])
      .then((msgs: ChatMessage[]) => { if (!cancelled) setMessages(msgs) })
      .catch(() => { if (!cancelled) setMessages([]) })
    return () => { cancelled = true }
  }, [ticket.id])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Focus close button on mount
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

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
            status: ticket.status,
            priority: ticket.priority,
            assigneeRole: ticket.assigneeRole,
            workResult: ticket.workResult,
          },
        }),
      })

      if (!res.ok || !res.body) throw new Error('流式响应失败')

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
            try {
              const chunk = JSON.parse(line.slice(6))
              if (chunk.content) {
                fullContent += chunk.content
                const captured = fullContent
                setMessages(prev =>
                  prev.map(m => m.id === assistantMsgId
                    ? { ...m, content: captured, isStreaming: true }
                    : m
                  )
                )
              }
            } catch { /* skip malformed chunks */ }
          }
        }
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
    } catch {
      const errorContent = '获取回复失败，请检查 API 连接。'
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
    if (window.confirm(`确认删除工单“${ticket.title}”？此操作不可恢复。`)) {
      onDelete()
    }
  }

  const accentColor = 'var(--accent)'

  return (
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
        <div style={{ flex: '0 0 auto', overflowY: 'auto', maxHeight: ticket.workResult ? '55%' : '45%' }}>
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
              aria-label={expanded ? '收起面板' : '展开面板'}
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
              aria-label="关闭详情面板"
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
            <h2 style={{
              fontSize: 'var(--text-title3)',
              fontWeight: 700,
              letterSpacing: '-0.3px',
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.25,
            }}>
              {ticket.title}
            </h2>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-2)',
            }}>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>

            {/* Assignee */}
            {agent ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-3)',
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
                marginTop: 'var(--space-3)',
                fontSize: 'var(--text-footnote)',
                color: 'var(--text-tertiary)',
                fontStyle: 'italic',
              }}>
                未分配
              </div>
            )}
          </div>

          {/* Status controls */}
          <div style={{
            padding: '0 var(--space-5) var(--space-4)',
          }}>
            <div style={{
              fontSize: 'var(--text-caption1)',
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 'var(--space-2)',
            }}>
              移动到
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
              {COLUMNS.map(col => {
                const isCurrent = col.id === ticket.status
                return (
                  <button
                    key={col.id}
                    onClick={() => { if (!isCurrent) onStatusChange(col.id) }}
                    disabled={isCurrent}
                    className="focus-ring"
                    style={{
                      fontSize: 'var(--text-caption2)',
                      fontWeight: 600,
                      padding: '3px var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      cursor: isCurrent ? 'default' : 'pointer',
                      background: isCurrent ? accentColor : 'var(--fill-tertiary)',
                      color: isCurrent ? '#fff' : 'var(--text-secondary)',
                      opacity: isCurrent ? 1 : 0.8,
                      transition: 'all 120ms ease',
                    }}
                  >
                    {col.title}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description */}
          {ticket.description && (
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
                描述
              </div>
              <div style={{
                fontSize: 'var(--text-footnote)',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                {ticket.description}
              </div>
            </div>
          )}

          {/* Agent work result */}
          {ticket.workResult && (
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
                智能体执行结果
              </div>
              <div style={{
                fontSize: 'var(--text-footnote)',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                borderLeft: `2px solid ${accentColor}`,
                paddingLeft: 'var(--space-3)',
              }}>
                {formatContent(ticket.workResult)}
              </div>
            </div>
          )}

          {/* Work failed banner */}
          {ticket.workState === 'failed' && (
            <div style={{
              padding: '0 var(--space-5) var(--space-4)',
            }}>
              <div style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--system-red)',
                background: 'color-mix(in srgb, var(--system-red) 8%, transparent)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}>
                <div style={{
                  fontSize: 'var(--text-footnote)',
                  fontWeight: 600,
                  color: 'var(--system-red)',
                }}>
                  智能体执行失败
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
                      border: '1px solid var(--system-red)',
                      background: 'transparent',
                      color: 'var(--system-red)',
                      cursor: 'pointer',
                    }}
                  >
                    重试
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
            智能体对话
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
              暂未指定智能体
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
                    向 {agent.name} 询问此工单...
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
                      {formatContent(msg.content)}
                      {msg.isStreaming && !msg.content && (
                        <span style={{ opacity: 0.5 }}>思考中...</span>
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
                  placeholder={`给 ${agent.name} 发消息...`}
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
                  aria-label="发送消息"
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
            删除工单
          </button>
        </div>
      </div>
    </div>
  )
}
