'use client'
import React from 'react'

interface FileAttachmentProps {
  name: string
  size?: number
  mimeType?: string
  url: string
  isUser: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(mimeType?: string, name?: string): React.ReactNode {
  const ext = name?.split('.').pop()?.toLowerCase() || ''
  const isPdf = mimeType === 'application/pdf' || ext === 'pdf'
  const isDoc = ['doc', 'docx'].includes(ext) || mimeType?.includes('wordprocessingml')
  const isText = ['txt', 'csv', 'json', 'md'].includes(ext) || mimeType?.startsWith('text/')
  const isArchive = ['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)

  if (isPdf) return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  )
  if (isDoc) return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
  if (isText) return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
  if (isArchive) return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8v13H3V8" />
      <path d="M1 3h22v5H1z" />
      <path d="M10 12h4" />
    </svg>
  )
  // Generic file
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  )
}

export function FileAttachment({ name, size, mimeType, url, isUser }: FileAttachmentProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-3) var(--space-4)',
      borderRadius: 'var(--radius-lg)',
      background: isUser ? 'var(--accent)' : 'var(--material-thin)',
      border: isUser ? 'none' : '1px solid var(--separator)',
      maxWidth: 280,
      minWidth: 180,
    }}>
      {/* File icon */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 'var(--radius-sm)',
        background: isUser ? 'rgba(0,0,0,0.15)' : 'var(--fill-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: isUser ? '#000' : 'var(--text-secondary)',
      }}>
        {fileIcon(mimeType, name)}
      </div>

      {/* Name + size */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--text-footnote)',
          fontWeight: 'var(--weight-medium)',
          color: isUser ? '#000' : 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {name}
        </div>
        {size != null && (
          <div style={{
            fontSize: 'var(--text-caption2)',
            color: isUser ? 'rgba(0,0,0,0.5)' : 'var(--text-tertiary)',
            marginTop: 1,
          }}>
            {formatFileSize(size)}
          </div>
        )}
      </div>

      {/* Download button */}
      <a
        href={url}
        download={name}
        aria-label={`下载 ${name}`}
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: isUser ? 'rgba(0,0,0,0.15)' : 'var(--fill-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: isUser ? '#000' : 'var(--text-secondary)',
          textDecoration: 'none',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </a>
    </div>
  )
}
