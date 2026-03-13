'use client'

import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          padding: 'var(--space-6)',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}>
          <p style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)' }}>
            Something went wrong
          </p>
          <p style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-tertiary)' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn-ghost focus-ring"
            style={{
              marginTop: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--text-footnote)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--separator)',
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
