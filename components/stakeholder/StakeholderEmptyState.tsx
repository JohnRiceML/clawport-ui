export function StakeholderEmptyState({
  audienceLabel,
}: {
  audienceLabel: string
}) {
  return (
    <div
      style={{
        background: 'var(--material-regular)',
        border: '1px solid var(--separator)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-6)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 'var(--text-title3)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-2)',
        }}
      >
        No {audienceLabel.toLowerCase()} updates yet
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--text-footnote)',
          color: 'var(--text-secondary)',
        }}
      >
        This summary will populate once stakeholder-visible scheduled outputs are configured or delivered.
      </p>
    </div>
  )
}
