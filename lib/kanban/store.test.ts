import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadTickets,
  saveTickets,
  createTicket,
  updateTicket,
  moveTicket,
  deleteTicket,
  getTicketsByStatus,
  type KanbanStore,
} from './store'

// Mock localStorage
const storage: Record<string, string> = {}
beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, val: string) => { storage[key] = val },
    removeItem: (key: string) => { delete storage[key] },
  })
})

// Mock crypto.randomUUID
beforeEach(() => {
  let counter = 0
  vi.stubGlobal('crypto', {
    randomUUID: () => `test-uuid-${++counter}`,
  })
})

// Default work state fields for test tickets
const WORK_DEFAULTS = { workState: 'idle' as const, workStartedAt: null, workError: null, workResult: null, relevantFiles: [] as import('./types').RelevantFile[] }

describe('loadTickets', () => {
  it('returns empty object when nothing stored', () => {
    expect(loadTickets()).toEqual({})
  })

  it('returns parsed data from localStorage', () => {
    const data = { 'id-1': { id: 'id-1', title: 'Test' } }
    storage['clawport-kanban'] = JSON.stringify(data)
    const loaded = loadTickets()
    expect(loaded['id-1'].id).toBe('id-1')
    expect(loaded['id-1'].title).toBe('Test')
    // Backfilled work state fields
    expect(loaded['id-1'].workState).toBe('idle')
    expect(loaded['id-1'].workStartedAt).toBeNull()
    expect(loaded['id-1'].workError).toBeNull()
    expect(loaded['id-1'].useSessionMemory).toBe(false)
  })

  it('returns empty object on invalid JSON', () => {
    storage['clawport-kanban'] = 'not-json'
    expect(loadTickets()).toEqual({})
  })
})

describe('saveTickets', () => {
  it('persists to localStorage', () => {
    const store: KanbanStore = {}
    saveTickets(store)
    expect(storage['clawport-kanban']).toBe('{}')
  })
})

describe('createTicket', () => {
  it('adds a ticket with generated id and timestamps', () => {
    const store: KanbanStore = {}
    const result = createTicket(store, {
      title: 'New ticket',
      description: 'Do the thing',
      useSessionMemory: true,
      relevantFiles: [],
      status: 'backlog',
      priority: 'medium',
      assigneeId: null,
      assigneeRole: null,
    })

    const ticket = result['test-uuid-1']
    expect(ticket).toBeDefined()
    expect(ticket.title).toBe('New ticket')
    expect(ticket.status).toBe('backlog')
    expect(ticket.useSessionMemory).toBe(true)
    expect(ticket.id).toBe('test-uuid-1')
    expect(ticket.createdAt).toBeTypeOf('number')
    expect(ticket.updatedAt).toBe(ticket.createdAt)
  })

  it('preserves existing tickets', () => {
    const store: KanbanStore = {
      existing: {
        id: 'existing',
        title: 'Existing',
        description: '',
        useSessionMemory: false,
        status: 'todo',
        priority: 'low',
        assigneeId: null,
        assigneeRole: null,
        ...WORK_DEFAULTS,
        createdAt: 1000,
        updatedAt: 1000,
      },
    }
    const result = createTicket(store, {
      title: 'New',
      description: '',
      useSessionMemory: false,
      relevantFiles: [],
      status: 'backlog',
      priority: 'medium',
      assigneeId: null,
      assigneeRole: null,
    })
    expect(result['existing']).toBeDefined()
    expect(Object.keys(result)).toHaveLength(2)
  })
})

describe('updateTicket', () => {
  const baseStore: KanbanStore = {
    't1': {
      id: 't1',
      title: 'Original',
      description: 'Desc',
      useSessionMemory: false,
      status: 'backlog',
      priority: 'low',
      assigneeId: null,
      assigneeRole: null,
      ...WORK_DEFAULTS,
      createdAt: 1000,
      updatedAt: 1000,
    },
  }

  it('updates specified fields', () => {
    const result = updateTicket(baseStore, 't1', { title: 'Updated' })
    expect(result['t1'].title).toBe('Updated')
    expect(result['t1'].description).toBe('Desc')
    expect(result['t1'].updatedAt).toBeGreaterThan(1000)
  })

  it('returns store unchanged for missing ticket', () => {
    const result = updateTicket(baseStore, 'missing', { title: 'X' })
    expect(result).toBe(baseStore)
  })
})

describe('moveTicket', () => {
  it('changes ticket status', () => {
    const store: KanbanStore = {
      't1': {
        id: 't1',
        title: 'Task',
        description: '',
        useSessionMemory: false,
        status: 'backlog',
        priority: 'medium',
        assigneeId: null,
        assigneeRole: null,
        ...WORK_DEFAULTS,
        createdAt: 1000,
        updatedAt: 1000,
      },
    }
    const result = moveTicket(store, 't1', 'in-progress')
    expect(result['t1'].status).toBe('in-progress')
  })
})

describe('deleteTicket', () => {
  it('removes the ticket', () => {
    const store: KanbanStore = {
      't1': {
        id: 't1',
        title: 'Task',
        description: '',
        useSessionMemory: false,
        status: 'backlog',
        priority: 'medium',
        assigneeId: null,
        assigneeRole: null,
        ...WORK_DEFAULTS,
        createdAt: 1000,
        updatedAt: 1000,
      },
    }
    const result = deleteTicket(store, 't1')
    expect(result['t1']).toBeUndefined()
  })

  it('preserves other tickets', () => {
    const store: KanbanStore = {
      't1': {
        id: 't1', title: 'A', description: '', status: 'backlog',
        useSessionMemory: false, priority: 'low', assigneeId: null, assigneeRole: null,
        ...WORK_DEFAULTS, createdAt: 1000, updatedAt: 1000,
      },
      't2': {
        id: 't2', title: 'B', description: '', status: 'todo',
        useSessionMemory: false, priority: 'high', assigneeId: null, assigneeRole: null,
        ...WORK_DEFAULTS, createdAt: 2000, updatedAt: 2000,
      },
    }
    const result = deleteTicket(store, 't1')
    expect(result['t2']).toBeDefined()
    expect(Object.keys(result)).toHaveLength(1)
  })
})

describe('getTicketsByStatus', () => {
  const store: KanbanStore = {
    't1': {
      id: 't1', title: 'Old', description: '', status: 'backlog',
      useSessionMemory: false, priority: 'low', assigneeId: null, assigneeRole: null,
      ...WORK_DEFAULTS, createdAt: 1000, updatedAt: 1000,
    },
    't2': {
      id: 't2', title: 'New', description: '', status: 'backlog',
      useSessionMemory: false, priority: 'medium', assigneeId: null, assigneeRole: null,
      ...WORK_DEFAULTS, createdAt: 2000, updatedAt: 3000,
    },
    't3': {
      id: 't3', title: 'Other', description: '', status: 'todo',
      useSessionMemory: false, priority: 'high', assigneeId: null, assigneeRole: null,
      ...WORK_DEFAULTS, createdAt: 1500, updatedAt: 1500,
    },
  }

  it('filters by status', () => {
    const backlog = getTicketsByStatus(store, 'backlog')
    expect(backlog).toHaveLength(2)
    expect(backlog.every((t) => t.status === 'backlog')).toBe(true)
  })

  it('sorts by updatedAt descending', () => {
    const backlog = getTicketsByStatus(store, 'backlog')
    expect(backlog[0].id).toBe('t2')
    expect(backlog[1].id).toBe('t1')
  })

  it('returns empty array for empty column', () => {
    expect(getTicketsByStatus(store, 'done')).toEqual([])
  })
})
