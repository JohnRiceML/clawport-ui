'use client'
import { useState } from 'react'
import type { Agent } from '@/lib/types'
import type { ConversationStore } from '@/lib/conversations'
import { useSettings } from '@/app/settings-provider'
import { localizeAgentDescription } from '@/lib/i18n'
import { Skeleton } from '@/components/ui/skeleton'
import { AgentAvatar } from '@/components/AgentAvatar'

interface AgentListProps {
  agents: Agent[]
  conversations: ConversationStore
  activeId: string | null
  onSelect: (agent: Agent) => void
  loading?: boolean
}

export function AgentList({ agents, conversations, activeId, onSelect, loading }: AgentListProps) {
  const { copy, resolvedLocale } = useSettings()
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? agents.filter(a => {
        const q = search.toLowerCase()
        return a.name.toLowerCase().includes(q) || a.title.toLowerCase().includes(q)
      })
    : agents

  const sorted = [...filtered].sort((a, b) => {
    const ca = conversations[a.id]
    const cb = conversations[b.id]
    if (ca && cb) return cb.lastActivity - ca.lastActivity
    if (ca) return -1
    if (cb) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div
      className="hidden md:flex md:flex-col"
      style={{
        width: 300,
        flexShrink: 0,
        background: 'var(--sidebar-bg)',
        backdropFilter: 'var(--sidebar-backdrop)',
        WebkitBackdropFilter: 'var(--sidebar-backdrop)',
        borderRight: '1px solid var(--separator)',
        height: '100%',
      }}
    >
      {/* Header */}
      <div style={{
        padding: 'var(--space-4) var(--space-4) var(--space-3)',
        borderBottom: '1px solid var(--separator)',
        background: 'var(--material-thick)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        flexShrink: 0,
      }}>
        <h2 style={{
          fontSize: 'var(--text-title2)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: '-0.5px',
          color: 'var(--text-primary)',
          margin: 0,
        }}>
          {copy.nav.messages}
        </h2>

        {/* Search */}
        <div style={{
          marginTop: 'var(--space-3)',
          background: 'var(--fill-tertiary)',
          borderRadius: 'var(--radius-md)',
          padding: '7px var(--space-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={copy.chat.searchAgentsPlaceholder}
            aria-label={copy.chat.searchAgentsAria}
            className="focus-ring"
            style={{
              flex: 1,
              fontSize: 'var(--text-footnote)',
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
              margin: 0,
              lineHeight: 1.4,
            }}
          />
          {search.trim() && (
            <button
              className="btn-ghost focus-ring"
              onClick={() => setSearch('')}
              aria-label={copy.chat.clearSearchAria}
              style={{
                padding: 2,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Agent list */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-1) 0' }}
        role="listbox"
        aria-label={copy.chat.agentListAria}
      >
        {loading ? (
          <div style={{ padding: 'var(--space-1) 0' }} role="status" aria-label={copy.chat.loadingAgentsAria}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
              }}>
                <Skeleton className="rounded-full" style={{ width: 40, height: 40, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <Skeleton style={{ width: '55%', height: 14 }} />
                  <Skeleton style={{ width: '80%', height: 11 }} />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 && search.trim() ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-8) var(--space-4)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 'var(--text-footnote)',
              color: 'var(--text-tertiary)',
              lineHeight: 'var(--leading-relaxed)',
            }}>
              {copy.chat.noAgentsMatch(search.trim())}
            </div>
          </div>
        ) : (
          sorted.map(agent => {
            const conv = conversations[agent.id]
            const lastMsg = conv?.messages[conv.messages.length - 1]
            const unread = conv?.unread || 0
            const isActive = agent.id === activeId

            const preview = lastMsg
              ? (lastMsg.role === 'user' ? copy.chat.youPrefix : '') +
                lastMsg.content.replace(/[#*`]/g, '').slice(0, 50) +
                (lastMsg.content.length > 50 ? '\u2026' : '')
              : localizeAgentDescription(agent.id, agent.description, resolvedLocale).slice(0, 50) || copy.chat.startConversation

            const timeLabel = lastMsg ? formatTime(lastMsg.timestamp, resolvedLocale, copy.chat.now) : ''

            return (
              <button
                key={agent.id}
                onClick={() => onSelect(agent)}
                role="option"
                aria-selected={isActive}
                className="hover-bg focus-ring"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: isActive ? 'var(--fill-secondary)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {/* Avatar */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <AgentAvatar agent={agent} size={40} borderRadius={20} />
                  {/* Online dot */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--system-green)',
                    border: '1.5px solid var(--bg)',
                  }} />
                </div>

                {/* Text content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 2,
                  }}>
                    <span style={{
                      fontSize: 'var(--text-footnote)',
                      fontWeight: unread > 0 ? 'var(--weight-bold)' : 'var(--weight-semibold)',
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 140,
                    }}>
                      {agent.name}
                    </span>
                    <span style={{
                      fontSize: 'var(--text-caption2)',
                      color: unread > 0 ? 'var(--accent)' : 'var(--text-tertiary)',
                      flexShrink: 0,
                      marginLeft: 'var(--space-1)',
                    }}>
                      {timeLabel}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: 'var(--text-caption1)',
                      color: unread > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                      fontWeight: unread > 0 ? 'var(--weight-medium)' : 'var(--weight-regular)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      minWidth: 0,
                    }}>
                      {preview}
                    </span>
                    {unread > 0 && (
                      <div style={{
                        flexShrink: 0,
                        marginLeft: 'var(--space-2)',
                        background: 'var(--accent)',
                        color: 'var(--accent-contrast)',
                        borderRadius: 10,
                        minWidth: 20,
                        height: 20,
                        padding: '0 6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 'var(--text-caption2)',
                        fontWeight: 'var(--weight-bold)',
                      }}>
                        {unread > 9 ? '9+' : unread}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

/* Mobile agent list — shown full width on small screens */
export function AgentListMobile({
  agents,
  conversations,
  onSelect,
  loading,
}: Omit<AgentListProps, 'activeId'>) {
  const { copy, resolvedLocale } = useSettings()
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? agents.filter(a => {
        const q = search.toLowerCase()
        return a.name.toLowerCase().includes(q) || a.title.toLowerCase().includes(q)
      })
    : agents

  const sorted = [...filtered].sort((a, b) => {
    const ca = conversations[a.id]
    const cb = conversations[b.id]
    if (ca && cb) return cb.lastActivity - ca.lastActivity
    if (ca) return -1
    if (cb) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg)',
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-4) var(--space-4) var(--space-3)',
        borderBottom: '1px solid var(--separator)',
        background: 'var(--material-thick)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        flexShrink: 0,
      }}>
        <h2 style={{
          fontSize: 'var(--text-title1)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: '-0.5px',
          color: 'var(--text-primary)',
          margin: 0,
        }}>
          {copy.nav.messages}
        </h2>

        {/* Search */}
        <div style={{
          marginTop: 'var(--space-3)',
          background: 'var(--fill-tertiary)',
          borderRadius: 'var(--radius-md)',
          padding: '10px var(--space-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={copy.chat.searchAgentsPlaceholder}
            aria-label={copy.chat.searchAgentsAria}
            className="focus-ring"
            style={{
              flex: 1,
              fontSize: 'var(--text-subheadline)',
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
              margin: 0,
              lineHeight: 1.4,
            }}
          />
        </div>
      </div>

      {/* Agent list */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-1) 0' }}
        role="listbox"
        aria-label={copy.chat.agentListAria}
      >
        {loading ? (
          <div style={{ padding: 'var(--space-1) 0' }} role="status" aria-label={copy.chat.loadingAgentsAria}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
              }}>
                <Skeleton className="rounded-full" style={{ width: 44, height: 44, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <Skeleton style={{ width: '55%', height: 15 }} />
                  <Skeleton style={{ width: '80%', height: 12 }} />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 && search.trim() ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-8) var(--space-4)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 'var(--text-subheadline)',
              color: 'var(--text-tertiary)',
              lineHeight: 'var(--leading-relaxed)',
            }}>
              {copy.chat.noAgentsMatch(search.trim())}
            </div>
          </div>
        ) : (
          sorted.map(agent => {
            const conv = conversations[agent.id]
            const lastMsg = conv?.messages[conv.messages.length - 1]
            const unread = conv?.unread || 0

            const preview = lastMsg
              ? (lastMsg.role === 'user' ? copy.chat.youPrefix : '') +
                lastMsg.content.replace(/[#*`]/g, '').slice(0, 60) +
                (lastMsg.content.length > 60 ? '\u2026' : '')
              : localizeAgentDescription(agent.id, agent.description, resolvedLocale).slice(0, 60) || copy.chat.startConversation

            const timeLabel = lastMsg ? formatTime(lastMsg.timestamp, resolvedLocale, copy.chat.now) : ''

            return (
              <button
                key={agent.id}
                onClick={() => onSelect(agent)}
                role="option"
                aria-selected={false}
                className="hover-bg focus-ring"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {/* Avatar */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <AgentAvatar agent={agent} size={44} borderRadius={22} />
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'var(--system-green)',
                    border: '2px solid var(--bg)',
                  }} />
                </div>

                {/* Text content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 2,
                  }}>
                    <span style={{
                      fontSize: 'var(--text-subheadline)',
                      fontWeight: unread > 0 ? 'var(--weight-bold)' : 'var(--weight-semibold)',
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.2px',
                    }}>
                      {agent.name}
                    </span>
                    <span style={{
                      fontSize: 'var(--text-caption1)',
                      color: unread > 0 ? 'var(--accent)' : 'var(--text-tertiary)',
                      flexShrink: 0,
                      marginLeft: 'var(--space-1)',
                    }}>
                      {timeLabel}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: 'var(--text-footnote)',
                      color: unread > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                      fontWeight: unread > 0 ? 'var(--weight-medium)' : 'var(--weight-regular)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      minWidth: 0,
                    }}>
                      {preview}
                    </span>
                    {unread > 0 && (
                      <div style={{
                        flexShrink: 0,
                        marginLeft: 'var(--space-2)',
                        background: 'var(--accent)',
                        color: 'var(--accent-contrast)',
                        borderRadius: 10,
                        minWidth: 20,
                        height: 20,
                        padding: '0 6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 'var(--text-caption2)',
                        fontWeight: 'var(--weight-bold)',
                      }}>
                        {unread > 9 ? '9+' : unread}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function formatTime(ts: number, locale: string, nowLabel: string): string {
  const now = Date.now()
  const diff = now - ts
  if (diff < 60000) return nowLabel
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) {
    return new Date(ts).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
  }
  return new Date(ts).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}
