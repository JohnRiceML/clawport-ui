'use client'

import { useSettings } from '@/app/settings-provider'
import type { LocalePreference } from '@/lib/i18n'

const OPTIONS: LocalePreference[] = ['system', 'en', 'zh-CN']

export function LocaleToggle() {
  const { locale, resolvedLocale, copy, setLocale } = useSettings()

  function getLabel(option: LocalePreference): string {
    if (option === 'system') return copy.common.system
    if (option === 'zh-CN') return copy.common.chinese
    return copy.common.english
  }

  return (
    <div style={{ padding: '8px 16px 0' }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.06em',
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          marginBottom: '6px',
          paddingLeft: '4px',
        }}
      >
        {copy.common.language}
      </div>
      <div
        role="radiogroup"
        aria-label={copy.common.language}
        className="flex flex-wrap gap-1.5"
      >
        {OPTIONS.map((option) => {
          const isActive = locale === option
          const showResolved = option === 'system'
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={getLabel(option)}
              tabIndex={isActive ? 0 : -1}
              className="focus-ring"
              onClick={() => setLocale(option)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                height: '28px',
                padding: isActive ? '0 10px' : '0 8px',
                borderRadius: '14px',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 150ms var(--ease-spring)',
                background: isActive ? 'var(--accent-fill)' : 'var(--fill-quaternary)',
                color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                outline: 'none',
              }}
            >
              <span>{getLabel(option)}</span>
              {showResolved && isActive && (
                <span style={{ fontSize: '11px', opacity: 0.8 }}>
                  {resolvedLocale === 'zh-CN' ? '→ 中文' : '→ EN'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
