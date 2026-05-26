import { useNotificationStore } from '../../stores/notifications'

const TYPE_STYLES = {
  info:    { bg: '#eef2ff', border: '#c7d2fe', color: '#3730a3' },
  success: { bg: '#d1fae5', border: '#6ee7b7', color: '#065f46' },
  error:   { bg: '#fee2e2', border: '#fca5a5', color: '#991b1b' },
  warning: { bg: '#fef3c7', border: '#fde68a', color: '#92400e' },
}

export default function Toast() {
  const { toasts, removeToast } = useNotificationStore()

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 2000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {toasts.map((t) => {
        const s = TYPE_STYLES[t.type] || TYPE_STYLES.info
        return (
          <div key={t.id} style={{
            background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
            fontSize: '14px', fontWeight: 500, maxWidth: '360px', color: s.color,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button onClick={() => removeToast(t.id)}
              style={{ background: 'none', border: 'none', color: s.color, cursor: 'pointer', fontSize: '18px', lineHeight: 1, opacity: 0.6 }}>
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
