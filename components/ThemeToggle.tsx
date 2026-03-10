'use client';

import { useRef, useCallback } from 'react';
import { THEMES } from '@/lib/themes';
import { useTheme } from '@/app/providers';
import { useSettings } from '@/app/settings-provider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const buttons =
        containerRef.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons || buttons.length === 0) return;

      const currentIndex = THEMES.findIndex((t) => t.id === theme);

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % THEMES.length;
        setTheme(THEMES[nextIndex].id);
        buttons[nextIndex].focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex =
          (currentIndex - 1 + THEMES.length) % THEMES.length;
        setTheme(THEMES[prevIndex].id);
        buttons[prevIndex].focus();
      }
    },
    [theme, setTheme]
  );

  return (
    <div style={{ padding: '8px 16px 12px' }}>
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
        {t('theme.title')}
      </div>
      <div
        ref={containerRef}
        className="flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label={t('theme.selection')}
        onKeyDown={handleKeyDown}
      >
        {THEMES.map((themeOption) => {
          const isActive = theme === themeOption.id;
          return (
            <button
              key={themeOption.id}
              onClick={() => setTheme(themeOption.id)}
              title={t(`theme.${themeOption.id}`)}
              role="radio"
              aria-checked={isActive}
              aria-label={`${t(`theme.${themeOption.id}`)} ${t('theme.title')}`}
              tabIndex={isActive ? 0 : -1}
              className="focus-ring"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '28px',
                padding: isActive ? '0 10px' : '0 6px',
                borderRadius: '14px',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 150ms var(--ease-spring)',
                background: isActive
                  ? 'var(--accent-fill)'
                  : 'var(--fill-quaternary)',
                color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                outline: 'none',
              }}
            >
              <span style={{ fontSize: '13px', lineHeight: 1 }}>
                {themeOption.emoji}
              </span>
              {isActive && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {t(`theme.${themeOption.id}`)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
