'use client'
import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Agent } from '@/lib/types'
import { AgentList, AgentListMobile } from '@/components/chat/AgentList'
import { ConversationView } from '@/components/chat/ConversationView'
import { fetchAgentsCached } from '@/lib/agents-client'
import {
  loadConversations, saveConversations, getOrCreateConversation,
  markRead, type ConversationStore, type Message,
  fetchConversation, syncToServer, fromStoredMessage,
} from '@/lib/conversations'

function MessengerApp() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlAgentId = searchParams.get('agent')
  const [agents, setAgents] = useState<Agent[]>([])
  const [conversations, setConversations] = useState<ConversationStore>({})
  const [activeAgentId, setActiveAgentId] = useState<string | null>(urlAgentId)
  const [loading, setLoading] = useState(true)
  const [mobileShowConversation, setMobileShowConversation] = useState(!!urlAgentId)

  // Load agents
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchAgentsCached()
      .then((data) => {
        if (cancelled) return
        setAgents(data)
      })
      .catch(() => {
        if (cancelled) return
        setAgents([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Load conversations from localStorage
  useEffect(() => {
    setConversations(loadConversations())
  }, [])

  // Save conversations whenever they change (localStorage + server sync)
  const prevConversationsRef = useRef<ConversationStore>({})
  useEffect(() => {
    if (Object.keys(conversations).length > 0) {
      saveConversations(conversations)

      // Sync only new messages to server (fire-and-forget)
      const prev = prevConversationsRef.current
      for (const agentId of Object.keys(conversations)) {
        const prevMsgs = prev[agentId]?.messages || []
        const currMsgs = conversations[agentId]?.messages || []
        if (currMsgs.length > prevMsgs.length) {
          const prevIds = new Set(prevMsgs.map((m: Message) => m.id))
          const newMsgs = currMsgs.filter((m: Message) => !prevIds.has(m.id))
          if (newMsgs.length > 0) {
            syncToServer(agentId, newMsgs)
          }
        }
      }
      prevConversationsRef.current = conversations
    }
  }, [conversations])

  // Background merge: fetch server conversations and merge with localStorage
  const mergedRef = useRef(false)
  useEffect(() => {
    if (loading || agents.length === 0 || mergedRef.current) return
    mergedRef.current = true

    Promise.all(
      agents.map(async (agent) => {
        const serverMsgs = await fetchConversation(agent.id)
        return { agentId: agent.id, messages: serverMsgs }
      })
    ).then(results => {
      setConversations(prev => {
        let merged = { ...prev }
        for (const { agentId, messages: serverMsgs } of results) {
          if (serverMsgs.length === 0) continue
          const existing = merged[agentId]
          if (!existing) {
            // Server has messages but localStorage doesn't — create conversation
            merged[agentId] = {
              agentId,
              messages: serverMsgs.map(fromStoredMessage),
              unread: 0,
              lastActivity: serverMsgs[serverMsgs.length - 1].timestamp,
            }
          } else {
            // Merge by message ID, sort by timestamp
            const existingIds = new Set(existing.messages.map((m: Message) => m.id))
            const newFromServer = serverMsgs
              .filter(m => !existingIds.has(m.id))
              .map(fromStoredMessage)
            if (newFromServer.length > 0) {
              const allMessages = [...existing.messages, ...newFromServer]
                .sort((a, b) => a.timestamp - b.timestamp)
              merged[agentId] = { ...existing, messages: allMessages }
            }
          }
        }
        return merged
      })
    })
  }, [loading, agents])

  // Keep local state in sync with URL query changes
  useEffect(() => {
    const isDesktop = window.innerWidth >= 768

    if (urlAgentId) {
      if (urlAgentId !== activeAgentId) {
        setActiveAgentId(urlAgentId)
      }
      setMobileShowConversation(true)
      return
    }

    setMobileShowConversation(false)
    if (!isDesktop && activeAgentId) {
      setActiveAgentId(null)
    }
  }, [urlAgentId, activeAgentId])

  // Normalize invalid URL state and set desktop default agent
  useEffect(() => {
    if (loading || agents.length === 0) return
    const isDesktop = window.innerWidth >= 768
    const hasUrlAgent = !!urlAgentId && agents.some((agent) => agent.id === urlAgentId)

    if (urlAgentId && !hasUrlAgent) {
      if (isDesktop) {
        const fallbackId = agents[0].id
        setActiveAgentId(fallbackId)
        router.replace(`/chat?agent=${fallbackId}`, { scroll: false })
      } else {
        setActiveAgentId(null)
        setMobileShowConversation(false)
        router.replace('/chat', { scroll: false })
      }
      return
    }

    if (!urlAgentId && isDesktop && !activeAgentId) {
      const fallbackId = agents[0].id
      setActiveAgentId(fallbackId)
      router.replace(`/chat?agent=${fallbackId}`, { scroll: false })
    }
  }, [loading, agents, urlAgentId, activeAgentId, router])

  const handleSelectAgent = useCallback((agent: Agent) => {
    setActiveAgentId(agent.id)
    setMobileShowConversation(true)
    setConversations(prev => {
      const conv = getOrCreateConversation(prev, agent)
      const next = { ...prev, [agent.id]: conv }
      return markRead(next, agent.id)
    })
    router.replace(`/chat?agent=${agent.id}`, { scroll: false })
  }, [router])

  const handleConversationUpdate = useCallback((agentId: string, updater: (prev: ConversationStore) => ConversationStore) => {
    setConversations(prev => updater(prev))
  }, [])

  const handleMobileBack = useCallback(() => {
    setMobileShowConversation(false)
    router.replace('/chat', { scroll: false })
  }, [router])

  const activeAgent = agents.find(a => a.id === activeAgentId) || null

  // Init conversation for active agent
  useEffect(() => {
    if (activeAgent) {
      setConversations(prev => {
        const conv = getOrCreateConversation(prev, activeAgent)
        return markRead({ ...prev, [activeAgent.id]: conv }, activeAgent.id)
      })
    }
  }, [activeAgent?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
      {/* Desktop sidebar — always visible on md+ */}
      <AgentList
        agents={agents}
        conversations={conversations}
        activeId={activeAgentId}
        onSelect={handleSelectAgent}
        loading={loading}
      />

      {/* Mobile agent list — shown when no conversation selected */}
      <div
        className={`md:hidden ${mobileShowConversation ? 'hidden' : 'flex flex-col'}`}
        style={{
          flex: 1,
          height: '100%',
        }}
      >
        <AgentListMobile
          agents={agents}
          conversations={conversations}
          onSelect={handleSelectAgent}
          loading={loading}
        />
      </div>

      {/* Desktop conversation view — visible when agent selected on md+ */}
      <div
        className="hidden md:flex md:flex-col"
        style={{ flex: 1, height: '100%' }}
      >
        {loading ? (
          <LoadingState />
        ) : agents.length === 0 ? (
          <NoAgentsState />
        ) : activeAgent && conversations[activeAgent.id] ? (
          <ConversationView
            key={activeAgent.id}
            agent={activeAgent}
            conversation={conversations[activeAgent.id]}
            onUpdate={handleConversationUpdate}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Mobile conversation view — shown full width when agent selected */}
      {mobileShowConversation && activeAgent && conversations[activeAgent.id] && (
        <div
          className="flex flex-col md:hidden"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 20,
            background: 'var(--bg)',
          }}
        >
          <ConversationView
            key={activeAgent.id}
            agent={activeAgent}
            conversation={conversations[activeAgent.id]}
            onUpdate={handleConversationUpdate}
            onBack={handleMobileBack}
          />
        </div>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      gap: 'var(--space-3)',
      padding: 'var(--space-8)',
    }}>
      <div
        className="animate-spin"
        style={{
          width: 24,
          height: 24,
          border: '2px solid var(--fill-tertiary)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
        }}
      />
      <div style={{
        fontSize: 'var(--text-subheadline)',
        color: 'var(--text-secondary)',
      }}>
        Loading conversations...
      </div>
    </div>
  )
}

function NoAgentsState() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      gap: 'var(--space-2)',
      padding: 'var(--space-8)',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 'var(--text-title3)',
        fontWeight: 'var(--weight-bold)',
        color: 'var(--text-primary)',
      }}>
        No agents found
      </div>
      <div style={{
        fontSize: 'var(--text-subheadline)',
        color: 'var(--text-secondary)',
        lineHeight: 'var(--leading-relaxed)',
      }}>
        Add agents in your OpenClaw workspace, then refresh this page.
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      gap: 'var(--space-3)',
      padding: 'var(--space-8)',
    }}>
      <div style={{ fontSize: 48, marginBottom: 'var(--space-2)' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <div style={{
        fontSize: 'var(--text-title3)',
        fontWeight: 'var(--weight-bold)',
        color: 'var(--text-primary)',
        letterSpacing: '-0.3px',
      }}>
        ClawPort Messages
      </div>
      <div style={{
        fontSize: 'var(--text-subheadline)',
        color: 'var(--text-secondary)',
        textAlign: 'center',
        lineHeight: 'var(--leading-relaxed)',
      }}>
        Select an agent from the sidebar to start chatting
      </div>
      <div style={{
        fontSize: 'var(--text-caption1)',
        color: 'var(--text-quaternary)',
        marginTop: 'var(--space-2)',
      }}>
        Press Cmd+K to search agents
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense>
      <MessengerApp />
    </Suspense>
  )
}
