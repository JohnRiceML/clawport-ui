'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { formatDuration } from '@/lib/audio-recorder'

interface VoiceMessageProps {
  src: string
  duration: number
  waveform: number[]
  isUser: boolean
}

export function VoiceMessage({ src, duration, waveform, isUser }: VoiceMessageProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0-1
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    const audio = new Audio(src)
    audioRef.current = audio

    audio.addEventListener('timeupdate', () => {
      if (audio.duration && isFinite(audio.duration)) {
        setProgress(audio.currentTime / audio.duration)
        setCurrentTime(audio.currentTime)
      }
    })
    audio.addEventListener('ended', () => {
      setPlaying(false)
      setProgress(0)
      setCurrentTime(0)
    })
    audio.addEventListener('pause', () => setPlaying(false))
    audio.addEventListener('play', () => setPlaying(true))

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [src])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.play().catch(() => {})
    }
  }, [playing])

  const bars = waveform.length > 0 ? waveform : Array(50).fill(0.1)
  const displayTime = playing ? currentTime : duration

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
      minWidth: 200,
    }}>
      {/* Play/Pause button */}
      <button
        onClick={toggle}
        aria-label={playing ? '暂停' : '播放'}
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: isUser ? 'rgba(0,0,0,0.2)' : 'var(--fill-secondary)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: isUser ? '#000' : 'var(--text-primary)',
        }}
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6,4 20,12 6,20" />
          </svg>
        )}
      </button>

      {/* Waveform bars */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 28,
      }}>
        {bars.map((amp, i) => {
          const barProgress = i / bars.length
          const isPlayed = barProgress <= progress
          return (
            <div
              key={i}
              style={{
                width: 3,
                borderRadius: 1.5,
                height: `${Math.max(4, amp * 24)}px`,
                background: isUser
                  ? (isPlayed ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.25)')
                  : (isPlayed ? 'var(--accent)' : 'var(--fill-primary)'),
                transition: 'background 100ms ease',
                flexShrink: 0,
              }}
            />
          )
        })}
      </div>

      {/* Duration label */}
      <span style={{
        fontSize: 'var(--text-caption2)',
        color: isUser ? 'rgba(0,0,0,0.6)' : 'var(--text-tertiary)',
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
        minWidth: 28,
        textAlign: 'right',
      }}>
        {formatDuration(displayTime)}
      </span>
    </div>
  )
}
