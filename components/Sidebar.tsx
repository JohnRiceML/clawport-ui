'use client';

import { useCallback } from 'react';
import { NavLinks } from '@/components/NavLinks';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileSidebar } from '@/components/MobileSidebar';
import { SidebarUsageWidget } from '@/components/sidebar/SidebarUsageWidget';
import { GlobalSearch, SearchTrigger } from '@/components/GlobalSearch';
import { useSettings } from '@/app/settings-provider';

/**
 * Sidebar -- client wrapper that coordinates desktop sidebar, mobile sidebar,
 * and the Cmd+K search palette. Rendered inside layout.tsx.
 */
export function Sidebar() {
  const { settings, t } = useSettings();
  const openSearch = useCallback(() => {
    // We trigger the search modal by simulating Cmd+K.
    // Instead, we expose a controlled open state via a custom event.
    // The GlobalSearch component listens for this.
    window.dispatchEvent(new CustomEvent('clawport:open-search'));
  }, []);

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <aside
        className="hidden md:flex md:flex-col"
        style={{
          width: '220px',
          flexShrink: 0,
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderRight: '1px solid var(--separator)',
        }}
      >
        {/* App icon + title */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center gap-3">
            {settings.portalIcon ? (
              <img
                src={settings.portalIcon}
                alt=""
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  objectFit: 'cover',
                  boxShadow: 'var(--shadow-card)',
                  flexShrink: 0,
                }}
              />
            ) : (
              <img
                src="/clawport-logo.png"
                alt=""
                style={{
                  width: '72px',
                  height: '72px',
                  objectFit: 'contain',
                  flexShrink: 0,
                }}
              />
            )}
            <div>
              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 600,
                  letterSpacing: '-0.3px',
                  color: 'var(--text-primary)',
                }}
              >
                {settings.portalName?.trim() ? settings.portalName : t('app.commandCentre')}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.01em',
                }}
              >
                {settings.portalSubtitle ?? t('app.commandCentre')}
              </div>
            </div>
          </div>
        </div>

        {/* Search trigger */}
        <div className="px-3 pb-2">
          <SearchTrigger onClick={openSearch} />
        </div>

        <NavLinks bottomSlot={<SidebarUsageWidget />} />
        <ThemeToggle />
      </aside>

      {/* Mobile sidebar */}
      <MobileSidebar onOpenSearch={openSearch} />

      {/* Global search modal (Cmd+K) */}
      <GlobalSearch />
    </>
  );
}
