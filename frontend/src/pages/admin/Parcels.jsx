import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getDashboardParcels } from '../../api/dashboard'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'

const COLUMNS = [
  { key: 'id', label: 'Parcel ID', cellStyle: { fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-nav)' } },
  { key: 'destination_country', label: 'Country' },
  { key: 'weight_kg', label: 'Weight', render: (v) => `${Number(v).toFixed(3)} kg` },
  { key: 'value_eur', label: 'Value', render: (v) => `₹${Number(v).toFixed(0)}` },
  { key: 'status', label: 'Status', render: (v) => <Badge status={v} /> },
  { key: 'routing_decision', label: 'Routed To', render: (v) => v
    ? <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{v}</span>
    : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
  },
  { key: 'submitted_by_username', label: 'User', render: (v) => v ?? '—' },
  { key: 'created_at', label: 'Submitted', render: (v) => new Date(v).toISOString().slice(0, 16).replace('T', ' ') },
]

const STATUSES = ['', 'PENDING', 'QUEUED', 'ROUTED', 'INSURANCE_HOLD', 'FAILED', 'DEAD_LETTER']

const card = {
  background: 'var(--bg-card)', borderRadius: '12px',
  border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
}

const selectStyle = {
  background: 'var(--bg-input)', border: '1.5px solid var(--border)', color: 'var(--text-base)',
  padding: '8px 12px', borderRadius: '8px', fontSize: '14px', outline: 'none',
  cursor: 'pointer',
}

const pageBtn = (disabled) => ({
  background: 'var(--bg-card)', border: '1px solid var(--border)', color: disabled ? 'var(--text-muted)' : 'var(--text-body)',
  padding: '6px 14px', borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '14px', transition: 'all 150ms ease',
})

export default function AdminParcels() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [country, setCountry] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-parcels', page, status, country],
    queryFn: () => getDashboardParcels({ page, page_size: 50, status: status || undefined, country: country || undefined }).then((r) => r.data),
  })

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>All Parcels</h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Browse and filter all parcels in the system.</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-body)', display: 'block', marginBottom: '5px' }}>Status</label>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} style={selectStyle}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </select>
        </div>
        <div style={{ width: '140px' }}>
          <Input label="Country (ISO)" placeholder="IN" value={country} onChange={(e) => { setCountry(e.target.value.toUpperCase()); setPage(1) }} maxLength={2} />
        </div>
      </div>

      <div style={card}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '15px' }}>Loading…</div>
        ) : (
          <Table columns={COLUMNS} data={data?.items || []} onRowClick={(row) => navigate(`/parcels/${row.id}`)} emptyMessage="No parcels found." />
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center', justifyContent: 'flex-end' }}>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn(page === 1)}>
          Previous
        </button>
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', padding: '0 8px' }}>
          Page {page} · {data?.total ?? 0} total
        </span>
        <button onClick={() => setPage((p) => p + 1)} disabled={!data || data.items.length < 50} style={pageBtn(!data || data.items.length < 50)}>
          Next
        </button>
      </div>
    </div>
  )
}
