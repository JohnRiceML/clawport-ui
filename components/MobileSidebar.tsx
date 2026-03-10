'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { NavLinks } from '@/components/NavLinks';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SearchTrigger } from '@/components/GlobalSearch';
import { useSettings } from '@/app/settings-provider';
import { SidebarUsageWidget } from '@/components/sidebar/SidebarUsageWidget';

export function MobileSidebar({
  onOpenSearch,
}: {
  onOpenSearch?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { settings, t } = useSettings();

  // Close sidebar on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  const handleSearchClick = useCallback(() => {
    setOpen(false);
    onOpenSearch?.();
  }, [onOpenSearch]);

  return (
    <>
      {/* Mobile header bar */}
      <header
        className="flex md:hidden items-center"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          height: '48px',
          gap: '12px',
          padding: '0 12px',
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderBottom: '1px solid var(--separator)',
        }}
      >
        {/* Hamburger / close toggle */}
        <button
          onClick={toggle}
          className="btn-ghost focus-ring"
          aria-label={open ? t('mobile.closeNav') : t('mobile.openNav')}
          aria-expanded={open}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            transition: 'color 100ms var(--ease-smooth)',
          }}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* App title */}
        <div className="flex items-center gap-2" style={{ flex: 1 }}>
          {settings.portalIcon ? (
            <img
              src={settings.portalIcon}
              alt=""
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          ) : (
            <img
              src="/clawport-logo.png"
              alt=""
              style={{
                width: '48px',
                height: '48px',
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
          )}
          <span
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.2px',
            }}
          >
            {(!settings.portalName || settings.portalName === 'ClawPort')
              ? <>Claw<span style={{ color: 'var(--accent)' }}>Port</span></>
              : settings.portalName}
            {' '}{settings.portalSubtitle ?? t('app.commandCentre')}
          </span>
        </div>
      </header>

      {/* Backdrop */}
      <div
        className="block md:hidden"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms var(--ease-smooth)',
        }}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-out sidebar panel */}
      <aside
        className="flex md:hidden flex-col"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 55,
          width: '280px',
          background: 'var(--sidebar-bg)',
          backdropFilter: 'var(--sidebar-backdrop)',
          WebkitBackdropFilter: 'var(--sidebar-backdrop)',
          borderRight: '1px solid var(--separator)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: open ? 'var(--shadow-overlay)' : 'none',
        }}
        aria-hidden={!open}
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
                {(!settings.portalName || settings.portalName === 'ClawPort')
                  ? <>Claw<span style={{ color: 'var(--accent)' }}>Port</span></>
                  : settings.portalName}
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
          <SearchTrigger onClick={handleSearchClick} />
        </div>

        <NavLinks bottomSlot={<SidebarUsageWidget />} />
        <ThemeToggle />
      </aside>
    </>
  );
}
