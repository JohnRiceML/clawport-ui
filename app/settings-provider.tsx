'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Agent } from '@/lib/types'
import {
  type ClawPortSettings,
  type AgentOverride,
  DEFAULTS,
  loadSettings,
  saveSettings,
  hexToAccentFill,
  hexToContrastText,
} from '@/lib/settings'
import {
  getCopy,
  resolveLocale,
  type Copy,
  type LocalePreference,
  type SupportedLocale,
} from '@/lib/i18n'

interface AgentDisplay {
  emoji: string
  profileImage?: string
  emojiOnly?: boolean
}

interface SettingsContextValue {
  settings: ClawPortSettings
  locale: LocalePreference
  resolvedLocale: SupportedLocale
  copy: Copy
  setAccentColor: (color: string | null) => void
  setLocale: (locale: LocalePreference) => void
  setPortalName: (name: string | null) => void
  setPortalSubtitle: (subtitle: string | null) => void
  setPortalEmoji: (emoji: string | null) => void
  setPortalIcon: (icon: string | null) => void
  setIconBgHidden: (hidden: boolean) => void
  setEmojiOnly: (emojiOnly: boolean) => void
  setOperatorName: (name: string | null) => void
  setAgentOverride: (agentId: string, override: AgentOverride) => void
  clearAgentOverride: (agentId: string) => void
  getAgentDisplay: (agent: Agent) => AgentDisplay
  setLiveStreamPosition: (pos: { x: number; y: number } | null) => void
  resetAll: () => void
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: { accentColor: null, locale: 'system', portalName: null, portalSubtitle: null, portalEmoji: null, portalIcon: null, iconBgHidden: false, emojiOnly: false, operatorName: null, agentOverrides: {}, liveStreamPosition: null },
  locale: 'system',
  resolvedLocale: 'en',
  copy: getCopy('en'),
  setAccentColor: () => {},
  setLocale: () => {},
  setPortalName: () => {},
  setPortalSubtitle: () => {},
  setPortalEmoji: () => {},
  setPortalIcon: () => {},
  setIconBgHidden: () => {},
  setEmojiOnly: () => {},
  setOperatorName: () => {},
  setAgentOverride: () => {},
  clearAgentOverride: () => {},
  getAgentDisplay: (agent) => ({ emoji: agent.emoji }),
  setLiveStreamPosition: () => {},
  resetAll: () => {},
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Initialize with defaults so server and client render the same HTML.
  // Hydrate from localStorage after mount to avoid hydration mismatch.
  const [settings, setSettings] = useState<ClawPortSettings>({ ...DEFAULTS })

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  const locale = settings.locale
  const resolvedLocale = resolveLocale(locale, {
    language: typeof navigator === 'undefined' ? undefined : navigator.language,
    languages: typeof navigator === 'undefined' ? undefined : navigator.languages,
  })
  const copy = getCopy(resolvedLocale)

  useEffect(() => {
    document.documentElement.lang = resolvedLocale
  }, [resolvedLocale])

  // Apply accent color CSS variables when settings change
  useEffect(() => {
    const el = document.documentElement.style
    if (settings.accentColor) {
      el.setProperty('--accent', settings.accentColor)
      el.setProperty('--accent-fill', hexToAccentFill(settings.accentColor))
      el.setProperty('--accent-contrast', hexToContrastText(settings.accentColor))
    } else {
      el.removeProperty('--accent')
      el.removeProperty('--accent-fill')
      el.removeProperty('--accent-contrast')
    }
  }, [settings.accentColor])

  const update = useCallback((next: ClawPortSettings) => {
    setSettings(next)
    saveSettings(next)
  }, [])

  const setAccentColor = useCallback(
    (color: string | null) => {
      update({ ...settings, accentColor: color })
    },
    [settings, update],
  )

  const setLocale = useCallback(
    (localePreference: LocalePreference) => {
      update({ ...settings, locale: localePreference })
    },
    [settings, update],
  )

  const setPortalName = useCallback(
    (name: string | null) => {
      update({ ...settings, portalName: name || null })
    },
    [settings, update],
  )

  const setPortalSubtitle = useCallback(
    (subtitle: string | null) => {
      update({ ...settings, portalSubtitle: subtitle || null })
    },
    [settings, update],
  )

  const setPortalEmoji = useCallback(
    (emoji: string | null) => {
      update({ ...settings, portalEmoji: emoji || null })
    },
    [settings, update],
  )

  const setPortalIcon = useCallback(
    (icon: string | null) => {
      update({ ...settings, portalIcon: icon })
    },
    [settings, update],
  )

  const setIconBgHidden = useCallback(
    (hidden: boolean) => {
      update({ ...settings, iconBgHidden: hidden })
    },
    [settings, update],
  )

  const setEmojiOnly = useCallback(
    (emojiOnly: boolean) => {
      update({ ...settings, emojiOnly })
    },
    [settings, update],
  )

  const setOperatorName = useCallback(
    (name: string | null) => {
      update({ ...settings, operatorName: name || null })
    },
    [settings, update],
  )

  const setAgentOverride = useCallback(
    (agentId: string, override: AgentOverride) => {
      const existing = settings.agentOverrides[agentId] || {}
      update({
        ...settings,
        agentOverrides: {
          ...settings.agentOverrides,
          [agentId]: { ...existing, ...override },
        },
      })
    },
    [settings, update],
  )

  const clearAgentOverride = useCallback(
    (agentId: string) => {
      const { [agentId]: _, ...rest } = settings.agentOverrides
      update({ ...settings, agentOverrides: rest })
    },
    [settings, update],
  )

  const setLiveStreamPosition = useCallback(
    (pos: { x: number; y: number } | null) => {
      update({ ...settings, liveStreamPosition: pos })
    },
    [settings, update],
  )

  const getAgentDisplay = useCallback(
    (agent: Agent): AgentDisplay => {
      const override = settings.agentOverrides[agent.id]
      return {
        emoji: override?.emoji || agent.emoji,
        profileImage: override?.profileImage,
        emojiOnly: settings.emojiOnly,
      }
    },
    [settings.agentOverrides, settings.emojiOnly],
  )

  const resetAll = useCallback(() => {
    const defaults: ClawPortSettings = {
      accentColor: null,
      locale: 'system',
      portalName: null,
      portalSubtitle: null,
      portalEmoji: null,
      portalIcon: null,
      iconBgHidden: false,
      emojiOnly: false,
      operatorName: null,
      agentOverrides: {},
      liveStreamPosition: null,
    }
    update(defaults)
  }, [update])

  return (
    <SettingsContext.Provider
      value={{
        settings,
        locale,
        resolvedLocale,
        copy,
        setAccentColor,
        setLocale,
        setPortalName,
        setPortalSubtitle,
        setPortalEmoji,
        setPortalIcon,
        setIconBgHidden,
        setEmojiOnly,
        setOperatorName,
        setAgentOverride,
        clearAgentOverride,
        getAgentDisplay,
        setLiveStreamPosition,
        resetAll,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
