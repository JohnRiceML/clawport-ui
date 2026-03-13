export function StakeholderMetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'good' | 'warn' | 'bad'
}) {
  const color =
    tone === 'good'
      ? 'var(--system-green)'
      : tone === 'warn'
        ? 'var(--system-orange)'
        : tone === 'bad'
          ? 'var(--system-red)'
          : 'var(--text-primary)'

  return (
    <div
      style={{
        background: 'var(--material-regular)',
        border: '1px solid var(--separator)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
      }}
    >
      <div
        style={{
          fontSize: 'var(--text-caption1)',
          color: 'var(--text-tertiary)',
          marginBottom: 'var(--space-1)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 'var(--text-title3)',
          fontWeight: 'var(--weight-bold)',
          color,
        }}
      >
        {value}
      </div>
    </div>
  )
}
