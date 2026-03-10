'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Agent } from '@/lib/types'
import { AgentList, AgentListMobile } from '@/components/chat/AgentList'
import { ConversationView } from '@/components/chat/ConversationView'
import {
  loadConversations, saveConversations, getOrCreateConversation,
  markRead, loadConversationFromServer, loadAllConversationMeta,
  type ConversationStore
} from '@/lib/conversations'

function MessengerApp() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [agents, setAgents] = useState<Agent[]>([])
  const [conversations, setConversations] = useState<ConversationStore>({})
  const [activeAgentId, setActiveAgentId] = useState<string | null>(searchParams.get('agent'))
  const [loading, setLoading] = useState(true)
  const [mobileShowConversation, setMobileShowConversation] = useState(!!searchParams.get('agent'))

  // Load agents
  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then((data: Agent[]) => {
      setAgents(data)
      setLoading(false)
    })
  }, [])

  // Load conversations: localStorage first (instant), then merge server data
  useEffect(() => {
    const local = loadConversations()
    setConversations(local)

    // Fetch server-side conversation metadata, then load full conversations
    loadAllConversationMeta().then(async (metas) => {
      if (metas.length === 0) return
      const serverStore: ConversationStore = {}
      for (const meta of metas) {
        const messages = await loadConversationFromServer(meta.agentId)
        if (messages.length > 0) {
          serverStore[meta.agentId] = {
            agentId: meta.agentId,
            messages,
            unread: 0,
            lastActivity: meta.lastActivity,
          }
        }
      }
      // Merge: server messages take priority, dedup by id
      setConversations(prev => {
        const merged = { ...prev }
        for (const [agentId, serverConv] of Object.entries(serverStore)) {
          const localConv = merged[agentId]
          if (!localConv) {
            merged[agentId] = serverConv
          } else {
            const existingIds = new Set(localConv.messages.map(m => m.id))
            const newFromServer = serverConv.messages.filter(m => !existingIds.has(m.id))
            if (newFromServer.length > 0) {
              const allMessages = [...localConv.messages, ...newFromServer]
                .sort((a, b) => a.timestamp - b.timestamp)
              merged[agentId] = { ...localConv, messages: allMessages }
            }
          }
        }
        return merged
      })
    })
  }, [])

  // Save conversations whenever they change
  useEffect(() => {
    if (Object.keys(conversations).length > 0) {
      saveConversations(conversations)
    }
  }, [conversations])

  // Set default active agent on desktop only (don't auto-select on mobile)
  useEffect(() => {
    if (!loading && agents.length > 0 && !activeAgentId) {
      // On desktop (>= 768px), select first agent
      if (window.innerWidth >= 768) {
        setActiveAgentId(agents[0].id)
      }
    }
  }, [loading, agents, activeAgentId])

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
  }, [])

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
        {activeAgent && conversations[activeAgent.id] ? (
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
