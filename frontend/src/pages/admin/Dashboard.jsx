import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getSummary, getDashboardParcels } from '../../api/dashboard'
import { requeueStuck } from '../../api/parcels'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import Badge from '../../components/ui/Badge'
import Table from '../../components/ui/Table'
import { Package, AlertTriangle, XCircle, Inbox, Search, X, RefreshCw } from 'lucide-react'

const STATUSES = ['', 'PENDING', 'QUEUED', 'ROUTED', 'INSURANCE_HOLD', 'FAILED', 'DEAD_LETTER']

const STATUS_CHART_COLORS = {
  ROUTED: '#10b981', INSURANCE_HOLD: '#f59e0b', FAILED: '#ef4444',
  PENDING: '#4f46e5', QUEUED: '#818cf8', DEAD_LETTER: '#94a3b8',
}

const COLUMNS = [
  { key: 'id', label: 'Parcel ID', cellStyle: { fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-nav)' } },
  { key: 'destination_country', label: 'Country' },
  { key: 'weight_kg', label: 'Weight', render: (v) => `${Number(v).toFixed(3)} kg` },
  { key: 'value_eur', label: 'Value', render: (v) => `₹${Number(v).toFixed(0)}` },
  { key: 'status', label: 'Status', render: (v) => <Badge status={v} /> },
  { key: 'routing_decision', label: 'Routed To', render: (v) => v ? (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: 'var(--primary-light)', color: 'var(--primary)' }}>{v}</span>
  ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span> },
  { key: 'created_at', label: 'Submitted', render: (v) => new Date(v).toISOString().slice(0, 16).replace('T', ' ') },
]

const card = {
  background: 'var(--bg-card)', borderRadius: '12px',
  border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
}

const selectStyle = {
  background: 'var(--bg-input)', border: '1.5px solid var(--border)', color: 'var(--text-base)',
  padding: '8px 12px', borderRadius: '8px', fontSize: '14px', outline: 'none', cursor: 'pointer',
}

function StatCard({ label, value, icon, iconBg, iconColor }) {
  return (
    <div style={{ ...card, padding: '20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
      <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon(iconColor)}
      </div>
      <div>
        <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.1 }}>{value ?? '—'}</div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-body)', marginTop: '3px' }}>{label}</div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [country, setCountry] = useState('')
  const [page, setPage] = useState(1)
  const [requeueMsg, setRequeueMsg] = useState(null)

  const requeueMutation = useMutation({
    mutationFn: requeueStuck,
    onSuccess: (res) => {
      setRequeueMsg(`Re-queued ${res.data.requeued} parcel(s).`)
      queryClient.invalidateQueries({ queryKey: ['dashboard-parcels'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      setTimeout(() => setRequeueMsg(null), 4000)
    },
  })

  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: () => getSummary().then((r) => r.data),
  })

  const { data: parcels, isLoading } = useQuery({
    queryKey: ['dashboard-parcels', status, country, page],
    queryFn: () => getDashboardParcels({
      page,
      page_size: 50,
      status: status || undefined,
      country: country || undefined,
    }).then((r) => r.data),
  })

  const chartData = summary
    ? Object.entries(summary).filter(([k]) => k !== 'total').map(([name, value]) => ({ name, value }))
    : []

  const hasFilters = status || country

  const clearFilters = () => { setStatus(''); setCountry(''); setPage(1) }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>Dashboard</h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Live overview of all parcel routing activity.</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Parcels"    value={summary?.total}           icon={(c) => <Package      size={20} color={c} />} iconBg="var(--primary-light)" iconColor="var(--primary)" />
        <StatCard label="Insurance Hold"  value={summary?.INSURANCE_HOLD}  icon={(c) => <AlertTriangle size={20} color={c} />} iconBg="#fef3c7" iconColor="#d97706" />
        <StatCard label="Failed"          value={summary?.FAILED}          icon={(c) => <XCircle      size={20} color={c} />} iconBg="#fee2e2" iconColor="#dc2626" />
        <StatCard label="Dead Letter"     value={summary?.DEAD_LETTER}     icon={(c) => <Inbox        size={20} color={c} />} iconBg="var(--bg-tag)" iconColor="var(--text-secondary)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>

        {/* Parcels panel */}
        <div style={card}>
          {/* Filter bar */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-inner)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <Search size={14} />
              <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Filter</span>
            </div>

            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} style={{ ...selectStyle, fontSize: '13px', padding: '6px 10px' }}>
              {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
            </select>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                value={country}
                onChange={(e) => { setCountry(e.target.value.toUpperCase().slice(0, 2)); setPage(1) }}
                placeholder="Country (IN)"
                maxLength={2}
                style={{ ...selectStyle, fontSize: '13px', padding: '6px 10px', width: '120px', textTransform: 'uppercase' }}
              />
            </div>

            {hasFilters && (
              <button onClick={clearFilters} style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-tag)',
                border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px',
                cursor: 'pointer', transition: 'all 150ms ease',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-tag)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                <X size={12} /> Clear
              </button>
            )}

            <button
              onClick={() => requeueMutation.mutate()}
              disabled={requeueMutation.isPending}
              title="Re-dispatch all parcels stuck in QUEUED status"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                fontSize: '13px', fontWeight: 600,
                color: requeueMutation.isPending ? 'var(--text-muted)' : 'var(--primary)',
                background: 'var(--primary-light)',
                border: '1px solid var(--primary)',
                borderRadius: '6px', padding: '5px 10px',
                cursor: requeueMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: requeueMutation.isPending ? 0.6 : 1,
                transition: 'all 150ms ease',
              }}
            >
              <RefreshCw size={12} /> {requeueMutation.isPending ? 'Requeueing…' : 'Requeue Stuck'}
            </button>

            {requeueMsg && (
              <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>{requeueMsg}</span>
            )}

            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
              {parcels?.total ?? 0} result{parcels?.total !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '15px' }}>Loading…</div>
          ) : (
            <Table
              columns={COLUMNS}
              data={parcels?.items || []}
              onRowClick={(row) => navigate(`/parcels/${row.id}`)}
              emptyMessage="No parcels match your filters."
            />
          )}

          {/* Pagination */}
          {parcels && parcels.total > 50 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-inner)', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: page === 1 ? 'var(--text-muted)' : 'var(--text-body)', padding: '5px 12px', borderRadius: '7px', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
                Previous
              </button>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Page {page}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={!parcels || parcels.items.length < 50}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: (!parcels || parcels.items.length < 50) ? 'var(--text-muted)' : 'var(--text-body)', padding: '5px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px' }}>
                Next
              </button>
            </div>
          )}
        </div>

        {/* Status chart */}
        <div style={{ ...card, padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Status Distribution
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                cursor={{ fill: 'var(--bg-tag)' }}
              />
              <Bar dataKey="value" radius={4}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_CHART_COLORS[entry.name] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  )
}
