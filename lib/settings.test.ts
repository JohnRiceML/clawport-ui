import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadSettings, saveSettings, hexToAccentFill } from './settings'

// Mock localStorage
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key]
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((k) => delete store[k])
  }),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true, writable: true })

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

describe('loadSettings', () => {
  it('returns defaults when nothing is stored', () => {
    const s = loadSettings()
    expect(s).toEqual({
      locale: 'zh-CN',
      accentColor: null,
      portalName: null,
      portalSubtitle: null,
      portalEmoji: null,
      portalIcon: null,
      iconBgHidden: false,
      emojiOnly: false,
      operatorName: null,
      agentOverrides: {},
    })
  })

  it('parses stored settings correctly', () => {
    store['clawport-settings'] = JSON.stringify({
      accentColor: '#3B82F6',
      portalName: 'HQ',
      portalSubtitle: 'Base',
      portalEmoji: '🚀',
      portalIcon: 'data:image/jpeg;base64,icon123',
      agentOverrides: { jarvis: { emoji: '🎯' } },
    })
    const s = loadSettings()
    expect(s.accentColor).toBe('#3B82F6')
    expect(s.portalName).toBe('HQ')
    expect(s.portalSubtitle).toBe('Base')
    expect(s.portalEmoji).toBe('🚀')
    expect(s.portalIcon).toBe('data:image/jpeg;base64,icon123')
    expect(s.agentOverrides.jarvis).toEqual({ emoji: '🎯' })
  })

  it('returns defaults for invalid JSON', () => {
    store['clawport-settings'] = 'not-json{{'
    const s = loadSettings()
    expect(s.accentColor).toBeNull()
    expect(s.agentOverrides).toEqual({})
  })

  it('handles partial/malformed data gracefully', () => {
    store['clawport-settings'] = JSON.stringify({
      accentColor: 42,
      portalName: true,
      agentOverrides: 'not-an-object',
    })
    const s = loadSettings()
    expect(s.accentColor).toBeNull()
    expect(s.portalName).toBeNull()
    expect(s.portalEmoji).toBeNull()
    expect(s.portalIcon).toBeNull()
    expect(s.agentOverrides).toEqual({})
  })
})

describe('saveSettings', () => {
  it('persists settings to localStorage', () => {
    const settings = {
      locale: 'auto' as const,
      accentColor: '#EF4444',
      portalName: 'Test',
      portalSubtitle: null,
      portalEmoji: null,
      portalIcon: null,
      iconBgHidden: false,
      emojiOnly: false,
      operatorName: null,
      agentOverrides: {},
    }
    saveSettings(settings)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'clawport-settings',
      JSON.stringify(settings),
    )
  })

  it('round-trips through load', () => {
    const settings = {
      locale: 'auto' as const,
      accentColor: '#22C55E',
      portalName: 'Green HQ',
      portalSubtitle: 'Ops Center',
      portalEmoji: '🏠',
      portalIcon: 'data:image/png;base64,test',
      iconBgHidden: false,
      emojiOnly: false,
      operatorName: null,
      agentOverrides: {
        vera: { emoji: '🧙', profileImage: 'data:image/jpeg;base64,abc' },
      },
    }
    saveSettings(settings)
    const loaded = loadSettings()
    expect(loaded).toEqual(settings)
  })
})

describe('hexToAccentFill', () => {
  it('converts gold hex to rgba at 0.15 alpha', () => {
    expect(hexToAccentFill('#F5C518')).toBe('rgba(245,197,24,0.15)')
  })

  it('converts blue hex correctly', () => {
    expect(hexToAccentFill('#3B82F6')).toBe('rgba(59,130,246,0.15)')
  })

  it('converts black hex correctly', () => {
    expect(hexToAccentFill('#000000')).toBe('rgba(0,0,0,0.15)')
  })

  it('converts white hex correctly', () => {
    expect(hexToAccentFill('#FFFFFF')).toBe('rgba(255,255,255,0.15)')
  })
})
