'use client'

import type { KanbanTicket, TeamRole } from './types'
import { generateId } from '../id'

/* ── Role-specific work prompts ──────────────────────── */

const ROLE_PROMPTS: Record<TeamRole, string> = {
  'lead-dev': `你是该工单的开发负责人，请输出：
1. 需要完成工作的技术拆解
2. 清晰可执行的实现步骤
3. 关键技术决策与取舍
4. 需要提前暴露的依赖或阻塞项

要求具体、可执行，并尽量引用明确的文件、接口或实现模式。`,

  'ux-ui': `你是该工单的 UX/UI 负责人，请输出：
1. 设计审查与改进建议
2. 用户流程说明
3. 可访问性（WCAG）关注点
4. 视觉与交互优化建议

聚焦真实用户体验，明确指出可用性风险与改进方向。`,

  'qa': `你是该工单的质量保障负责人，请输出：
1. 测试场景（主路径 + 边界情况）
2. 验收标准清单
3. 潜在回归风险区域
4. 需要重点验证的边界条件

要求全面，明确“可能会坏的地方”以及验证方法。`,
}

const FALLBACK_PROMPT = `你正在处理该工单，请输出：
1. 任务分析
2. 推荐方案
3. 关键风险与注意事项
4. 下一步行动

请保持简洁且可执行。`

export function getWorkPrompt(ticket: KanbanTicket): string {
  const rolePrompt = ticket.assigneeRole
    ? ROLE_PROMPTS[ticket.assigneeRole] ?? FALLBACK_PROMPT
    : FALLBACK_PROMPT

  return `${rolePrompt}

工单：${ticket.title}
${ticket.description ? `描述：${ticket.description}` : '描述：未提供。'}
优先级：${ticket.priority}`
}

/* ── Execute work via chat API ───────────────────────── */

interface WorkResult {
  success: boolean
  content: string
  error?: string
}

const WORK_TIMEOUT_MS = 120_000 // 2 minutes

export async function executeWork(
  agentId: string,
  ticket: KanbanTicket,
  onChunk?: (chunk: string) => void,
  externalSignal?: AbortSignal,
): Promise<WorkResult> {
  const prompt = getWorkPrompt(ticket)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), WORK_TIMEOUT_MS)

    // Forward external abort (e.g. component unmount) to our controller
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId)
        return { success: false, content: '', error: '已取消' }
      }
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    const res = await fetch(`/api/kanban/chat/${agentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
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

    if (!res.ok || !res.body) {
      clearTimeout(timeoutId)
      return { success: false, content: '', error: `API 错误：${res.status}` }
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    try {
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
              if (chunk.error) {
                return { success: false, content: fullContent, error: `流式错误：${chunk.error}` }
              }
              if (chunk.content) {
                fullContent += chunk.content
                onChunk?.(chunk.content)
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      }
    } finally {
      clearTimeout(timeoutId)
    }

    if (!fullContent) {
      return { success: false, content: '', error: '智能体返回为空' }
    }

    return { success: true, content: fullContent }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, content: '', error: '智能体执行超时' }
    }
    const message = err instanceof Error ? err.message : '未知错误'
    return { success: false, content: '', error: message }
  }
}

/* ── Persist work chat to filesystem via API ─────────── */

export function persistWorkChat(
  ticketId: string,
  prompt: string,
  response: string,
): void {
  const now = Date.now()
  const messages = [
    { id: generateId(), role: 'user' as const, content: prompt, timestamp: now },
    { id: generateId(), role: 'assistant' as const, content: response, timestamp: now + 1 },
  ]

  fetch(`/api/kanban/chat-history/${ticketId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  }).catch(() => { /* persist best-effort */ })
}
