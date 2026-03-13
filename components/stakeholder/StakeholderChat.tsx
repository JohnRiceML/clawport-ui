'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, RefreshCw } from 'lucide-react'
import { generateId } from '@/lib/id'
import type { StakeholderSummary } from '@/lib/stakeholder/types'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

const SUGGESTED_QUESTIONS = [
  'What was delivered this week?',
  'Are there any blockers I should know about?',
  'When is the next scheduled update?',
  'Summarize the current status in two sentences.',
]

function buildContextPrompt(summary: StakeholderSummary, audienceLabel: string): string {
  const lines: string[] = [
    `You are a helpful assistant embedded in the ${audienceLabel} Hub of a dashboard that monitors AI agent operations.`,
    `The user viewing this page is an external client. Answer their questions clearly and concisely using the data below.`,
    `Do not use em dashes. Keep language plain and professional.`,
    '',
    `## Current Status: ${summary.overallStatus.replace(/_/g, ' ').toUpperCase()}`,
    `Window: ${summary.range}`,
    `Generated: ${summary.generatedAt}`,
    '',
    `## Executive Summary`,
    summary.executiveSummary,
    '',
    `## Metrics`,
    `- Successful deliveries: ${summary.metrics.successfulDeliveries}`,
    `- Failed deliveries: ${summary.metrics.failedDeliveries}`,
    `- Open risks: ${summary.metrics.openRisks}`,
    `- Completed outputs: ${summary.metrics.completedOutputs}`,
  ]

  if (summary.outcomes.length > 0) {
    lines.push('', '## Key Outcomes')
    for (const item of summary.outcomes) {
      lines.push(`- **${item.title}** (${item.ownerName}): ${item.summary}`)
    }
  }

  if (summary.deliverables.length > 0) {
    lines.push('', '## Deliverables')
    for (const item of summary.deliverables) {
      lines.push(
        `- **${item.title}** delivered ${new Date(item.deliveredAt).toLocaleString()}${item.channel ? ` via ${item.channel}` : ''}${item.destinationLabel ? ` to ${item.destinationLabel}` : ''}: ${item.summary}`,
      )
    }
  }

  if (summary.risks.length > 0) {
    lines.push('', '## Risks & Blockers')
    for (const risk of summary.risks) {
      lines.push(
        `- [${risk.severity.toUpperCase()}] **${risk.title}** (${risk.ownerName || 'Unassigned'}): ${risk.summary}`,
      )
    }
  }

  if (summary.upcoming.length > 0) {
    lines.push('', '## Upcoming')
    for (const item of summary.upcoming) {
      lines.push(
        `- **${item.title}** next run: ${item.nextRun}${item.expectedChannel ? ` via ${item.expectedChannel}` : ''}`,
      )
    }
  }

  return lines.join('\n')
}

export function StakeholderChat({
  summary,
  audienceLabel,
  agentId,
}: {
  summary: StakeholderSummary
  audienceLabel: string
  agentId: string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim()
      if (!text || isStreaming) return
      if (!overrideText) setInput('')

      const userMsg: ChatMessage = { id: generateId(), role: 'user', content: text }
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        isStreaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)

      const contextPrompt = buildContextPrompt(summary, audienceLabel)
      const allMessages = [...messages, userMsg]
      const apiMessages = [
        { role: 'user' as const, content: contextPrompt },
        {
          role: 'assistant' as const,
          content: `Understood. I have the current ${audienceLabel.toLowerCase()} hub data. How can I help?`,
        },
        ...allMessages.map((m) => ({ role: m.role, content: m.content })),
      ]

      try {
        const res = await fetch(`/api/chat/${agentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages }),
        })

        if (!res.ok || !res.body) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: 'Sorry, I could not get a response. Please try again.', isStreaming: false }
                : m,
            ),
          )
          setIsStreaming(false)
          return
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
              try {
                const chunk = JSON.parse(line.slice(6))
                if (chunk.content) {
                  fullContent += chunk.content
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsg.id ? { ...m, content: fullContent, isStreaming: true } : m,
                    ),
                  )
                }
              } catch {
                /* skip malformed */
              }
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, isStreaming: false } : m)),
        )
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: 'Connection error. Please try again.', isStreaming: false }
              : m,
          ),
        )
      } finally {
        setIsStreaming(false)
        textareaRef.current?.focus()
      }
    },
    [input, isStreaming, messages, summary, audienceLabel, agentId],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void sendMessage()
      }
    },
    [sendMessage],
  )

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          width: '100%',
          padding: 'var(--space-4) var(--space-5)',
          background: 'var(--material-regular)',
          border: '1px solid var(--separator)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-footnote)',
          fontWeight: 'var(--weight-medium)',
          transition: 'border-color 0.15s',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)'
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = 'var(--separator)'
        }}
      >
        <MessageSquare size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        Ask a question about this report...
      </button>
    )
  }

  return (
    <section
      style={{
        background: 'var(--material-regular)',
        border: '1px solid var(--separator)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--separator)',
        }}
      >
        <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
          <MessageSquare size={16} style={{ color: 'var(--accent)' }} />
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--text-headline)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
            }}
          >
            Ask About This Report
          </h2>
        </div>
        <button
          onClick={() => {
            setIsOpen(false)
            setMessages([])
            setInput('')
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            fontSize: 'var(--text-caption1)',
            padding: '4px 8px',
          }}
        >
          Close
        </button>
      </div>

      <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
        {/* Suggested questions */}
        {messages.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-4)',
            }}
          >
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => void sendMessage(q)}
                disabled={isStreaming}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid var(--separator)',
                  background: 'var(--fill-quaternary)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--text-caption1)',
                  cursor: isStreaming ? 'default' : 'pointer',
                  opacity: isStreaming ? 0.5 : 1,
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseOver={(e) => {
                  if (!isStreaming) {
                    e.currentTarget.style.background = 'var(--fill-tertiary)'
                    e.currentTarget.style.borderColor = 'var(--accent)'
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'var(--fill-quaternary)'
                  e.currentTarget.style.borderColor = 'var(--separator)'
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
              maxHeight: 400,
              overflowY: 'auto',
              paddingRight: 'var(--space-2)',
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-footnote)',
                    lineHeight: 1.45,
                    background: msg.role === 'user' ? 'var(--accent)' : 'var(--fill-tertiary)',
                    color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                  {msg.isStreaming && msg.content && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 4,
                        height: 14,
                        background: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                        marginLeft: 2,
                        opacity: 0.6,
                        animation: 'blink 1s infinite',
                        verticalAlign: 'text-bottom',
                      }}
                    />
                  )}
                  {msg.isStreaming && !msg.content && (
                    <RefreshCw size={14} className="animate-spin" style={{ opacity: 0.5 }} />
                  )}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        )}

        {/* Input */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up question..."
            rows={1}
            disabled={isStreaming}
            style={{
              flex: 1,
              resize: 'none',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--separator)',
              background: 'var(--fill-quaternary)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-footnote)',
              fontFamily: 'inherit',
              outline: 'none',
              lineHeight: 1.45,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--separator)'
            }}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || isStreaming}
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: !input.trim() || isStreaming ? 'var(--fill-tertiary)' : 'var(--accent)',
              color: !input.trim() || isStreaming ? 'var(--text-tertiary)' : '#fff',
              cursor: !input.trim() || isStreaming ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </section>
  )
}
