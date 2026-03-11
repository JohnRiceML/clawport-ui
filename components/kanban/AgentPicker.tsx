'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Agent } from '@/lib/types'
import { AgentAvatar } from '@/components/AgentAvatar'
import { useSettings } from '@/app/settings-provider'

interface AgentPickerProps {
  agents: Agent[]
  value: string // agent id or ''
  onChange: (agentId: string) => void
}

export function AgentPicker({ agents, value, onChange }: AgentPickerProps) {
  const { copy } = useSettings()
  const pickerCopy = copy.agentPicker
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = agents.find(a => a.id === value) ?? null

  // Filter agents by search
  const filtered = search.trim()
    ? agents.filter(a => {
        const q = search.toLowerCase()
        return (
          a.name.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
        )
      })
    : agents

  // Keep the unassigned option searchable in the current locale.
  const hasUnassigned =
    !search.trim() || pickerCopy.unassigned.toLowerCase().includes(search.toLowerCase())

  // Reset highlight when filter changes
  useEffect(() => {
    setHighlightIdx(0)
  }, [search])

  // Focus search when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 0)
    } else {
      setSearch('')
    }
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const items = listRef.current.querySelectorAll('[data-agent-option]')
    const item = items[highlightIdx]
    if (item) item.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx, open])

  const totalOptions = (hasUnassigned ? 1 : 0) + filtered.length

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(i => Math.min(i + 1, totalOptions - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Select the highlighted option
      if (hasUnassigned && highlightIdx === 0) {
        onChange('')
      } else {
        const agentIdx = hasUnassigned ? highlightIdx - 1 : highlightIdx
        if (filtered[agentIdx]) {
          onChange(filtered[agentIdx].id)
        }
      }
      setOpen(false)
    }
  }, [open, highlightIdx, totalOptions, hasUnassigned, filtered, onChange])

  function selectAgent(agentId: string) {
    onChange(agentId)
    setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }} onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        className="apple-input focus-ring"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: '8px 12px',
          fontSize: 'var(--text-body)',
          color: selected ? 'var(--text-primary)' : 'var(--text-tertiary)',
          cursor: 'pointer',
          textAlign: 'left',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: 36,
          minHeight: 40,
        }}
      >
        {selected ? (
          <>
            <AgentAvatar agent={selected} size={22} borderRadius={6} />
            <span style={{ fontWeight: 'var(--weight-medium)' }}>{selected.name}</span>
            <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {selected.title}
            </span>
          </>
        ) : (
          <span>{pickerCopy.unassigned}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            zIndex: 50,
            background: 'var(--material-regular)',
            border: '1px solid var(--separator)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div style={{ padding: '8px 8px 4px' }}>
            <input
              ref={searchRef}
              type="text"
              placeholder={pickerCopy.searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="focus-ring"
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 'var(--text-footnote)',
                border: '1px solid var(--separator)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--fill-tertiary)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Options list */}
          <div
            ref={listRef}
            role="listbox"
            style={{
              maxHeight: 280,
              overflowY: 'auto',
              padding: '4px',
            }}
          >
            {/* Unassigned option */}
            {hasUnassigned && (
              <div
                data-agent-option
                role="option"
                aria-selected={value === ''}
                onClick={() => selectAgent('')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: highlightIdx === 0 ? 'var(--fill-secondary)' : 'transparent',
                  transition: 'background 100ms',
                }}
                onMouseEnter={() => setHighlightIdx(0)}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--fill-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  color: 'var(--text-tertiary)',
                  flexShrink: 0,
                }}>
                  —
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-footnote)', fontWeight: 'var(--weight-medium)', color: 'var(--text-secondary)' }}>
                    {pickerCopy.unassigned}
                  </div>
                  <div style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-tertiary)' }}>
                    {pickerCopy.noAgentAssigned}
                  </div>
                </div>
                {value === '' && (
                  <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 13, flexShrink: 0 }}>&#10003;</span>
                )}
              </div>
            )}

            {/* Agent options */}
            {filtered.map((agent, i) => {
              const optionIdx = hasUnassigned ? i + 1 : i
              const isHighlighted = highlightIdx === optionIdx
              const isSelected = value === agent.id

              return (
                <div
                  key={agent.id}
                  data-agent-option
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectAgent(agent.id)}
                  onMouseEnter={() => setHighlightIdx(optionIdx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: isHighlighted ? 'var(--fill-secondary)' : 'transparent',
                    transition: 'background 100ms',
                  }}
                >
                  <AgentAvatar agent={agent} size={32} borderRadius={8} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 'var(--text-footnote)',
                      fontWeight: 'var(--weight-semibold)',
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {agent.name}
                    </div>
                    <div style={{
                      fontSize: 'var(--text-caption2)',
                      color: 'var(--text-tertiary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {agent.title}
                    </div>
                  </div>
                  {isSelected && (
                    <span style={{ color: 'var(--accent)', fontSize: 13, flexShrink: 0 }}>&#10003;</span>
                  )}
                </div>
              )
            })}

            {/* No results */}
            {filtered.length === 0 && !hasUnassigned && (
              <div style={{
                padding: 'var(--space-4)',
                textAlign: 'center',
                fontSize: 'var(--text-footnote)',
                color: 'var(--text-tertiary)',
              }}>
                {pickerCopy.noAgentsMatch(search)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
