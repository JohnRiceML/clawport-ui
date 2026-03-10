'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRight, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import type { Agent } from '@/lib/types'
import { useSettings } from '@/app/settings-provider'
import { AgentAvatar } from '@/components/AgentAvatar'
import { OnboardingWizard } from '@/components/OnboardingWizard'

// ---------------------------------------------------------------------------
// Accent color presets
// ---------------------------------------------------------------------------

const ACCENT_PRESETS = [
  { label: '红色', value: '#EF4444' },
  { label: '金色', value: '#F5C518' },
  { label: '蓝色', value: '#3B82F6' },
  { label: '绿色', value: '#22C55E' },
  { label: '橙色', value: '#F97316' },
  { label: '紫色', value: '#A855F7' },
  { label: '粉色', value: '#EC4899' },
  { label: '青绿色', value: '#14B8A6' },
  { label: '青色', value: '#06B6D4' },
  { label: '靛蓝', value: '#6366F1' },
  { label: '玫红', value: '#F43F5E' },
  { label: '黄绿色', value: '#84CC16' },
]

// ---------------------------------------------------------------------------
// Image resize helper (Canvas API → 200px max dimension, base64 JPEG)
// ---------------------------------------------------------------------------

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const {
    settings,
    setLocale,
    t,
    setAccentColor,
    setPortalName,
    setPortalSubtitle,
    setOperatorName,
    setPortalEmoji,
    setPortalIcon,
    setIconBgHidden,
    setEmojiOnly,
    setAgentOverride,
    clearAgentOverride,
    resetAll,
  } = useSettings()

  const [wizardOpen, setWizardOpen] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [nameValue, setNameValue] = useState(settings.portalName ?? '')
  const [subtitleValue, setSubtitleValue] = useState(settings.portalSubtitle ?? '')
  const [operatorNameValue, setOperatorNameValue] = useState(settings.operatorName ?? '')
  const [emojiValue, setEmojiValue] = useState(settings.portalEmoji ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const portalIconInputRef = useRef<HTMLInputElement>(null)

  // Sync local input values when settings change externally (e.g., reset)
  useEffect(() => {
    setNameValue(settings.portalName ?? '')
    setSubtitleValue(settings.portalSubtitle ?? '')
    setOperatorNameValue(settings.operatorName ?? '')
    setEmojiValue(settings.portalEmoji ?? '')
  }, [settings.portalName, settings.portalSubtitle, settings.operatorName, settings.portalEmoji])

  // Fetch agents
  useEffect(() => {
    fetch('/api/agents')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: unknown) => {
        if (Array.isArray(data)) setAgents(data as Agent[])
      })
      .catch(() => setAgents([]))
  }, [])

  async function handleIconUpload(file: File) {
    try {
      const dataUrl = await resizeImage(file, 200)
      setPortalIcon(dataUrl)
    } catch {
      // silently fail — user can retry
    }
  }

  async function handleImageUpload(agentId: string, file: File) {
    try {
      const dataUrl = await resizeImage(file, 200)
      setAgentOverride(agentId, { profileImage: dataUrl })
    } catch {
      // silently fail — user can retry
    }
  }

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: 'var(--bg)' }}
    >
      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          padding: 'var(--space-6) var(--space-4) var(--space-12)',
        }}
      >
        {/* Page header */}
        <h1
          style={{
            fontSize: 'var(--text-title1)',
            fontWeight: 'var(--weight-bold)',
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--text-primary)',
            margin: '0 0 var(--space-8)',
          }}
        >
          {t('settings.title')}
        </h1>

        {/* ── Section 1: Accent Color ── */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <div
            style={{
              fontSize: 'var(--text-caption1)',
              fontWeight: 'var(--weight-semibold)',
              letterSpacing: 'var(--tracking-wide)',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              padding: '0 var(--space-4) var(--space-2)',
            }}
          >
            {t('settings.accentColor')}
          </div>
          <div
            style={{
              background: 'var(--material-regular)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--separator)',
              padding: 'var(--space-4)',
            }}
          >
            {/* Preset swatches */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-3)',
              }}
            >
              {ACCENT_PRESETS.map((preset) => {
                const isActive = settings.accentColor === preset.value
                return (
                  <button
                    key={preset.value}
                    onClick={() => setAccentColor(preset.value)}
                    aria-label={preset.label}
                    title={preset.label}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: preset.value,
                      border: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
                      outline: isActive ? `2px solid ${preset.value}` : 'none',
                      outlineOffset: 2,
                      cursor: 'pointer',
                      transition: 'all 100ms var(--ease-smooth)',
                    }}
                  />
                )
              })}
            </div>

            {/* Custom color picker + Reset */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--text-footnote)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {t('settings.custom')}:
                <input
                  type="color"
                  value={settings.accentColor ?? '#F5C518'}
                  onChange={(e) => setAccentColor(e.target.value)}
                  style={{
                    width: 28,
                    height: 28,
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    background: 'none',
                    padding: 0,
                  }}
                />
              </label>
              {settings.accentColor && (
                <button
                  onClick={() => setAccentColor(null)}
                  style={{
                    fontSize: 'var(--text-footnote)',
                    color: 'var(--system-blue)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <RotateCcw size={12} />
                  {t('settings.resetDefault')}
                </button>
              )}
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 'var(--space-8)' }}>
          <div
            style={{
              fontSize: 'var(--text-caption1)',
              fontWeight: 'var(--weight-semibold)',
              letterSpacing: 'var(--tracking-wide)',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              padding: '0 var(--space-4) var(--space-2)',
            }}
          >
            {t('settings.language')}
          </div>
          <div
            style={{
              background: 'var(--material-regular)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--separator)',
              padding: 'var(--space-3)',
              display: 'flex',
              gap: 'var(--space-2)',
            }}
          >
            {[
              { value: 'auto', label: t('settings.languageAuto') },
              { value: 'en', label: t('settings.languageEnglish') },
              { value: 'zh-CN', label: t('settings.languageChinese') },
            ].map((option) => {
              const active = settings.locale === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => setLocale(option.value as 'auto' | 'en' | 'zh-CN')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '999px',
                    border: 'none',
                    cursor: 'pointer',
                    background: active ? 'var(--accent-fill)' : 'var(--fill-quaternary)',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 'var(--text-footnote)',
                    fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-medium)',
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Section 2: Branding ── */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <div
            style={{
              fontSize: 'var(--text-caption1)',
              fontWeight: 'var(--weight-semibold)',
              letterSpacing: 'var(--tracking-wide)',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              padding: '0 var(--space-4) var(--space-2)',
            }}
          >
            {t('settings.branding')}
          </div>
          <div
            style={{
              background: 'var(--material-regular)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--separator)',
              overflow: 'hidden',
            }}
          >
            {/* Name field */}
            <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-caption1)',
                  color: 'var(--text-tertiary)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                {t('settings.name')}
              </label>
              <input
                type="text"
                className="apple-input"
                placeholder="指挥中心"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={() => setPortalName(nameValue || null)}
                style={{
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--separator)',
                }}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--separator)' }} />

            {/* Subtitle field */}
            <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-caption1)',
                  color: 'var(--text-tertiary)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                {t('onboarding.subtitle')}
              </label>
              <input
                type="text"
                className="apple-input"
                placeholder={t('app.commandCentre')}
                value={subtitleValue}
                onChange={(e) => setSubtitleValue(e.target.value)}
                onBlur={() => setPortalSubtitle(subtitleValue || null)}
                style={{
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--separator)',
                }}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--separator)' }} />

            {/* Your Name field */}
            <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-caption1)',
                  color: 'var(--text-tertiary)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                {t('onboarding.yourName')}
              </label>
              <input
                type="text"
                className="apple-input"
                placeholder={t('onboarding.yourName')}
                value={operatorNameValue}
                onChange={(e) => setOperatorNameValue(e.target.value)}
                onBlur={() => setOperatorName(operatorNameValue || null)}
                style={{
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--separator)',
                }}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--separator)' }} />

            {/* Logo / Icon — emoji or image */}
            <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-caption1)',
                  color: 'var(--text-tertiary)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                {t('settings.logoIcon')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                {/* Live preview */}
                {settings.portalIcon ? (
                  <img
                    src={settings.portalIcon}
                    alt={t('settings.logoIcon')}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      objectFit: 'cover',
                      boxShadow: 'var(--shadow-card)',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: settings.iconBgHidden
                        ? 'transparent'
                        : settings.accentColor
                          ? `linear-gradient(135deg, ${settings.accentColor}, ${settings.accentColor}dd)`
                          : 'transparent',
                      boxShadow: settings.iconBgHidden ? 'none' : 'var(--shadow-card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: settings.iconBgHidden ? 28 : 18,
                      flexShrink: 0,
                    }}
                  >
                    {settings.portalEmoji ?? '\ud83e\udd9e'}
                  </div>
                )}

                {/* Emoji input */}
                <input
                  type="text"
                  className="apple-input"
                  placeholder={'\ud83e\udd9e'}
                  value={emojiValue}
                  onChange={(e) => setEmojiValue(e.target.value)}
                  onBlur={() => setPortalEmoji(emojiValue || null)}
                  style={{
                    width: 60,
                    textAlign: 'center',
                    fontSize: 'var(--text-title2)',
                    padding: '6px 8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--separator)',
                  }}
                />

                {/* Upload image button */}
                <button
                  onClick={() => portalIconInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--fill-tertiary)',
                    color: 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--text-footnote)',
                    flexShrink: 0,
                  }}
                >
                  <Upload size={14} />
                  {t('settings.uploadImage')}
                </button>
                <input
                  ref={portalIconInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleIconUpload(file)
                    e.target.value = ''
                  }}
                />

                {/* Clear overrides */}
                {(settings.portalIcon || settings.portalEmoji) && (
                  <button
                    onClick={() => {
                      setPortalIcon(null)
                      setPortalEmoji(null)
                    }}
                    aria-label={t('settings.resetDefault')}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'var(--fill-tertiary)',
                      color: 'var(--text-tertiary)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Hide background toggle — only relevant when no uploaded image */}
              {!settings.portalIcon && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 'var(--space-3)',
                    paddingTop: 'var(--space-3)',
                    borderTop: '1px solid var(--separator)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--text-footnote)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {t('settings.hideBackground')}
                  </span>
                  <button
                    role="switch"
                    aria-checked={settings.iconBgHidden}
                    onClick={() => setIconBgHidden(!settings.iconBgHidden)}
                    className="focus-ring"
                    style={{
                      width: 51,
                      height: 31,
                      borderRadius: 16,
                      background: settings.iconBgHidden ? 'var(--system-green)' : 'var(--fill-primary)',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      flexShrink: 0,
                      transition: 'background 200ms var(--ease-smooth)',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: settings.iconBgHidden ? 22 : 2,
                        width: 27,
                        height: 27,
                        borderRadius: '50%',
                        background: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'left 200ms var(--ease-spring)',
                      }}
                    />
                  </button>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--separator)' }} />

            {/* Emoji-only avatar toggle */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 'var(--text-body)',
                    fontWeight: 'var(--weight-medium)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {t('settings.emojiOnlyAvatars')}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-caption1)',
                    color: 'var(--text-tertiary)',
                    marginTop: 1,
                  }}
                >
                  {t('settings.emojiOnlyHint')}
                </div>
              </div>
              <button
                role="switch"
                aria-checked={settings.emojiOnly}
                onClick={() => setEmojiOnly(!settings.emojiOnly)}
                className="focus-ring"
                style={{
                  width: 51,
                  height: 31,
                  borderRadius: 16,
                  background: settings.emojiOnly ? 'var(--system-green)' : 'var(--fill-primary)',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  flexShrink: 0,
                  transition: 'background 200ms var(--ease-smooth)',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: settings.emojiOnly ? 22 : 2,
                    width: 27,
                    height: 27,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'left 200ms var(--ease-spring)',
                  }}
                />
              </button>
            </div>
          </div>
        </section>

        {/* ── Section 3: Agent Customization ── */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <div
            style={{
              fontSize: 'var(--text-caption1)',
              fontWeight: 'var(--weight-semibold)',
              letterSpacing: 'var(--tracking-wide)',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              padding: '0 var(--space-4) var(--space-2)',
            }}
          >
            {t('settings.agentCustomization')}
          </div>
          <div
            style={{
              background: 'var(--material-regular)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--separator)',
              overflow: 'hidden',
            }}
          >
            {agents.map((agent, idx) => {
              const isExpanded = expandedAgent === agent.id
              const override = settings.agentOverrides[agent.id]
              const hasOverride = override && (override.emoji || override.profileImage)

              return (
                <div key={agent.id}>
                  {idx > 0 && (
                    <div style={{ borderTop: '1px solid var(--separator)' }} />
                  )}

                  {/* Agent row — tap to expand */}
                  <button
                    onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3) var(--space-4)',
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <AgentAvatar agent={agent} size={32} borderRadius={9} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 'var(--text-body)',
                          fontWeight: 'var(--weight-medium)',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {agent.name}
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--text-caption1)',
                          color: 'var(--text-tertiary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {agent.title}
                      </div>
                    </div>
                    {hasOverride && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <ChevronRight
                      size={16}
                      style={{
                        color: 'var(--text-quaternary)',
                        flexShrink: 0,
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 150ms var(--ease-smooth)',
                      }}
                    />
                  </button>

                  {/* Expanded inline editor */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '0 var(--space-4) var(--space-4)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-3)',
                      }}
                    >
                      {/* Emoji override */}
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 'var(--text-caption1)',
                            color: 'var(--text-tertiary)',
                            marginBottom: 'var(--space-1)',
                          }}
                        >
                          {t('settings.customEmoji')}
                        </label>
                        <input
                          type="text"
                          className="apple-input"
                          placeholder={agent.emoji}
                          value={override?.emoji ?? ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setAgentOverride(agent.id, {
                              emoji: val || undefined,
                            })
                          }}
                          style={{
                            width: 80,
                            fontSize: 'var(--text-title2)',
                            textAlign: 'center',
                            padding: '6px 8px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--separator)',
                          }}
                        />
                      </div>

                      {/* Profile image upload */}
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 'var(--text-caption1)',
                            color: 'var(--text-tertiary)',
                            marginBottom: 'var(--space-1)',
                          }}
                        >
                          {t('settings.profileImage')}
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <button
                            onClick={() => {
                              fileInputRef.current?.click()
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-2)',
                              padding: 'var(--space-2) var(--space-3)',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--fill-tertiary)',
                              color: 'var(--text-secondary)',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 'var(--text-footnote)',
                            }}
                          >
                            <Upload size={14} />
                            {t('settings.upload')}
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleImageUpload(agent.id, file)
                              e.target.value = ''
                            }}
                          />
                          {override?.profileImage && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <img
                                src={override.profileImage}
                                alt={t('settings.preview')}
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  objectFit: 'cover',
                                }}
                              />
                              <button
                                onClick={() => setAgentOverride(agent.id, { profileImage: undefined })}
                                aria-label={t('settings.resetDefault')}
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  background: 'var(--fill-tertiary)',
                                  color: 'var(--text-tertiary)',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reset button */}
                      {hasOverride && (
                        <button
                          onClick={() => clearAgentOverride(agent.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            padding: 'var(--space-2) var(--space-3)',
                            borderRadius: 'var(--radius-sm)',
                            background: 'none',
                            color: 'var(--system-red)',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 'var(--text-footnote)',
                            alignSelf: 'flex-start',
                          }}
                        >
                          <RotateCcw size={14} />
                          {t('settings.resetDefault')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Section 4: Reset All ── */}
        <section>
          <div
            style={{
              background: 'var(--material-regular)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--separator)',
              padding: 'var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <button
              onClick={() => setWizardOpen(true)}
              className="btn-scale"
              style={{
                padding: 'var(--space-2) var(--space-6)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent)',
                color: 'var(--accent-contrast)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-body)',
                fontWeight: 'var(--weight-semibold)',
                transition: 'all 150ms var(--ease-spring)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <RotateCcw size={16} />
              {t('settings.rerunSetup')}
            </button>
            <button
              onClick={() => {
                if (window.confirm(t('settings.resetAllConfirm'))) {
                  resetAll()
                }
              }}
              className="btn-scale"
              style={{
                padding: 'var(--space-2) var(--space-6)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--system-red)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-body)',
                fontWeight: 'var(--weight-semibold)',
                transition: 'all 150ms var(--ease-spring)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <Trash2 size={16} />
              {t('settings.resetAllSettings')}
            </button>
          </div>
        </section>

        {wizardOpen && (
          <OnboardingWizard forceOpen onClose={() => setWizardOpen(false)} />
        )}
      </div>
    </div>
  )
}
