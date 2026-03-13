'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Map,
  MessageSquare,
  Clock,
  Brain,
  Bot,
  Timer,
  Settings,
  BriefcaseBusiness,
} from 'lucide-react';
import type { Agent, CronJob } from '@/lib/types';
import {
  APP_NAME,
  CLIENT_HUB_PATH,
  isMonarckProductionHost,
  shouldHideClientNavPath,
  shouldShowClientHub,
} from '@/lib/branding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  id: string;
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
  href: string;
  category: 'Agents' | 'Pages' | 'Scheduled';
}

// ---------------------------------------------------------------------------
// Static pages
// ---------------------------------------------------------------------------

const STATIC_PAGES: SearchResult[] = [
  { id: 'page-map', label: 'Map', icon: <Map size={16} />, href: '/', category: 'Pages' },
  { id: 'page-messages', label: 'Messages', icon: <MessageSquare size={16} />, href: '/chat', category: 'Pages' },
  { id: 'page-crons', label: 'Scheduled', icon: <Clock size={16} />, href: '/crons', category: 'Pages' },
  { id: 'page-memory', label: 'Memory', icon: <Brain size={16} />, href: '/memory', category: 'Pages' },
  { id: 'page-settings', label: 'Settings', icon: <Settings size={16} />, href: '/settings', category: 'Pages' },
];

const CLIENT_PAGE: SearchResult = {
  id: 'page-client',
  label: 'Client',
  icon: <BriefcaseBusiness size={16} />,
  href: CLIENT_HUB_PATH,
  category: 'Pages',
}

// ---------------------------------------------------------------------------
// Simple fuzzy match — case-insensitive substring
// ---------------------------------------------------------------------------

function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  // Substring match
  if (t.includes(q)) return true;
  // Check if all characters appear in order (fuzzy)
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ---------------------------------------------------------------------------
// Search trigger button (used in sidebar)
// ---------------------------------------------------------------------------

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="nav-item focus-ring"
      aria-label="Open search (Cmd+K)"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: '36px',
        padding: '0 12px',
        borderRadius: '8px',
        border: '1px solid var(--separator)',
        background: 'var(--fill-quaternary)',
        color: 'var(--text-tertiary)',
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'all 100ms var(--ease-smooth)',
      }}
    >
      <Search size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
      <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
      <kbd
        style={{
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          padding: '1px 5px',
          borderRadius: '4px',
          background: 'var(--fill-tertiary)',
          color: 'var(--text-quaternary)',
          border: '1px solid var(--separator)',
          lineHeight: '16px',
        }}
      >
        {'\u2318'}K
      </kbd>
    </button>
  );
}

// ---------------------------------------------------------------------------
// GlobalSearch modal
// ---------------------------------------------------------------------------

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isClientFacingHost, setIsClientFacingHost] = useState<boolean | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [crons, setCrons] = useState<CronJob[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // -----------------------------------------------------------------------
  // Keyboard shortcut: Cmd+K / Ctrl+K
  // -----------------------------------------------------------------------
  useEffect(() => {
    setIsClientFacingHost(isMonarckProductionHost(window.location.hostname));
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // -----------------------------------------------------------------------
  // Custom event: open search from sidebar trigger buttons
  // -----------------------------------------------------------------------
  useEffect(() => {
    function handleOpenSearch() {
      setOpen(true);
    }
    window.addEventListener('clawport:open-search', handleOpenSearch);
    return () => window.removeEventListener('clawport:open-search', handleOpenSearch);
  }, []);

  // -----------------------------------------------------------------------
  // Fetch data when modal opens
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    if (isClientFacingHost === null) return;
    // Reset state
    setQuery('');
    setActiveIndex(0);
    // Fetch agents
    fetch('/api/agents')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: unknown) => {
        if (Array.isArray(data)) setAgents(data as Agent[]);
      })
      .catch(() => setAgents([]));
    // Fetch crons
    if (!isClientFacingHost) {
      fetch('/api/crons')
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data: unknown) => {
          setCrons(Array.isArray(data) ? data as CronJob[] : (data as { crons?: CronJob[] })?.crons ?? []);
        })
        .catch(() => setCrons([]));
    } else {
      setCrons([]);
    }
  }, [open, isClientFacingHost]);

  // -----------------------------------------------------------------------
  // Focus input when opened
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (open) {
      // Small delay to ensure the input is mounted
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // -----------------------------------------------------------------------
  // Prevent body scroll
  // -----------------------------------------------------------------------
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

  // -----------------------------------------------------------------------
  // Build filtered results
  // -----------------------------------------------------------------------
  const results = useMemo(() => {
    const all: SearchResult[] = [];

    // Agents
    agents.forEach((a) => {
      all.push({
        id: `agent-${a.id}`,
        label: a.name,
        subtitle: a.title,
        icon: <Bot size={16} style={{ color: a.color }} />,
        href: `/chat?agent=${a.id}`,
        category: 'Agents',
      });
    });

    // Static pages
    all.push(
      ...STATIC_PAGES.filter((page) => (
        !shouldHideClientNavPath(page.href, isClientFacingHost)
      ))
    );
    if (shouldShowClientHub(isClientFacingHost)) {
      all.push(CLIENT_PAGE);
    }

    if (!isClientFacingHost) {
      crons.forEach((c) => {
        all.push({
          id: `cron-${c.id}`,
          label: c.name,
          subtitle: c.schedule,
          icon: <Timer size={16} />,
          href: '/crons',
          category: 'Scheduled',
        });
      });
    }

    if (!query.trim()) return all;

    return all.filter(
      (r) =>
        fuzzyMatch(query, r.label) ||
        (r.subtitle && fuzzyMatch(query, r.subtitle))
    );
  }, [query, agents, crons, isClientFacingHost]);

  // -----------------------------------------------------------------------
  // Group results by category
  // -----------------------------------------------------------------------
  const grouped = useMemo(() => {
    const groups: { category: string; items: SearchResult[] }[] = [];
    const categoryOrder = ['Agents', 'Pages', 'Scheduled'];
    for (const cat of categoryOrder) {
      const items = results.filter((r) => r.category === cat);
      if (items.length > 0) {
        groups.push({ category: cat, items });
      }
    }
    return groups;
  }, [results]);

  // Flat list for keyboard nav
  const flatResults = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------
  const navigate = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      router.push(result.href);
    },
    [router]
  );

  // -----------------------------------------------------------------------
  // Keyboard handling inside the modal
  // -----------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (flatResults[activeIndex]) {
          navigate(flatResults[activeIndex]);
        }
        return;
      }
    },
    [activeIndex, flatResults, navigate]
  );

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20vh',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Search ${APP_NAME}`}
        className="animate-scale-in"
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '560px',
          margin: '0 16px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--material-regular)',
          border: '1px solid var(--separator)',
          boxShadow: 'var(--shadow-overlay)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '480px',
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 16px',
            borderBottom: '1px solid var(--separator)',
          }}
        >
          <Search
            size={18}
            style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${APP_NAME}...`}
            aria-label={`Search ${APP_NAME}`}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
            }}
          />
          <kbd
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'var(--fill-quaternary)',
              color: 'var(--text-quaternary)',
              border: '1px solid var(--separator)',
              lineHeight: '16px',
            }}
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          {flatResults.length === 0 && query.trim() && (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: '13px',
              }}
            >
              No results for &lsquo;{query}&rsquo;
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.category} style={{ marginBottom: '4px' }}>
              {/* Category header */}
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                  padding: '6px 8px 4px',
                }}
              >
                {group.category}
              </div>

              {/* Items */}
              {group.items.map((item) => {
                const currentIndex = flatIndex++;
                const isActive = currentIndex === activeIndex;

                return (
                  <button
                    key={item.id}
                    role="option"
                    aria-selected={isActive}
                    data-active={isActive}
                    onClick={() => navigate(item)}
                    onMouseEnter={() => setActiveIndex(currentIndex)}
                    className="focus-ring"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      minHeight: '44px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isActive
                        ? 'var(--accent-fill)'
                        : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 80ms var(--ease-smooth)',
                      outline: 'none',
                    }}
                    aria-label={
                      item.subtitle
                        ? `${item.label} - ${item.subtitle}`
                        : item.label
                    }
                  >
                    <span
                      style={{
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        background: 'var(--fill-quaternary)',
                        flexShrink: 0,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {item.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: isActive
                            ? 'var(--text-primary)'
                            : 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.label}
                      </div>
                      {item.subtitle && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-tertiary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer with keyboard hints */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '8px 16px',
            borderTop: '1px solid var(--separator)',
            fontSize: '11px',
            color: 'var(--text-quaternary)',
          }}
        >
          <span>
            <kbd style={{ fontFamily: 'var(--font-mono)' }}>{'\u2191\u2193'}</kbd> Navigate
          </span>
          <span>
            <kbd style={{ fontFamily: 'var(--font-mono)' }}>{'\u21B5'}</kbd> Open
          </span>
          <span>
            <kbd style={{ fontFamily: 'var(--font-mono)' }}>esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
