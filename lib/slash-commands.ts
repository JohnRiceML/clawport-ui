import type { Agent } from './types'

export interface SlashCommand {
  name: string
  description: string
}

export const COMMANDS: SlashCommand[] = [
  { name: '/clear', description: '清空会话历史' },
  { name: '/help', description: '显示可用命令' },
  { name: '/info', description: '显示智能体简介' },
  { name: '/soul', description: '显示智能体 SOUL.md 人设' },
  { name: '/tools', description: '列出智能体可用工具' },
  { name: '/crons', description: '显示智能体计划任务' },
]

export interface ParsedCommand {
  command: string
  args: string
}

/** Returns true if input looks like the start of a slash command (leading `/`). */
export function isSlashInput(input: string): boolean {
  return input.trimStart().startsWith('/')
}

/** Parse a complete slash command from input. Returns null if not a valid command. */
export function parseSlashCommand(input: string): ParsedCommand | null {
  const trimmed = input.trimStart()
  if (!trimmed.startsWith('/')) return null

  const spaceIdx = trimmed.indexOf(' ')
  const command = spaceIdx === -1 ? trimmed.toLowerCase() : trimmed.slice(0, spaceIdx).toLowerCase()
  const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim()

  const match = COMMANDS.find(c => c.name === command)
  if (!match) return null

  return { command: match.name, args }
}

/** Return commands matching a partial input (e.g. "/cl" matches "/clear"). */
export function matchCommands(partial: string): SlashCommand[] {
  const trimmed = partial.trimStart().toLowerCase()
  if (!trimmed.startsWith('/')) return []

  // Show all commands for bare "/"
  if (trimmed === '/') return [...COMMANDS]

  return COMMANDS.filter(c => c.name.startsWith(trimmed))
}

/** Execute a slash command and return the formatted content string for a system message. */
export function executeCommand(command: string, agent: Agent): { content: string; action?: 'clear' } {
  switch (command) {
    case '/clear':
      return { content: '会话已清空。', action: 'clear' }

    case '/help':
      return {
        content: [
          '**可用命令**',
          '',
          ...COMMANDS.map(c => `\`${c.name}\` -- ${c.description}`),
          '',
          '输入 `/` 可打开命令菜单。',
        ].join('\n'),
      }

    case '/info':
      return {
        content: [
          `**${agent.name}**`,
          agent.title,
          '',
          agent.description,
          '',
          `工具：${agent.tools.length > 0 ? agent.tools.join(', ') : '无'}`,
          `计划任务：${agent.crons.length}`,
          agent.memoryPath ? `记忆路径：${agent.memoryPath}` : '记忆路径：未配置',
        ].join('\n'),
      }

    case '/soul': {
      if (!agent.soul) {
        return { content: `${agent.name} 未找到 SOUL.md。` }
      }
      return { content: agent.soul }
    }

    case '/tools': {
      if (agent.tools.length === 0) {
        return { content: `${agent.name} 未配置任何工具。` }
      }
      return {
        content: [
          `**${agent.name} 的工具**`,
          '',
          ...agent.tools.map(t => `- ${t}`),
        ].join('\n'),
      }
    }

    case '/crons': {
      if (agent.crons.length === 0) {
        return { content: `${agent.name} 没有计划任务。` }
      }
      return {
        content: [
          `**${agent.name} 的计划任务**`,
          '',
          ...agent.crons.map(c => {
            const status = c.enabled ? c.status : '已禁用'
            return `- **${c.name}** (${c.scheduleDescription}) -- ${status}`
          }),
        ].join('\n'),
      }
    }

    default:
      return { content: `未知命令：${command}` }
  }
}
