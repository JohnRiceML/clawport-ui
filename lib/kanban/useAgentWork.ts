'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { KanbanTicket, TicketStatus } from './types'
import type { KanbanStore } from './store'
import { executeWork, getWorkPrompt, persistWorkChat } from './automation'

const MAX_CONCURRENT_WORK = 3

interface UseAgentWorkOptions {
  tickets: KanbanStore
  onUpdateTicket: (ticketId: string, updates: Partial<KanbanTicket>) => void
}

export function useAgentWork({ tickets, onUpdateTicket }: UseAgentWorkOptions) {
  const activeWork = useRef<Set<string>>(new Set())
  const abortControllers = useRef<Map<string, AbortController>>(new Map())
  const unmounted = useRef(false)

  // Clean up on unmount: abort all in-flight work
  useEffect(() => {
    unmounted.current = false
    return () => {
      unmounted.current = true
      for (const [, controller] of abortControllers.current) {
        controller.abort()
      }
      abortControllers.current.clear()
      activeWork.current.clear()
    }
  }, [])

  const runWork = useCallback(async (ticket: KanbanTicket) => {
    const { id, assigneeId } = ticket
    if (!assigneeId) return

    const controller = new AbortController()
    abortControllers.current.set(id, controller)

    // Move to in-progress + set working state
    onUpdateTicket(id, {
      status: 'in-progress' as TicketStatus,
      workState: 'working',
      workStartedAt: Date.now(),
      workError: null,
    })

    const result = await executeWork(assigneeId, ticket, undefined, controller.signal)

    // Bail if component unmounted while we were working
    if (unmounted.current) return

    abortControllers.current.delete(id)

    if (result.success) {
      // Save chat history so TicketDetailPanel picks it up
      const prompt = getWorkPrompt(ticket)
      persistWorkChat(id, prompt, result.content)

      // Move to review with result
      onUpdateTicket(id, {
        status: 'review' as TicketStatus,
        workState: 'done',
        workResult: result.content,
      })
    } else {
      onUpdateTicket(id, {
        workState: 'failed',
        workError: result.error || '智能体执行失败',
      })
    }

    activeWork.current.delete(id)
  }, [onUpdateTicket])

  // Scan for eligible tickets
  useEffect(() => {
    const eligible = Object.values(tickets).filter(
      (t) => t.status === 'todo' && t.assigneeId && t.workState === 'idle',
    )

    for (const ticket of eligible) {
      if (activeWork.current.has(ticket.id)) continue
      if (activeWork.current.size >= MAX_CONCURRENT_WORK) break

      // Mark as active immediately to prevent double-execution
      activeWork.current.add(ticket.id)

      // Set starting state synchronously to prevent re-triggers on next render
      onUpdateTicket(ticket.id, { workState: 'starting' })

      // Fire async work
      runWork(ticket)
    }
  }, [tickets, onUpdateTicket, runWork])

  const isWorking = useCallback(
    (ticketId: string): boolean => activeWork.current.has(ticketId),
    [],
  )

  return { isWorking }
}
