import type { LocalePreference } from '@/lib/i18n'

// Settings types + localStorage helpers for ClawPort

export interface AgentOverride {
  emoji?: string
  profileImage?: string // base64 data URL
}

export interface ClawPortSettings {
  locale: LocalePreference
  accentColor: string | null
  portalName: string | null
  portalSubtitle: string | null
  portalEmoji: string | null
  portalIcon: string | null // base64 data URL for custom icon image
  iconBgHidden: boolean // hide colored background on sidebar logo
  emojiOnly: boolean // show emoji avatars without colored background
  operatorName: string | null
  agentOverrides: Record<string, AgentOverride>
}

const STORAGE_KEY = 'clawport-settings'
const LEGACY_KEY = 'manor-settings'

export const DEFAULTS: ClawPortSettings = {
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
}

export function loadSettings(): ClawPortSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    let raw = localStorage.getItem(STORAGE_KEY)
    // Migrate from legacy key
    if (!raw) {
      raw = localStorage.getItem(LEGACY_KEY)
      if (raw) {
        localStorage.setItem(STORAGE_KEY, raw)
        localStorage.removeItem(LEGACY_KEY)
      }
    }
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return {
      locale: parsed.locale === 'zh-CN' || parsed.locale === 'en' ? parsed.locale : 'auto',
      accentColor: typeof parsed.accentColor === 'string' ? parsed.accentColor : null,
      portalName: typeof parsed.portalName === 'string' ? parsed.portalName : typeof parsed.manorName === 'string' ? parsed.manorName : null,
      portalSubtitle: typeof parsed.portalSubtitle === 'string' ? parsed.portalSubtitle : typeof parsed.manorSubtitle === 'string' ? parsed.manorSubtitle : null,
      portalEmoji: typeof parsed.portalEmoji === 'string' ? parsed.portalEmoji : typeof parsed.manorEmoji === 'string' ? parsed.manorEmoji : null,
      portalIcon: typeof parsed.portalIcon === 'string' ? parsed.portalIcon : typeof parsed.manorIcon === 'string' ? parsed.manorIcon : null,
      iconBgHidden: typeof parsed.iconBgHidden === 'boolean' ? parsed.iconBgHidden : false,
      emojiOnly: typeof parsed.emojiOnly === 'boolean' ? parsed.emojiOnly : false,
      operatorName: typeof parsed.operatorName === 'string' ? parsed.operatorName : null,
      agentOverrides:
        parsed.agentOverrides && typeof parsed.agentOverrides === 'object'
          ? parsed.agentOverrides
          : {},
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: ClawPortSettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {}
}

/** Convert hex color to rgba at 0.15 alpha for accent-fill backgrounds */
export function hexToAccentFill(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.15)`
}

/** Return '#fff' or '#000' depending on which has better contrast against the given hex color */
export function hexToContrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  // sRGB luminance (WCAG 2.0)
  const lum =
    0.2126 * (r <= 0.03928 ? r / 12.92 : ((r + 0.055) / 1.055) ** 2.4) +
    0.7152 * (g <= 0.03928 ? g / 12.92 : ((g + 0.055) / 1.055) ** 2.4) +
    0.0722 * (b <= 0.03928 ? b / 12.92 : ((b + 0.055) / 1.055) ** 2.4)
  return lum > 0.4 ? '#000' : '#fff'
}
