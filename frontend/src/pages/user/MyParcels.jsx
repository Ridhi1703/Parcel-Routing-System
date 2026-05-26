import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listParcels } from '../../api/parcels'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import { X } from 'lucide-react'

const STATUSES = ['PENDING', 'QUEUED', 'ROUTED', 'INSURANCE_HOLD', 'FAILED', 'DEAD_LETTER']

const COLUMNS = [
  { key: 'id', label: 'Parcel ID', cellStyle: { fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-secondary)' } },
  { key: 'destination_country', label: 'Country' },
  { key: 'weight_kg', label: 'Weight', render: (v) => `${Number(v).toFixed(3)} kg` },
  { key: 'value_eur', label: 'Value', render: (v) => `₹${Number(v).toFixed(0)}` },
  { key: 'status', label: 'Status', render: (v) => <Badge status={v} /> },
  { key: 'routing_decision', label: 'Routed To', render: (v) => v
    ? <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{v}</span>
    : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
  },
  { key: 'created_at', label: 'Submitted', render: (v) => new Date(v).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' },
]

const card = { background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }
const pageBtn = (disabled) => ({
  background: 'var(--bg-card)', border: '1px solid var(--border)', color: disabled ? 'var(--text-muted)' : 'var(--text-body)',
  padding: '6px 14px', borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '14px', transition: 'all 150ms ease',
})

const filterInput = {
  background: 'var(--bg-input)', border: '1.5px solid var(--border)', color: 'var(--text-base)',
  padding: '7px 12px', borderRadius: '8px', fontSize: '14px', outline: 'none',
}

export default function MyParcels() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [country, setCountry] = useState('')

  const params = { page, page_size: 50 }
  if (status) params.status = status
  if (country) params.country = country.toUpperCase()

  const { data, isLoading } = useQuery({
    queryKey: ['my-parcels', page, status, country],
    queryFn: () => listParcels(params).then((r) => r.data),
  })

  const hasFilters = status || country
  const clearFilters = () => { setStatus(''); setCountry(''); setPage(1) }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>My Parcels</h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Track all parcels you have submitted.</p>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          style={{ ...filterInput, minWidth: '140px' }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          placeholder="Country (e.g. IN)"
          value={country}
          maxLength={2}
          onChange={(e) => { setCountry(e.target.value); setPage(1) }}
          style={{ ...filterInput, width: '140px', textTransform: 'uppercase' }}
        />
        {hasFilters && (
          <button onClick={clearFilters}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: '4px' }}>
            <X size={13} /> Clear
          </button>
        )}
        {data && (
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {data.total} parcel{data.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div style={card}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '15px' }}>Loading…</div>
        ) : (
          <Table columns={COLUMNS} data={data?.items || []} onRowClick={(row) => navigate(`/parcels/${row.id}`)} emptyMessage="No parcels found." />
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center', justifyContent: 'flex-end' }}>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn(page === 1)}>Previous</button>
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', padding: '0 8px' }}>Page {page} · {data?.total ?? 0} total</span>
        <button onClick={() => setPage((p) => p + 1)} disabled={!data || data.items.length < 50} style={pageBtn(!data || data.items.length < 50)}>Next</button>
      </div>
    </div>
  )
}
