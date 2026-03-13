import type { Agent } from './types'

export interface SlashCommand {
  name: string
  description: string
}

export const COMMANDS: SlashCommand[] = [
  { name: '/clear', description: 'Clear conversation history' },
  { name: '/help', description: 'Show available commands' },
  { name: '/info', description: 'Show agent profile summary' },
  { name: '/soul', description: "Show agent's SOUL.md persona" },
  { name: '/tools', description: "List agent's available tools" },
  { name: '/crons', description: "Show agent's scheduled jobs" },
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
      return { content: 'Conversation cleared.', action: 'clear' }

    case '/help':
      return {
        content: [
          '**Available commands**',
          '',
          ...COMMANDS.map(c => `\`${c.name}\` -- ${c.description}`),
          '',
          'Type `/` to see the command menu.',
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
          `Tools: ${agent.tools.length > 0 ? agent.tools.join(', ') : 'none'}`,
          `Cron jobs: ${agent.crons.length}`,
          agent.memoryPath ? `Memory: ${agent.memoryPath}` : 'Memory: not configured',
        ].join('\n'),
      }

    case '/soul': {
      if (!agent.soul) {
        return { content: `No SOUL.md found for ${agent.name}.` }
      }
      return { content: agent.soul }
    }

    case '/tools': {
      if (agent.tools.length === 0) {
        return { content: `${agent.name} has no tools configured.` }
      }
      return {
        content: [
          `**${agent.name}'s tools**`,
          '',
          ...agent.tools.map(t => `- ${t}`),
        ].join('\n'),
      }
    }

    case '/crons': {
      if (agent.crons.length === 0) {
        return { content: `${agent.name} has no scheduled jobs.` }
      }
      return {
        content: [
          `**${agent.name}'s scheduled jobs**`,
          '',
          ...agent.crons.map(c => {
            const status = c.enabled ? c.status : 'disabled'
            return `- **${c.name}** (${c.scheduleDescription}) -- ${status}`
          }),
        ].join('\n'),
      }
    }

    default:
      return { content: `Unknown command: ${command}` }
  }
}
