import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import Button from './Button'

export default function Modal({ title, children, onClose, open }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        padding: '24px', minWidth: '480px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-heading)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '2px 6px', borderRadius: '6px' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * Full-screen confirmation dialog.
 * Use for all destructive / important confirmations.
 */
export function ConfirmModal({
  open, title, message, confirmLabel = 'Confirm', variant = 'danger',
  onConfirm, onCancel, isPending = false,
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          padding: '32px 36px', width: '420px', maxWidth: '92vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px',
          background: variant === 'danger' ? '#fee2e2' : '#fef3c7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '20px',
        }}>
          <AlertTriangle size={22} color={variant === 'danger' ? '#ef4444' : '#d97706'} />
        </div>

        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '8px' }}>{title}</h2>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '28px' }}>{message}</p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button variant={variant === 'warning' ? 'primary' : variant} onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Please wait…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
