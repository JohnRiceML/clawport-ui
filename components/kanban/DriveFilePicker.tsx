'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { RelevantFile } from '@/lib/kanban/types'

interface DriveFilePickerProps {
  value: RelevantFile[]
  onChange: (files: RelevantFile[]) => void
}

interface DriveSearchResult {
  id: string
  name: string
  mimeType: string
  url: string
  iconLink: string
}

const MIME_ICONS: Record<string, string> = {
  'application/vnd.google-apps.document': '\u{1F4DD}',   // memo (Docs)
  'application/vnd.google-apps.spreadsheet': '\u{1F4CA}', // bar chart (Sheets)
  'application/vnd.google-apps.presentation': '\u{1F4CA}', // bar chart (Slides)
  'application/pdf': '\u{1F4C4}',                          // page facing up
  'application/vnd.google-apps.folder': '\u{1F4C1}',       // folder
}

function fileIcon(mimeType: string): string {
  return MIME_ICONS[mimeType] ?? '\u{1F4CE}' // paperclip default
}

export function DriveFilePicker({ value, onChange }: DriveFilePickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<DriveSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedIds = new Set(value.map((f) => f.id))

  // Debounced search
  useEffect(() => {
    if (!open) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search.trim()) params.set('q', search.trim())
        const res = await fetch(`/api/drive/files?${params}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.files ?? [])
        }
      } catch {
        // Silently fail - results stay empty
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, open])

  // Focus search when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 0)
    } else {
      setSearch('')
      setResults([])
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
    const items = listRef.current.querySelectorAll('[data-file-option]')
    const item = items[highlightIdx]
    if (item) item.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx, open])

  // Reset highlight when results change
  useEffect(() => {
    setHighlightIdx(0)
  }, [results])

  function toggleFile(file: DriveSearchResult) {
    if (selectedIds.has(file.id)) {
      onChange(value.filter((f) => f.id !== file.id))
    } else {
      onChange([...value, { id: file.id, name: file.name, mimeType: file.mimeType, url: file.url }])
    }
  }

  function removeFile(fileId: string) {
    onChange(value.filter((f) => f.id !== fileId))
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
        setHighlightIdx((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (results[highlightIdx]) {
          toggleFile(results[highlightIdx])
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, highlightIdx, results, value],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <label
        style={{
          fontSize: 'var(--text-caption1)',
          fontWeight: 'var(--weight-medium)',
          color: 'var(--text-secondary)',
        }}
      >
        Relevant Files
      </label>
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
            color: value.length > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            textAlign: 'left',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            paddingRight: 36,
            minHeight: 40,
          }}
        >
          {value.length > 0 ? (
            <span>
              {value.length} file{value.length !== 1 ? 's' : ''} attached
            </span>
          ) : (
            <span>Attach files from Drive</span>
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
                placeholder="Search Drive files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

            {/* Results list */}
            <div
              ref={listRef}
              role="listbox"
              aria-multiselectable="true"
              style={{
                maxHeight: 280,
                overflowY: 'auto',
                padding: '4px',
              }}
            >
              {loading && (
                <div
                  style={{
                    padding: 'var(--space-4)',
                    textAlign: 'center',
                    fontSize: 'var(--text-footnote)',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  Searching...
                </div>
              )}

              {!loading &&
                results.map((file, i) => {
                  const isHighlighted = highlightIdx === i
                  const isSelected = selectedIds.has(file.id)

                  return (
                    <div
                      key={file.id}
                      data-file-option
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => toggleFile(file)}
                      onMouseEnter={() => setHighlightIdx(i)}
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
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{fileIcon(file.mimeType)}</span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 'var(--text-footnote)',
                          fontWeight: 'var(--weight-medium)',
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {file.name}
                      </span>
                      {isSelected && (
                        <span style={{ color: 'var(--accent)', fontSize: 13, flexShrink: 0 }}>
                          &#10003;
                        </span>
                      )}
                    </div>
                  )
                })}

              {!loading && results.length === 0 && (
                <div
                  style={{
                    padding: 'var(--space-4)',
                    textAlign: 'center',
                    fontSize: 'var(--text-footnote)',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {search.trim() ? `No files match "${search}"` : 'Type to search Drive files'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected files chips */}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 2 }}>
          {value.map((file) => (
            <span
              key={file.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--fill-tertiary)',
                fontSize: 'var(--text-caption2)',
                color: 'var(--text-secondary)',
                maxWidth: 200,
              }}
            >
              <span style={{ fontSize: 12 }}>{fileIcon(file.mimeType)}</span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                  marginLeft: 2,
                  flexShrink: 0,
                }}
                aria-label={`Remove ${file.name}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
