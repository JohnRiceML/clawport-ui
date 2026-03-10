'use client'

import { useCallback, useEffect, useState } from 'react'
import { Map, MessageSquare, Columns3, Clock, Brain, Mic, Check, Keyboard, AlertCircle, Loader2, CheckCircle2, XCircle, ArrowLeft, ArrowRight, Rocket, RotateCcw } from 'lucide-react'
import { useSettings } from '@/app/settings-provider'
import { useTheme } from '@/app/providers'
import { THEMES } from '@/lib/themes'
import type { ThemeId } from '@/lib/themes'

// ---------------------------------------------------------------------------
// Accent color presets (same as settings page)
// ---------------------------------------------------------------------------

const ACCENT_PRESETS = [
  { label: 'Red', value: '#EF4444' },
  { label: 'Gold', value: '#F5C518' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Green', value: '#22C55E' },
  { label: 'Orange', value: '#F97316' },
  { label: 'Purple', value: '#A855F7' },
  { label: 'Pink', value: '#EC4899' },
  { label: 'Teal', value: '#14B8A6' },
  { label: 'Cyan', value: '#06B6D4' },
  { label: 'Indigo', value: '#6366F1' },
  { label: 'Rose', value: '#F43F5E' },
  { label: 'Lime', value: '#84CC16' },
]

// ---------------------------------------------------------------------------
// Feature cards for overview step
// ---------------------------------------------------------------------------

const FEATURES = [
  { icon: Map, name: 'Agent Map', desc: 'Visual org chart of all your AI agents' },
  { icon: MessageSquare, name: 'Chat', desc: 'Direct conversations with any agent' },
  { icon: Columns3, name: 'Kanban', desc: 'Task board for agent work management' },
  { icon: Clock, name: 'Crons', desc: 'Scheduled jobs with status monitoring' },
  { icon: Brain, name: 'Memory', desc: 'Shared context and knowledge files' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  if (!name.trim()) return '??'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ---------------------------------------------------------------------------
// Types for system check
// ---------------------------------------------------------------------------

interface SystemCheckAgent {
  id: string
  name: string
  emoji: string
  title: string
}

type CheckStatus = 'loading' | 'ok' | 'error'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OnboardingWizardProps {
  forceOpen?: boolean
  onClose?: () => void
}

export function OnboardingWizard({ forceOpen, onClose }: OnboardingWizardProps) {
  const {
    settings,
    setPortalName,
    setPortalSubtitle,
    setOperatorName,
    setAccentColor,
  } = useSettings()
  const { theme, setTheme } = useTheme()

  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  // Local input values
  const [localName, setLocalName] = useState('')
  const [localSubtitle, setLocalSubtitle] = useState('')
  const [localOperator, setLocalOperator] = useState('')

  // System check state
  const [agentsStatus, setAgentsStatus] = useState<CheckStatus>('loading')
  const [cronsStatus, setCronsStatus] = useState<CheckStatus>('loading')
  const [agents, setAgents] = useState<SystemCheckAgent[]>([])
  const [agentsError, setAgentsError] = useState<string | null>(null)
  const [cronsError, setCronsError] = useState<string | null>(null)

  // First-run detection — check both localStorage and server
  useEffect(() => {
    if (forceOpen) {
      setLocalName(settings.portalName ?? '')
      setLocalSubtitle(settings.portalSubtitle ?? '')
      setLocalOperator(settings.operatorName ?? '')
      setVisible(true)
      return
    }
    if (typeof window !== 'undefined' && localStorage.getItem('clawport-onboarded')) {
      return // already onboarded locally
    }
    // Check server-side flag (covers cross-device scenario)
    fetch('/api/onboarded')
      .then(r => r.json())
      .then(data => {
        if (data.onboarded) {
          localStorage.setItem('clawport-onboarded', '1')
        } else {
          setVisible(true)
        }
      })
      .catch(() => setVisible(true))
  }, [forceOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Run system checks when we reach the system check step
  useEffect(() => {
    if (visible && step === 1) {
      runSystemChecks()
    }
  }, [visible, step]) // eslint-disable-line react-hooks/exhaustive-deps

  function runSystemChecks() {
    setAgentsStatus('loading')
    setCronsStatus('loading')
    setAgentsError(null)
    setCronsError(null)

    // Check agents
    fetch('/api/agents')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: unknown) => {
        if (Array.isArray(data) && data.length > 0) {
          setAgents(data.map((a: Record<string, unknown>) => ({
            id: String(a.id ?? ''),
            name: String(a.name ?? ''),
            emoji: String(a.emoji ?? ''),
            title: String(a.title ?? ''),
          })))
          setAgentsStatus('ok')
        } else {
          setAgentsError('No agents found. Check your agents.json or workspace config.')
          setAgentsStatus('error')
        }
      })
      .catch(() => {
        setAgentsError('Could not reach agent registry. Is the server running?')
        setAgentsStatus('error')
      })

    // Check crons (validates gateway + openclaw binary)
    fetch('/api/crons')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(() => {
        setCronsStatus('ok')
      })
      .catch(() => {
        setCronsError('Could not reach OpenClaw gateway. Run: openclaw gateway run')
        setCronsStatus('error')
      })
  }

  const TOTAL_STEPS = 7

  const handleNext = useCallback(() => {
    // Commit operator name on step 1 (system check)
    if (step === 1) {
      setOperatorName(localOperator || null)
    }
    // Commit dashboard name/subtitle on step 2 (naming step)
    if (step === 2) {
      setPortalName(localName || null)
      setPortalSubtitle(localSubtitle || null)
    }

    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1)
    } else {
      if (!forceOpen) {
        localStorage.setItem('clawport-onboarded', '1')
        fetch('/api/onboarded', { method: 'POST' }).catch(() => {})
      }
      setVisible(false)
      onClose?.()
    }
  }, [step, localName, localSubtitle, localOperator, forceOpen, onClose, setPortalName, setPortalSubtitle, setOperatorName])

  const handleBack = useCallback(() => {
    if (step > 0) setStep(step - 1)
  }, [step])

  if (!visible) return null

  const systemAllOk = agentsStatus === 'ok' && cronsStatus === 'ok'
  const systemLoading = agentsStatus === 'loading' || cronsStatus === 'loading'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%',
          maxWidth: 520,
          margin: '0 var(--space-4)',
          background: 'var(--material-regular)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--separator)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Step indicator dots */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          padding: 'var(--space-4) var(--space-4) 0',
        }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === step ? 'var(--accent)' : i < step ? 'var(--accent)' : 'var(--fill-tertiary)',
                opacity: i < step ? 0.5 : 1,
                transition: 'all 200ms var(--ease-smooth)',
              }}
            />
          ))}
        </div>

        {/* Step content */}
        <div style={{
          padding: 'var(--space-5) var(--space-5) var(--space-4)',
          overflowY: 'auto',
          flex: 1,
        }}>
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div key="step-0" className="animate-fade-in" style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 56,
                marginBottom: 'var(--space-3)',
                lineHeight: 1,
              }}>
                {settings.portalEmoji ?? '\ud83e\udd9e'}
              </div>
              <h2 style={{
                fontSize: 'var(--text-large-title)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-tight)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                Welcome to ClawPort
              </h2>
              <p style={{
                fontSize: 'var(--text-body)',
                color: 'var(--text-secondary)',
                lineHeight: 'var(--leading-relaxed)',
                maxWidth: 400,
                margin: '0 auto',
                marginBottom: 'var(--space-5)',
              }}>
                A visual command centre for your AI agent team.
                Built to give you direct, real-time access to every agent
                in your OpenClaw workspace.
              </p>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                textAlign: 'left',
              }}>
                {[
                  { emoji: '🗺️', title: 'Map & Chat', desc: 'Interactive agent org chart with direct messaging' },
                  { emoji: '⚡', title: 'Monitor', desc: 'Cron jobs, shared memory, and task management' },
                  { emoji: '🎨', title: 'Personalize', desc: 'Five themes, accent colors, and custom branding' },
                ].map(item => (
                  <div
                    key={item.title}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--fill-quaternary)',
                      border: '1px solid var(--separator)',
                    }}
                  >
                    <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{item.emoji}</span>
                    <div>
                      <div style={{
                        fontSize: 'var(--text-subheadline)',
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-primary)',
                      }}>
                        {item.title}
                      </div>
                      <div style={{
                        fontSize: 'var(--text-caption1)',
                        color: 'var(--text-tertiary)',
                        lineHeight: 'var(--leading-normal)',
                      }}>
                        {item.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p style={{
                fontSize: 'var(--text-caption1)',
                color: 'var(--text-quaternary)',
                marginTop: 'var(--space-4)',
              }}>
                Built by John Rice with Jarvis (OpenClaw AI)
              </p>
            </div>
          )}

          {/* Step 1: System Check */}
          {step === 1 && (
            <div key="step-1" className="animate-fade-in">
              <h2 style={{
                fontSize: 'var(--text-title1)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-tight)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-1)',
              }}>
                System Check
              </h2>
              <p style={{
                fontSize: 'var(--text-subheadline)',
                color: 'var(--text-tertiary)',
                marginBottom: 'var(--space-4)',
              }}>
                Verifying your OpenClaw connection...
              </p>

              {/* Your Name input */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-caption1)',
                  color: 'var(--text-tertiary)',
                  marginBottom: 'var(--space-1)',
                }}>
                  Your Name
                </label>
                <input
                  type="text"
                  className="apple-input"
                  placeholder="Your Name"
                  value={localOperator}
                  onChange={e => setLocalOperator(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--separator)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {/* Agent registry check */}
                <div style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--fill-quaternary)',
                  border: `1px solid ${agentsStatus === 'error' ? 'var(--system-red)' : 'var(--separator)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}>
                  {agentsStatus === 'loading' && <Loader2 size={18} style={{ color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />}
                  {agentsStatus === 'ok' && <CheckCircle2 size={18} style={{ color: 'var(--system-green)' }} />}
                  {agentsStatus === 'error' && <XCircle size={18} style={{ color: 'var(--system-red)' }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 'var(--text-subheadline)',
                      fontWeight: 'var(--weight-medium)',
                      color: 'var(--text-primary)',
                    }}>
                      Agent Registry
                    </div>
                    {agentsStatus === 'ok' && (
                      <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
                        {agents.length} agent{agents.length !== 1 ? 's' : ''} found
                      </div>
                    )}
                    {agentsError && (
                      <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--system-red)' }}>
                        {agentsError}
                      </div>
                    )}
                  </div>
                </div>

                {/* Gateway check */}
                <div style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--fill-quaternary)',
                  border: `1px solid ${cronsStatus === 'error' ? 'var(--system-red)' : 'var(--separator)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}>
                  {cronsStatus === 'loading' && <Loader2 size={18} style={{ color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />}
                  {cronsStatus === 'ok' && <CheckCircle2 size={18} style={{ color: 'var(--system-green)' }} />}
                  {cronsStatus === 'error' && <XCircle size={18} style={{ color: 'var(--system-red)' }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 'var(--text-subheadline)',
                      fontWeight: 'var(--weight-medium)',
                      color: 'var(--text-primary)',
                    }}>
                      OpenClaw Gateway
                    </div>
                    {cronsStatus === 'ok' && (
                      <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
                        Connected at localhost:18789
                      </div>
                    )}
                    {cronsError && (
                      <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--system-red)' }}>
                        {cronsError}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Agent roster */}
              {agentsStatus === 'ok' && agents.length > 0 && (
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <div style={{
                    fontSize: 'var(--text-caption2)',
                    color: 'var(--text-quaternary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                    marginBottom: 'var(--space-2)',
                  }}>
                    Your Agent Team
                  </div>
                  <div style={{
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--fill-quaternary)',
                    border: '1px solid var(--separator)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-2)',
                  }}>
                    {agents.map(a => (
                      <div
                        key={a.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--material-thin)',
                          border: '1px solid var(--separator)',
                          fontSize: 'var(--text-caption1)',
                        }}
                      >
                        <span>{a.emoji}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)' }}>{a.name}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{
                    fontSize: 'var(--text-caption1)',
                    color: 'var(--text-tertiary)',
                    marginTop: 'var(--space-2)',
                  }}>
                    Does this look like your team? If not, check your <code style={{
                      fontSize: 'var(--text-caption2)',
                      background: 'var(--code-bg)',
                      padding: '1px 4px',
                      borderRadius: 3,
                      color: 'var(--code-text)',
                    }}>agents.json</code> configuration.
                  </p>
                </div>
              )}

              {/* Error help */}
              {!systemLoading && !systemAllOk && (
                <div style={{
                  marginTop: 'var(--space-4)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,69,58,0.08)',
                  border: '1px solid rgba(255,69,58,0.2)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                }}>
                  <AlertCircle size={16} style={{ color: 'var(--system-red)', flexShrink: 0, marginTop: 2 }} />
                  <div style={{
                    fontSize: 'var(--text-caption1)',
                    color: 'var(--text-secondary)',
                    lineHeight: 'var(--leading-relaxed)',
                  }}>
                    Run <code style={{
                      fontSize: 'var(--text-caption2)',
                      background: 'var(--code-bg)',
                      padding: '1px 4px',
                      borderRadius: 3,
                      color: 'var(--code-text)',
                    }}>clawport setup</code> in your terminal to auto-detect and configure your environment.
                    You can continue setup and fix this later.
                  </div>
                </div>
              )}

              {/* Retry button */}
              {!systemLoading && !systemAllOk && (
                <button
                  onClick={runSystemChecks}
                  style={{
                    marginTop: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--fill-tertiary)',
                    color: 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--text-caption1)',
                    fontWeight: 'var(--weight-medium)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <RotateCcw size={16} />
                  Retry Checks
                </button>
              )}
            </div>
          )}

          {/* Step 2: Name Your Dashboard */}
          {step === 2 && (
            <div key="step-2" className="animate-fade-in">
              <h2 style={{
                fontSize: 'var(--text-title1)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-tight)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-1)',
              }}>
                Name Your Dashboard
              </h2>
              <p style={{
                fontSize: 'var(--text-subheadline)',
                color: 'var(--text-tertiary)',
                marginBottom: 'var(--space-5)',
              }}>
                Personalize your command centre.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 'var(--text-caption1)',
                    color: 'var(--text-tertiary)',
                    marginBottom: 'var(--space-1)',
                  }}>
                    Dashboard Name
                  </label>
                  <input
                    type="text"
                    className="apple-input"
                    placeholder="ClawPort"
                    value={localName}
                    onChange={e => setLocalName(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--separator)',
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 'var(--text-caption1)',
                    color: 'var(--text-tertiary)',
                    marginBottom: 'var(--space-1)',
                  }}>
                    Subtitle
                  </label>
                  <input
                    type="text"
                    className="apple-input"
                    placeholder="Command Centre"
                    value={localSubtitle}
                    onChange={e => setLocalSubtitle(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--separator)',
                    }}
                  />
                </div>

              </div>

              {/* Mini sidebar preview */}
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--fill-quaternary)',
                border: '1px solid var(--separator)',
              }}>
                <div style={{
                  fontSize: 'var(--text-caption2)',
                  color: 'var(--text-quaternary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                  marginBottom: 'var(--space-2)',
                }}>
                  Preview
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: settings.accentColor
                      ? `linear-gradient(135deg, ${settings.accentColor}, ${settings.accentColor}dd)`
                      : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    flexShrink: 0,
                  }}>
                    {settings.portalEmoji ?? '\ud83e\udd9e'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 'var(--text-subheadline)',
                      fontWeight: 'var(--weight-bold)',
                      color: 'var(--text-primary)',
                      letterSpacing: 'var(--tracking-tight)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {localName || 'ClawPort'}
                    </div>
                    <div style={{
                      fontSize: 'var(--text-caption2)',
                      color: 'var(--text-tertiary)',
                    }}>
                      {localSubtitle || 'Command Centre'}
                    </div>
                  </div>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: 'var(--accent-fill)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--accent)',
                    flexShrink: 0,
                    letterSpacing: '-0.02em',
                  }}>
                    {getInitials(localOperator)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Theme */}
          {step === 3 && (
            <div key="step-3" className="animate-fade-in">
              <h2 style={{
                fontSize: 'var(--text-title2)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-tight)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-1)',
              }}>
                Choose a Theme
              </h2>
              <p style={{
                fontSize: 'var(--text-subheadline)',
                color: 'var(--text-tertiary)',
                marginBottom: 'var(--space-4)',
              }}>
                Pick the look that suits you. This applies live.
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 'var(--space-3)',
              }}>
                {THEMES.map(t => {
                  const isActive = theme === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-4) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--fill-quaternary)',
                        border: isActive ? '2px solid var(--accent)' : '2px solid var(--separator)',
                        cursor: 'pointer',
                        transition: 'all 150ms var(--ease-smooth)',
                      }}
                    >
                      <span style={{ fontSize: 28 }}>{t.emoji}</span>
                      <span style={{
                        fontSize: 'var(--text-footnote)',
                        fontWeight: isActive ? 'var(--weight-semibold)' : 'var(--weight-medium)',
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      }}>
                        {t.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 4: Accent Color */}
          {step === 4 && (
            <div key="step-4" className="animate-fade-in">
              <h2 style={{
                fontSize: 'var(--text-title2)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-tight)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-1)',
              }}>
                Accent Color
              </h2>
              <p style={{
                fontSize: 'var(--text-subheadline)',
                color: 'var(--text-tertiary)',
                marginBottom: 'var(--space-4)',
              }}>
                Personalize with your favorite color.
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 'var(--space-3)',
                justifyItems: 'center',
              }}>
                {ACCENT_PRESETS.map(preset => {
                  const isActive = settings.accentColor === preset.value
                  return (
                    <button
                      key={preset.value}
                      onClick={() => setAccentColor(preset.value)}
                      aria-label={preset.label}
                      title={preset.label}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: preset.value,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        outline: isActive ? `3px solid ${preset.value}` : 'none',
                        outlineOffset: 3,
                        transition: 'all 100ms var(--ease-smooth)',
                      }}
                    >
                      {isActive && <Check size={18} color="#000" strokeWidth={3} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 5: Voice Input */}
          {step === 5 && (
            <div key="step-5" className="animate-fade-in">
              <h2 style={{
                fontSize: 'var(--text-title2)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-tight)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-1)',
              }}>
                Voice Input
              </h2>
              <p style={{
                fontSize: 'var(--text-subheadline)',
                color: 'var(--text-tertiary)',
                marginBottom: 'var(--space-4)',
                lineHeight: 'var(--leading-relaxed)',
              }}>
                Talk to your agents using your system&apos;s built-in dictation.
                No microphone setup needed in the browser.
              </p>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}>
                <div style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--fill-quaternary)',
                  border: '1px solid var(--separator)',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    marginBottom: 'var(--space-3)',
                  }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'var(--accent-fill)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Keyboard size={18} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <div style={{
                        fontSize: 'var(--text-subheadline)',
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-primary)',
                      }}>
                        macOS Dictation
                      </div>
                      <div style={{
                        fontSize: 'var(--text-caption1)',
                        color: 'var(--text-tertiary)',
                      }}>
                        Recommended
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--text-footnote)',
                    color: 'var(--text-secondary)',
                    lineHeight: 'var(--leading-relaxed)',
                  }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 'var(--weight-semibold)', flexShrink: 0 }}>1.</span>
                      <span>Open <strong>System Settings &gt; Keyboard</strong></span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 'var(--weight-semibold)', flexShrink: 0 }}>2.</span>
                      <span>Turn on <strong>Dictation</strong></span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 'var(--weight-semibold)', flexShrink: 0 }}>3.</span>
                      <span>Click any chat input, press <strong>Fn Fn</strong> (double-tap), and start talking</span>
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--fill-quaternary)',
                  border: '1px solid var(--separator)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                }}>
                  <Mic size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }} />
                  <div style={{
                    fontSize: 'var(--text-caption1)',
                    color: 'var(--text-tertiary)',
                    lineHeight: 'var(--leading-relaxed)',
                  }}>
                    Your voice is converted to text by macOS, then sent as a regular message.
                    Agents respond just like they would to typed text. Works in any input field across the app.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Overview */}
          {step === 6 && (
            <div key="step-6" className="animate-fade-in">
              <h2 style={{
                fontSize: 'var(--text-title2)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-tight)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-1)',
              }}>
                You&apos;re All Set
              </h2>
              <p style={{
                fontSize: 'var(--text-subheadline)',
                color: 'var(--text-tertiary)',
                marginBottom: 'var(--space-4)',
              }}>
                Here&apos;s what you can do.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {FEATURES.map(f => {
                  const Icon = f.icon
                  return (
                    <div
                      key={f.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--fill-quaternary)',
                        border: '1px solid var(--separator)',
                      }}
                    >
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'var(--accent-fill)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon size={18} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 'var(--text-subheadline)',
                          fontWeight: 'var(--weight-semibold)',
                          color: 'var(--text-primary)',
                        }}>
                          {f.name}
                        </div>
                        <div style={{
                          fontSize: 'var(--text-caption1)',
                          color: 'var(--text-tertiary)',
                        }}>
                          {f.desc}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-3) var(--space-5) var(--space-5)',
          gap: 'var(--space-3)',
        }}>
          {step > 0 ? (
            <button
              onClick={handleBack}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--fill-tertiary)',
                color: 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-subheadline)',
                fontWeight: 'var(--weight-medium)',
                transition: 'all 150ms var(--ease-smooth)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ArrowLeft size={16} />
              Back
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={handleNext}
            disabled={step === 1 && systemLoading}
            style={{
              padding: 'var(--space-2) var(--space-6)',
              borderRadius: 'var(--radius-md)',
              background: step === 1 && systemLoading ? 'var(--fill-tertiary)' : 'var(--accent)',
              color: step === 1 && systemLoading ? 'var(--text-quaternary)' : 'var(--accent-contrast)',
              border: 'none',
              cursor: step === 1 && systemLoading ? 'wait' : 'pointer',
              fontSize: 'var(--text-subheadline)',
              fontWeight: 'var(--weight-semibold)',
              transition: 'all 150ms var(--ease-smooth)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {step === 0 ? 'Begin' : step === TOTAL_STEPS - 1 ? 'Get Started' : 'Next'}
            {step === TOTAL_STEPS - 1 ? <Rocket size={16} /> : <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
