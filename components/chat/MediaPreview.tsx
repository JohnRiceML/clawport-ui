'use client'
import React from 'react'
import type { MediaAttachment } from '@/lib/conversations'

interface MediaPreviewProps {
  attachments: MediaAttachment[]
  onRemove: (index: number) => void
}

export function MediaPreview({ attachments, onRemove }: MediaPreviewProps) {
  if (attachments.length === 0) return null

  return (
    <div style={{
      display: 'flex',
      gap: 'var(--space-2)',
      padding: 'var(--space-2) var(--space-3)',
      overflowX: 'auto',
      overflowY: 'hidden',
    }}>
      {attachments.map((att, i) => (
        <div key={i} style={{
          position: 'relative',
          width: 56,
          height: 56,
          flexShrink: 0,
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          background: 'var(--fill-tertiary)',
          border: '1px solid var(--separator)',
        }}>
          {att.type === 'image' ? (
            <img
              src={att.url}
              alt={att.name || '预览'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: 4,
            }}>
              {att.type === 'audio' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
              )}
              <span style={{
                fontSize: 8,
                color: 'var(--text-quaternary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
                textAlign: 'center',
              }}>
                {att.name?.split('.').pop()?.toUpperCase() || att.type.toUpperCase()}
              </span>
            </div>
          )}

          {/* Remove button */}
          <button
            onClick={() => onRemove(i)}
            aria-label="移除附件"
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 11,
              lineHeight: 1,
              padding: 0,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
