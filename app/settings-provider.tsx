'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react'
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
import { detectLocale, translate, type Locale, type LocalePreference } from '@/lib/i18n'

interface AgentDisplay {
  emoji: string
  profileImage?: string
  emojiOnly?: boolean
}

interface SettingsContextValue {
  settings: ClawPortSettings
  resolvedLocale: Locale
  setLocale: (locale: LocalePreference) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  setAccentColor: (color: string | null) => void
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
  resetAll: () => void
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: { locale: 'zh-CN', accentColor: null, portalName: null, portalSubtitle: null, portalEmoji: null, portalIcon: null, iconBgHidden: false, emojiOnly: false, operatorName: null, agentOverrides: {} },
  resolvedLocale: 'zh-CN',
  setLocale: () => {},
  t: (key) => key,
  setAccentColor: () => {},
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
  resetAll: () => {},
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Initialize with defaults so server and client render the same HTML.
  // Hydrate from localStorage after mount to avoid hydration mismatch.
  const [settings, setSettings] = useState<ClawPortSettings>({ ...DEFAULTS })
  const [resolvedLocale, setResolvedLocale] = useState<Locale>('zh-CN')

  useLayoutEffect(() => {
    const loaded = loadSettings()
    setSettings(loaded)
    const locale =
      loaded.locale === 'auto'
        ? detectLocale(
            typeof navigator === 'undefined' ? [] : navigator.languages,
            typeof navigator === 'undefined' ? undefined : navigator.language,
          )
        : loaded.locale
    setResolvedLocale(locale)
    document.documentElement.lang = locale
    document.documentElement.dataset.locale = locale
    document.documentElement.dataset.localePreference = loaded.locale
  }, [])

  useLayoutEffect(() => {
    const locale =
      settings.locale === 'auto'
        ? detectLocale(
            typeof navigator === 'undefined' ? [] : navigator.languages,
            typeof navigator === 'undefined' ? undefined : navigator.language,
          )
        : settings.locale
    setResolvedLocale(locale)
    document.documentElement.lang = locale
    document.documentElement.dataset.locale = locale
    document.documentElement.dataset.localePreference = settings.locale
  }, [settings.locale])

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
    update(defaults)
  }, [update])

  const setLocale = useCallback(
    (locale: LocalePreference) => {
      update({ ...settings, locale })
    },
    [settings, update],
  )

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(resolvedLocale, key, vars),
    [resolvedLocale],
  )

  return (
    <SettingsContext.Provider
      value={{
        settings,
        resolvedLocale,
        setLocale,
        t,
        setAccentColor,
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
        resetAll,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
