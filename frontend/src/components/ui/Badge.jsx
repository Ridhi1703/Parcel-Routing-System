const STATUS_MAP = {
  ROUTED:         { bg: 'var(--status-routed-bg)',  color: 'var(--status-routed-text)' },
  INSURANCE_HOLD: { bg: 'var(--status-hold-bg)',    color: 'var(--status-hold-text)' },
  FAILED:         { bg: 'var(--status-failed-bg)',  color: 'var(--status-failed-text)' },
  PENDING:        { bg: 'var(--status-pending-bg)', color: 'var(--status-pending-text)' },
  QUEUED:         { bg: 'var(--status-pending-bg)', color: 'var(--status-pending-text)' },
  DEAD_LETTER:    { bg: 'var(--status-dead-bg)',    color: 'var(--status-dead-text)' },
  PROCESSING:     { bg: 'var(--status-pending-bg)', color: 'var(--status-pending-text)' },
  COMPLETED:      { bg: 'var(--status-routed-bg)',  color: 'var(--status-routed-text)' },
  PARTIAL:        { bg: 'var(--status-hold-bg)',    color: 'var(--status-hold-text)' },
  DRAFT:          { bg: 'var(--status-dead-bg)',    color: 'var(--status-dead-text)' },
  ACTIVE:         { bg: 'var(--status-routed-bg)',  color: 'var(--status-routed-text)' },
  SUPERSEDED:     { bg: 'var(--status-dead-bg)',    color: 'var(--status-dead-text)' },
}

export default function Badge({ status }) {
  const { bg, color } = STATUS_MAP[status] || { bg: 'var(--status-dead-bg)', color: 'var(--status-dead-text)' }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px',
      fontSize: '12px', fontWeight: 600, color, background: bg,
      borderRadius: '999px', letterSpacing: '0.02em',
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  )
}
