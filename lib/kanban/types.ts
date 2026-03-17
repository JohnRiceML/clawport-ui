// Kanban board types

export interface RelevantFile {
  id: string        // Google Drive file ID
  name: string      // Display name
  mimeType: string  // e.g. 'application/vnd.google-apps.document'
  url: string       // Google Drive web URL
}

export type TicketStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done'

export type TicketPriority = 'low' | 'medium' | 'high'

export type TeamRole = 'lead-dev' | 'ux-ui' | 'qa'

export type WorkState = 'idle' | 'starting' | 'working' | 'done' | 'failed'

export interface KanbanTicket {
  id: string
  title: string
  description: string
  useSessionMemory: boolean
  relevantFiles: RelevantFile[]
  status: TicketStatus
  priority: TicketPriority
  assigneeId: string | null   // agent id from agents.json
  assigneeRole: TeamRole | null
  workState: WorkState
  workStartedAt: number | null
  workError: string | null
  workResult: string | null
  createdAt: number
  updatedAt: number
}

export interface KanbanColumn {
  id: TicketStatus
  title: string
}

export const COLUMNS: KanbanColumn[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
]

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'var(--system-green)',
  medium: 'var(--system-orange)',
  high: 'var(--system-red)',
}

export const ROLE_LABELS: Record<TeamRole, string> = {
  'lead-dev': 'Lead Dev',
  'ux-ui': 'UX/UI Lead',
  'qa': 'QA',
}
