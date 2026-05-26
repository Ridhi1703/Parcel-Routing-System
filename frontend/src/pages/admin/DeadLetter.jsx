import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDLQ } from '../../api/dashboard'
import client from '../../api/client'
import Table from '../../components/ui/Table'
import Button from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/Modal'
import { useNotificationStore } from '../../stores/notifications'
import { useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

const card = {
  background: 'var(--bg-card)', borderRadius: '12px',
  border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
}

export default function DeadLetter() {
  const qc = useQueryClient()
  const { addToast } = useNotificationStore()
  const [selected, setSelected] = useState(new Set())
  const [confirmDismiss, setConfirmDismiss] = useState(null)

  const { data } = useQuery({ queryKey: ['dlq'], queryFn: () => getDLQ().then((r) => r.data) })

  const retryMutation = useMutation({
    mutationFn: (parcelId) => client.post(`/parcels/${parcelId}/retry`),
    onSuccess: () => { qc.invalidateQueries(['dlq']); addToast('Retried', 'success') },
    onError: () => addToast('Retry failed', 'error'),
  })

  const dismissMutation = useMutation({
    mutationFn: (parcelId) => client.post(`/parcels/${parcelId}/dismiss`),
    onSuccess: () => { qc.invalidateQueries(['dlq']); addToast('Dismissed', 'success') },
    onError: () => addToast('Dismiss failed', 'error'),
  })

  const handleConfirmDismiss = () => {
    if (confirmDismiss === 'bulk') {
      [...selected].forEach((id) => dismissMutation.mutate(id))
      setSelected(new Set())
    } else {
      dismissMutation.mutate(confirmDismiss)
    }
    setConfirmDismiss(null)
  }

  const items = data?.items || []

  const COLUMNS = [
    {
      key: '_sel', label: '',
      render: (_, row) => (
        <input type="checkbox" checked={selected.has(row.id)}
          onChange={(e) => setSelected((prev) => { const s = new Set(prev); e.target.checked ? s.add(row.id) : s.delete(row.id); return s })}
          onClick={(e) => e.stopPropagation()}
          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }} />
      )
    },
    { key: 'id', label: 'Parcel ID', cellStyle: { fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-secondary)' } },
    { key: 'destination_country', label: 'Country' },
    { key: 'routing_decision', label: 'Last Routed To', render: (v) => v
      ? <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>{v}</span>
      : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
    },
    { key: 'updated_at', label: 'Failed at', render: (v) => v ? new Date(v).toISOString().slice(0, 16).replace('T', ' ') : '—' },
    {
      key: '_actions', label: 'Actions',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => retryMutation.mutate(row.id)}>
            <RefreshCw size={12} /> Retry
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDismiss(row.id)}>
            <X size={12} /> Dismiss
          </Button>
        </div>
      )
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>Dead Letter Queue</h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Parcels that failed routing after all retries.</p>
        </div>
        {selected.size > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selected.size} selected</span>
            <Button variant="secondary" onClick={() => [...selected].forEach((id) => retryMutation.mutate(id))}>
              <RefreshCw size={14} /> Retry all
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDismiss('bulk')}>
              <X size={14} /> Dismiss all
            </Button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ ...card, padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>Dead Letter Queue is empty</div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>All parcels have been successfully processed.</div>
        </div>
      ) : (
        <div style={card}>
          <Table columns={COLUMNS} data={items} emptyMessage="No items in the dead letter queue." />
        </div>
      )}

      <ConfirmModal
        open={!!confirmDismiss}
        title="Dismiss parcel(s)"
        message={
          confirmDismiss === 'bulk'
            ? `Permanently dismiss ${selected.size} selected parcel(s) from the queue? This cannot be undone.`
            : 'Permanently dismiss this parcel from the dead letter queue? This cannot be undone.'
        }
        confirmLabel="Dismiss"
        variant="danger"
        onConfirm={handleConfirmDismiss}
        onCancel={() => setConfirmDismiss(null)}
      />
    </div>
  )
}
