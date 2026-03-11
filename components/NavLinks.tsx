'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Map, MessageSquare, Clock, Activity, Brain, Columns3, BookOpen, Settings, DollarSign } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CronJob } from '@/lib/types';
import { useSettings } from '@/app/settings-provider';

function getInitials(name: string | null): string {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ---------------------------------------------------------------------------
// Nav item definition
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: 'map' | 'kanban' | 'messages' | 'crons' | 'activity' | 'costs' | 'memory' | 'docs' | 'settings';
  icon: LucideIcon;
  badge?: 'agents' | 'unread' | 'errors';
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'map', icon: Map, badge: 'agents' },
  { href: '/kanban', label: 'kanban', icon: Columns3 },
  { href: '/chat', label: 'messages', icon: MessageSquare, badge: 'unread' },
  { href: '/crons', label: 'crons', icon: Clock, badge: 'errors' },
  { href: '/activity', label: 'activity', icon: Activity },
  { href: '/costs', label: 'costs', icon: DollarSign },
  { href: '/memory', label: 'memory', icon: Brain },
  { href: '/docs', label: 'docs', icon: BookOpen },
  { href: '/settings', label: 'settings', icon: Settings },
];

// ---------------------------------------------------------------------------
// NavLinks component
// ---------------------------------------------------------------------------

export function NavLinks({ bottomSlot }: { bottomSlot?: React.ReactNode } = {}) {
  const pathname = usePathname();
  const { settings, copy } = useSettings();
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [cronCount, setCronCount] = useState<number | null>(null);
  const [cronErrorCount, setCronErrorCount] = useState<number | null>(null);

  // Fetch agent count
  useEffect(() => {
    fetch('/api/agents')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setAgentCount(data.length);
        }
      })
      .catch(() => {
        setAgentCount(null);
      });
  }, []);

  // Fetch cron error count
  useEffect(() => {
    fetch('/api/crons')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: unknown) => {
        const crons: CronJob[] = Array.isArray(data)
          ? data
          : (data as { crons?: CronJob[] })?.crons ?? [];
        setCronCount(crons.length);
        setCronErrorCount(crons.filter((c) => c.status === 'error').length);
      })
      .catch(() => {
        setCronErrorCount(null);
      });
  }, []);

  // Resolve badge content per nav item
  function getBadge(item: NavItem): React.ReactNode {
    if (item.badge === 'agents' && agentCount !== null) {
      return (
        <span
          className="nav-badge"
          style={{
            marginLeft: 'auto',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            padding: '1px 6px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--fill-quaternary)',
            color: 'var(--text-tertiary)',
            lineHeight: '16px',
          }}
        >
          {agentCount}
        </span>
      );
    }
    if (item.badge === 'errors' && cronCount !== null) {
      const hasErrors = cronErrorCount !== null && cronErrorCount > 0;
      return (
        <span
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            className="nav-badge"
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
              background: hasErrors ? 'rgba(255,69,58,0.1)' : 'var(--fill-quaternary)',
              color: hasErrors ? 'var(--system-red)' : 'var(--text-tertiary)',
              lineHeight: '16px',
              fontWeight: hasErrors ? 600 : undefined,
            }}
          >
            {hasErrors ? copy.nav.cronErrorBadge(cronErrorCount) : cronCount}
          </span>
          {hasErrors && (
            <span
              aria-label={copy.nav.cronErrorAria(cronErrorCount)}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--system-red)',
                flexShrink: 0,
                animation: 'pulse-red 1.5s ease-in-out infinite',
              }}
            />
          )}
        </span>
      );
    }
    return null;
  }

  return (
    <nav className="flex-1 flex flex-col" style={{ minHeight: 0, overflow: 'hidden' }} aria-label={copy.common.workspace}>
      {/* Scrollable nav items */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 12px 8px' }}>
        {/* Section header */}
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            padding: '0 8px',
            marginBottom: '2px',
          }}
        >
          {copy.common.workspace}
        </div>

        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            const Icon = item.icon;
            const label = copy.nav[item.label];

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item focus-ring ${isActive ? 'nav-item-active' : ''}`}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  minHeight: '36px',
                  padding: '0 10px 0 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-fill)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 100ms var(--ease-smooth)',
                }}
              >
                <Icon
                  size={16}
                  style={{
                    flexShrink: 0,
                    color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                    transition: 'color 100ms var(--ease-smooth)',
                  }}
                />
                <span style={{ flex: 1 }}>{label}</span>
                {getBadge(item)}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Pinned bottom: usage widget + user footer */}
      <div style={{ flexShrink: 0 }}>
        {bottomSlot}

        {/* User footer */}
        <div
          style={{
            borderTop: '1px solid var(--separator)',
            padding: '8px 16px',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                background: 'var(--accent-fill)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--accent)',
                flexShrink: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {getInitials(settings.operatorName)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {settings.operatorName ?? copy.common.operator}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                }}
              >
                {copy.common.owner}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
