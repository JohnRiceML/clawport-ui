import type { ReactNode } from 'react'

export function StakeholderSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      style={{
        background: 'var(--material-regular)',
        border: '1px solid var(--separator)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-start justify-between"
        style={{
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--separator)',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--text-headline)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </h2>
          {description && (
            <p
              style={{
                marginTop: 'var(--space-1)',
                marginBottom: 0,
                fontSize: 'var(--text-footnote)',
                color: 'var(--text-secondary)',
              }}
            >
              {description}
            </p>
          )}
        </div>
        {action}
      </div>

      <div style={{ padding: 'var(--space-4) var(--space-5)' }}>{children}</div>
    </section>
  )
}
