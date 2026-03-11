'use client'
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Agent } from '@/lib/types'
import type { Conversation, ConversationStore, Message, MediaAttachment } from '@/lib/conversations'
import { parseMedia, addMessage, updateLastMessage, deleteOnServer } from '@/lib/conversations'
import { buildApiContent } from '@/lib/multimodal'
import { generateId } from '@/lib/id'
import { useSettings } from '@/app/settings-provider'
import { localizeAgentDescription } from '@/lib/i18n'
import { isSlashInput, matchCommands, parseSlashCommand, executeCommand } from '@/lib/slash-commands'
import type { SlashCommand } from '@/lib/slash-commands'
import { FileAttachment } from './FileAttachment'
import { MediaPreview } from './MediaPreview'
import { AgentAvatar } from '@/components/AgentAvatar'

interface ConversationViewProps {
  agent: Agent
  conversation: Conversation
  onUpdate: (agentId: string, updater: (prev: ConversationStore) => ConversationStore) => void
  onBack?: () => void
}

/* ── Markdown rendering ──────────────────────────────────── */

function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  // Match URLs, bold, inline code, italic — in priority order
  const regex = /(https?:\/\/[^\s<]+[^\s<.,;:!?)}\]'"])|(\*\*(.+?)\*\*)|(`([^`]+)`)|\*([^*]+)\*/g
  let last = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[1]) {
      // URL
      parts.push(
        <a
          key={match.index}
          href={match[1]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--system-blue)', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          {match[1]}
        </a>
      )
    } else if (match[2]) {
      // Bold
      parts.push(<strong key={match.index} style={{ fontWeight: 'var(--weight-bold)' }}>{match[3]}</strong>)
    } else if (match[4]) {
      // Inline code
      parts.push(
        <code key={match.index} style={{
          background: 'var(--code-bg)',
          border: '1px solid var(--code-border)',
          borderRadius: 5,
          padding: '1px 5px',
          fontSize: '0.88em',
          fontFamily: '"SF Mono", Menlo, monospace',
          color: 'var(--code-text)',
        }}>{match[5]}</code>
      )
    } else if (match[6]) {
      // Italic
      parts.push(<em key={match.index} style={{ fontStyle: 'italic', opacity: 0.85 }}>{match[6]}</em>)
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

function CodeBlock({ code, keyProp }: { code: string; keyProp: number }) {
  const { copy } = useSettings()
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div key={keyProp} className="code-block-wrapper">
      <button
        className="code-copy-btn focus-ring"
        onClick={handleCopy}
        aria-label={copy.chat.copyCodeAria}
      >
        {copied ? copy.chat.copied : copy.chat.copyCode}
      </button>
      <pre><code>{code}</code></pre>
    </div>
  )
}

function formatMessage(content: string): React.ReactNode {
  if (!content) return null
  const lines = content.split('\n')
  const result: React.ReactNode[] = []
  let inCodeBlock = false
  let codeLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeLines = []
      } else {
        inCodeBlock = false
        result.push(<CodeBlock key={i} keyProp={i} code={codeLines.join('\n')} />)
        codeLines = []
      }
      continue
    }
    if (inCodeBlock) { codeLines.push(line); continue }
    if (line.trim() === '') { result.push(<div key={`space-${i}`} style={{ height: 6 }} />); continue }
    if (line.match(/^[-*] /)) {
      result.push(
        <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 2 }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>&bull;</span>
          <span>{inlineFormat(line.slice(2))}</span>
        </div>
      )
      continue
    }
    if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\. /)?.[1]
      result.push(
        <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 2 }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, fontWeight: 'var(--weight-semibold)', minWidth: 16 }}>{num}.</span>
          <span>{inlineFormat(line.replace(/^\d+\. /, ''))}</span>
        </div>
      )
      continue
    }
    if (line.startsWith('### ')) {
      result.push(
        <div key={i} style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-footnote)', marginTop: 'var(--space-2)', marginBottom: 2 }}>
          {inlineFormat(line.slice(4))}
        </div>
      )
      continue
    }
    if (line.startsWith('## ')) {
      result.push(
        <div key={i} style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-subheadline)', marginTop: 'var(--space-3)', marginBottom: 3 }}>
          {inlineFormat(line.slice(3))}
        </div>
      )
      continue
    }
    if (line.startsWith('# ')) {
      result.push(
        <div key={i} style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', marginTop: 'var(--space-3)', marginBottom: 'var(--space-1)' }}>
          {inlineFormat(line.slice(2))}
        </div>
      )
      continue
    }
    result.push(<div key={i} style={{ marginBottom: 1 }}>{inlineFormat(line)}</div>)
  }
  return <>{result}</>
}

/* ── Timestamp formatting ──────────────────────────────── */

function formatTimestamp(ts: number, locale: string, labels: { today: string; yesterday: string }): string {
  const now = new Date()
  const date = new Date(ts)
  const isToday = now.toDateString() === date.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = yesterday.toDateString() === date.toDateString()
  const time = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })

  if (isToday) return `${labels.today} ${time}`
  if (isYesterday) return `${labels.yesterday} ${time}`
  return `${date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} ${time}`
}

function shouldShowTimestamp(messages: Message[], index: number): boolean {
  if (messages[index].role === 'system') return false
  // Find previous non-system message for gap comparison
  let prev = index - 1
  while (prev >= 0 && messages[prev].role === 'system') prev--
  if (prev < 0) return true
  const gap = messages[index].timestamp - messages[prev].timestamp
  return gap > 5 * 60 * 1000 // 5 minutes
}

function shouldShowAvatar(messages: Message[], index: number): boolean {
  if (messages[index].role === 'system') return false
  // Find previous non-system message for role comparison
  let prev = index - 1
  while (prev >= 0 && messages[prev].role === 'system') prev--
  if (prev < 0) return true
  return messages[prev].role !== messages[index].role
}

/* ── Helper: convert File to base64 MediaAttachment ────── */

async function fileToAttachment(file: File): Promise<MediaAttachment> {
  const isImage = file.type.startsWith('image/')
  const isAudio = file.type.startsWith('audio/')

  let dataUrl: string
  if (isImage) {
    // Resize images to max 1200px — reduces base64 size for API transport
    dataUrl = await resizeImage(file, 1200)
  } else {
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  return {
    type: isImage ? 'image' : isAudio ? 'audio' : 'file',
    url: dataUrl,
    name: file.name,
    mimeType: file.type,
    size: dataUrl.length,
  }
}

/** Resize an image file to fit within maxPx on the longest side. Returns a data URL. */
function resizeImage(file: File, maxPx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        const scale = maxPx / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no canvas context')); return }
      ctx.drawImage(img, 0, 0, width, height)
      // Use JPEG for photos (smaller), PNG for small images
      const mimeType = file.size > 50000 ? 'image/jpeg' : 'image/png'
      const quality = mimeType === 'image/jpeg' ? 0.85 : undefined
      resolve(canvas.toDataURL(mimeType, quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
    img.src = url
  })
}

/* ── Render media helpers ─────────────────────────────── */

function renderMedia(
  media: MediaAttachment[],
  isUser: boolean,
  labels: { image: string; file: string },
) {
  const images = media.filter(m => m.type === 'image')
  const files = media.filter(m => m.type === 'file')

  return (
    <>
      {images.map((m, mi) => (
        <div key={`img-${mi}`} style={{
          marginTop: 'var(--space-2)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          maxWidth: 280,
        }}>
          <img
            src={m.url}
            alt={m.name || labels.image}
            style={{ width: '100%', display: 'block', borderRadius: 'var(--radius-lg)', cursor: 'pointer' }}
            onClick={() => window.open(m.url, '_blank')}
          />
        </div>
      ))}
      {files.map((m, mi) => (
        <div key={`file-${mi}`} style={{ marginTop: 'var(--space-2)' }}>
          <FileAttachment
            name={m.name || labels.file}
            size={m.size}
            mimeType={m.mimeType}
            url={m.url}
            isUser={isUser}
          />
        </div>
      ))}
    </>
  )
}

/* ── Component ──────────────────────────────────────────── */

export function ConversationView({ agent, conversation, onUpdate, onBack }: ConversationViewProps) {
  const router = useRouter()
  const { settings, copy, resolvedLocale } = useSettings()
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState<MediaAttachment[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [slashMatches, setSlashMatches] = useState<SlashCommand[]>([])
  const [slashIndex, setSlashIndex] = useState(0)
  const slashMenuOpen = slashMatches.length > 0
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesAreaRef = useRef<HTMLDivElement>(null)

  const messages = conversation?.messages || []
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (mediaOverride?: MediaAttachment[], contentOverride?: string) => {
    const mediaToSend = mediaOverride || [...pendingAttachments]
    const hasText = input.trim().length > 0 || !!contentOverride
    const hasMedia = mediaToSend.length > 0

    if ((!hasText && !hasMedia) || isStreaming) return

    const text = contentOverride || input.trim()
    setInput('')
    setPendingAttachments([])

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Build content label for media-only messages
    let content = text
    if (!content && hasMedia) {
      const labels = mediaToSend.map(m => `[${m.name || m.type}]`)
      content = labels.join(' ')
    }

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      media: hasMedia ? mediaToSend : undefined,
    }

    const assistantMsgId = generateId()
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }

    onUpdate(agent.id, prev => {
      let next = addMessage(prev, agent.id, userMsg)
      next = addMessage(next, agent.id, assistantMsg)
      return next
    })

    setIsStreaming(true)

    // Use ref to read latest messages (avoids stale closure)
    const apiMessages = [...messagesRef.current, userMsg]
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role,
        content: buildApiContent(m),
      }))

    try {
      const res = await fetch(`/api/chat/${agent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, operatorName: settings.operatorName }),
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const chunk = JSON.parse(line.slice(6))
              if (chunk.content) {
                fullContent += chunk.content
                const capturedContent = fullContent
                onUpdate(agent.id, prev => updateLastMessage(prev, agent.id, assistantMsgId, capturedContent, true))
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      }

      const finalContent = fullContent
      onUpdate(agent.id, prev => updateLastMessage(prev, agent.id, assistantMsgId, finalContent, false))
    } catch {
      onUpdate(agent.id, prev => updateLastMessage(prev, agent.id, assistantMsgId, copy.chat.responseError, false))
    } finally {
      setIsStreaming(false)
      textareaRef.current?.focus()
    }
  }, [input, pendingAttachments, isStreaming, agent.id, onUpdate, settings.operatorName, copy.chat.responseError])

  function runSlashCommand(command: string) {
    const result = executeCommand(command, agent)
    if (result.action === 'clear') {
      clearChat()
    } else {
      const sysMsg: Message = {
        id: generateId(),
        role: 'system',
        content: result.content,
        timestamp: Date.now(),
      }
      onUpdate(agent.id, prev => addMessage(prev, agent.id, sysMsg))
    }
    setInput('')
    setSlashMatches([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleSlashSelect(cmd: SlashCommand) {
    runSlashCommand(cmd.name)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashIndex(i => (i + 1) % slashMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashIndex(i => (i - 1 + slashMatches.length) % slashMatches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        handleSlashSelect(slashMatches[slashIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setSlashMatches([])
        return
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      textareaRef.current?.blur()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const parsed = parseSlashCommand(input)
      if (parsed) {
        runSlashCommand(parsed.command)
        return
      }
      sendMessage()
    }
  }

  async function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newAttachments: MediaAttachment[] = []
    for (let i = 0; i < files.length; i++) {
      newAttachments.push(await fileToAttachment(files[i]))
    }
    setPendingAttachments(prev => [...prev, ...newAttachments])
    e.target.value = ''
  }

  function removePendingAttachment(index: number) {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index))
  }

  /* ── Clipboard paste handler ──────────────────────────── */

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault()
        const file = items[i].getAsFile()
        if (file) {
          const att = await fileToAttachment(file)
          setPendingAttachments(prev => [...prev, att])
        }
        return
      }
    }
  }

  /* ── Drag and drop handlers ────────────────────────────── */

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    // Only leave if we're actually leaving the container
    const rect = messagesAreaRef.current?.getBoundingClientRect()
    if (rect) {
      const { clientX, clientY } = e
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        setIsDragOver(false)
      }
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    const newAttachments: MediaAttachment[] = []
    for (let i = 0; i < files.length; i++) {
      newAttachments.push(await fileToAttachment(files[i]))
    }
    setPendingAttachments(prev => [...prev, ...newAttachments])
  }

  /* ── TTS playback ─────────────────────────────────────── */

  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null)
  const [ttsPlayingId, setTtsPlayingId] = useState<string | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsObjectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      ttsAudioRef.current?.pause()
      if (ttsObjectUrlRef.current) URL.revokeObjectURL(ttsObjectUrlRef.current)
    }
  }, [])

  const stopTts = useCallback(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current.currentTime = 0
      ttsAudioRef.current = null
    }
    if (ttsObjectUrlRef.current) {
      URL.revokeObjectURL(ttsObjectUrlRef.current)
      ttsObjectUrlRef.current = null
    }
    setTtsPlayingId(null)
    setTtsLoadingId(null)
  }, [])

  const playTts = useCallback(async (msgId: string, text: string) => {
    if (ttsPlayingId === msgId) { stopTts(); return }
    stopTts()
    setTtsLoadingId(msgId)

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('TTS request failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      ttsObjectUrlRef.current = url

      const audio = new Audio(url)
      ttsAudioRef.current = audio

      audio.onended = () => {
        setTtsPlayingId(null)
        ttsAudioRef.current = null
        if (ttsObjectUrlRef.current) {
          URL.revokeObjectURL(ttsObjectUrlRef.current)
          ttsObjectUrlRef.current = null
        }
      }
      audio.onerror = () => stopTts()

      await audio.play()
      setTtsLoadingId(null)
      setTtsPlayingId(msgId)
    } catch {
      stopTts()
    }
  }, [ttsPlayingId, stopTts])

  const speakerPlayIcon = useMemo(() => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ), [])

  const speakerStopIcon = useMemo(() => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ), [])

  function clearChat() {
    deleteOnServer(agent.id)
    onUpdate(agent.id, prev => ({
      ...prev,
      [agent.id]: {
        agentId: agent.id,
        messages: [{
          id: generateId(),
          role: 'assistant' as const,
          content: copy.chat.clearChatSeed(
            agent.name,
            localizeAgentDescription(agent.id, agent.description, resolvedLocale),
          ),
          timestamp: Date.now(),
        }],
        unread: 0,
        lastActivity: Date.now(),
      }
    }))
  }

  const hasContent = input.trim().length > 0 || pendingAttachments.length > 0

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg)',
    }}>
      {/* ── Header ─────────────────────────────────── */}
      <div style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-4)',
        borderBottom: '1px solid var(--separator)',
        background: 'var(--material-thick)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flexShrink: 0,
      }}>
        {/* Mobile back button */}
        {onBack && (
          <button
            className="md:hidden btn-ghost focus-ring"
            onClick={onBack}
            aria-label={copy.chat.backToAgents}
            style={{
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              marginRight: 'var(--space-2)',
              fontSize: 'var(--text-subheadline)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {copy.chat.back}
          </button>
        )}

        {/* Agent info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flex: 1,
          minWidth: 0,
        }}>
          <AgentAvatar agent={agent} size={32} borderRadius={16} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 'var(--text-subheadline)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
              letterSpacing: '-0.2px',
              lineHeight: 1.2,
            }}>
              {agent.name}
            </div>
            <div style={{
              fontSize: 'var(--text-caption2)',
              color: 'var(--text-tertiary)',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {agent.title}{agent.model && ` · ${agent.model.split('/').pop()}`}{messages.length > 1 && ` · ${copy.chat.synced}`}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <button
            className="btn-ghost focus-ring"
            aria-label={copy.chat.viewAgentProfile}
            onClick={() => router.push(`/agents/${agent.id}`)}
            style={{
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
          <button
            className="btn-ghost focus-ring"
            aria-label={copy.chat.clearConversation}
            onClick={clearChat}
            style={{
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Messages ──────────────────────────────── */}
      <div
        ref={messagesAreaRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--bg)',
          padding: 'var(--space-5) 0 var(--space-16) 0',
          position: 'relative',
        }}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--accent-fill)',
            border: '2px dashed var(--accent)',
            borderRadius: 'var(--radius-md)',
            margin: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
            pointerEvents: 'none',
          }}>
            <div style={{
              fontSize: 'var(--text-subheadline)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--accent)',
            }}>
              {copy.chat.dropFiles}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user'
          const showAvatar = shouldShowAvatar(messages, i)
          const showTimestamp = shouldShowTimestamp(messages, i)
          // System messages render their own block — skip user/assistant layout logic
          const isSystem = msg.role === 'system'
          const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1 && (isStreaming || msg.isStreaming)
          const showTypingDots = isLastAssistant && !msg.content
          const media = isSystem ? [] : (msg.media || parseMedia(msg.content))

          // Strip media URLs from text for display
          let textContent = msg.content
          if (!isSystem && media.length > 0 && !msg.media) {
            media.forEach(m => {
              textContent = textContent.replace(m.url, '')
              textContent = textContent.replace(/!\[[^\]]*\]\([^\)]+\)/g, '')
            })
            textContent = textContent.trim()
          }
          // Hide auto-generated content labels for media-only messages
          if (!isSystem && msg.media && msg.media.length > 0) {
            const isAutoLabel = textContent.startsWith('[') && textContent.endsWith(']')
            if (isAutoLabel) textContent = ''
          }

          return (
            <div key={msg.id || i} className="animate-fade-in">
              {/* Timestamp divider */}
              {showTimestamp && (
                <div style={{
                  textAlign: 'center',
                  padding: 'var(--space-3) 0',
                  fontSize: 'var(--text-caption2)',
                  color: 'var(--text-tertiary)',
                }}>
                  {formatTimestamp(msg.timestamp, resolvedLocale, {
                    today: copy.chat.today,
                    yesterday: copy.chat.yesterday,
                  })}
                </div>
              )}

              {/* Spacing between role switches (skip for system messages) */}
              {!showTimestamp && i > 0 && msg.role !== 'system' && (() => {
                let prev = i - 1
                while (prev >= 0 && messages[prev].role === 'system') prev--
                const prevRole = prev >= 0 ? messages[prev].role : msg.role
                return <div style={{ height: prevRole !== msg.role ? 'var(--space-4)' : 'var(--space-1)' }} />
              })()}

              {/* User message */}
              {isUser && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  padding: '0 var(--space-4)',
                  marginBottom: 'var(--space-1)',
                }}>
                  {textContent && (
                    <div className="msg-user" style={{
                      maxWidth: '75%',
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)',
                      background: 'var(--accent)',
                      color: 'var(--accent-contrast)',
                      fontSize: 'var(--text-subheadline)',
                      lineHeight: 'var(--leading-relaxed)',
                      fontWeight: 'var(--weight-medium)',
                      boxShadow: 'var(--shadow-subtle)',
                    }}>
                      {textContent}
                    </div>
                  )}
                  {media.length > 0 && (
                    <div style={{ maxWidth: '75%' }}>
                      {renderMedia(media, true, { image: copy.chat.image, file: copy.chat.file })}
                    </div>
                  )}
                </div>
              )}

              {/* System message (slash command result) */}
              {msg.role === 'system' && (
                <div style={{
                  padding: '0 var(--space-4)',
                  marginBottom: 'var(--space-1)',
                }}>
                  <div style={{
                    maxWidth: '85%',
                    margin: '0 auto',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--fill-tertiary)',
                    borderLeft: '3px solid var(--accent)',
                    color: 'var(--text-secondary)',
                    fontSize: 'var(--text-footnote)',
                    lineHeight: 'var(--leading-relaxed)',
                  }}>
                    {formatMessage(msg.content)}
                  </div>
                </div>
              )}

              {/* Assistant message */}
              {msg.role === 'assistant' && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  padding: '0 var(--space-4)',
                  marginBottom: 'var(--space-1)',
                }}>
                  {/* Small avatar */}
                  <div style={{
                    flexShrink: 0,
                    width: 28,
                    marginRight: 'var(--space-2)',
                  }}>
                    {showAvatar ? (
                      <AgentAvatar agent={agent} size={28} borderRadius={14} />
                    ) : <div style={{ width: 28 }} />}
                  </div>

                  <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column' }}>
                    {/* Typing indicator */}
                    {showTypingDots && (
                      <div className="msg-assistant" style={{
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)',
                        background: 'var(--material-thin)',
                        border: '1px solid var(--separator)',
                      }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 16 }}>
                          <span className="typing-dot" style={{ animationDelay: '0ms' }} />
                          <span className="typing-dot" style={{ animationDelay: '150ms' }} />
                          <span className="typing-dot" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}

                    {/* Text bubble */}
                    {textContent && (
                      <div className="msg-assistant" style={{
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)',
                        background: 'var(--material-thin)',
                        border: '1px solid var(--separator)',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--text-subheadline)',
                        lineHeight: 'var(--leading-relaxed)',
                      }}>
                        {formatMessage(textContent)}
                        {/* Streaming cursor */}
                        {isLastAssistant && textContent && (
                          <span style={{
                            display: 'inline-block',
                            width: 2,
                            height: '1.1em',
                            background: 'var(--accent)',
                            marginLeft: 2,
                            animation: 'blink-cursor 1s step-end infinite',
                            verticalAlign: 'text-bottom',
                          }} />
                        )}
                      </div>
                    )}

                    {/* Media attachments */}
                    {media.length > 0 && renderMedia(media, false, { image: copy.chat.image, file: copy.chat.file })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Input Area ────────────────────────────── */}
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        borderTop: '1px solid var(--separator)',
        background: 'var(--material-regular)',
        flexShrink: 0,
      }}>
        {/* Slash command autocomplete dropdown */}
        {slashMenuOpen && (
          <div
            className="animate-slide-down"
            style={{
              marginBottom: 'var(--space-2)',
              background: 'var(--material-thick)',
              border: '1px solid var(--separator)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-overlay)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              overflow: 'hidden',
            }}
          >
            {slashMatches.map((cmd, i) => (
              <button
                key={cmd.name}
                onMouseDown={e => {
                  e.preventDefault() // prevent textarea blur
                  handleSlashSelect(cmd)
                }}
                onMouseEnter={() => setSlashIndex(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  background: i === slashIndex ? 'var(--fill-secondary)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-subheadline)',
                  transition: 'background 100ms',
                }}
              >
                <span style={{
                  color: 'var(--accent)',
                  fontWeight: 'var(--weight-semibold)',
                  fontFamily: '"SF Mono", Menlo, monospace',
                  fontSize: 'var(--text-footnote)',
                  minWidth: 60,
                }}>
                  {cmd.name}
                </span>
                <span style={{
                  color: 'var(--text-tertiary)',
                  fontSize: 'var(--text-caption1)',
                }}>
                  {cmd.description}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Pending attachments preview */}
        {pendingAttachments.length > 0 && (
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <MediaPreview
              attachments={pendingAttachments}
              onRemove={removePendingAttachment}
            />
          </div>
        )}

        <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 'var(--space-2)',
            background: 'var(--fill-secondary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-2) var(--space-3)',
            border: '1px solid var(--separator)',
          }}>
            {/* Attach button */}
            <button
              className="btn-ghost focus-ring"
              aria-label={copy.chat.attachFile}
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: 'var(--space-1)',
                flexShrink: 0,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.json,.zip"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileAttach}
            />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                const val = e.target.value
                setInput(val)
                if (isSlashInput(val) && !val.includes(' ')) {
                  const matches = matchCommands(val)
                  setSlashMatches(matches)
                  setSlashIndex(0)
                } else {
                  setSlashMatches([])
                }
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={copy.chat.messagePlaceholder(agent.name)}
              rows={1}
              disabled={isStreaming}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-subheadline)',
                lineHeight: 'var(--leading-normal)',
                maxHeight: 120,
                minHeight: 24,
                padding: '2px 0',
                opacity: isStreaming ? 0.5 : 1,
              }}
              onInput={e => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
            />

            {/* Send button */}
            <button
              className="focus-ring"
              onClick={() => sendMessage()}
              disabled={!hasContent || isStreaming}
              aria-label={copy.chat.sendMessage}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: hasContent ? 'var(--accent)' : 'var(--fill-tertiary)',
                color: hasContent ? '#000' : 'var(--text-quaternary)',
                border: 'none',
                cursor: hasContent ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 'var(--weight-bold)',
                transition: 'all 150ms var(--ease-smooth)',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>

        {/* Hint */}
        <div style={{
          fontSize: 'var(--text-caption2)',
          color: 'var(--text-quaternary)',
          textAlign: 'center',
          marginTop: 'var(--space-1)',
        }}>
          {copy.chat.inputHint}
        </div>
      </div>
    </div>
  )
}
