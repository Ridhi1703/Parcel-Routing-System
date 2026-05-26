import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getParcel } from '../../api/parcels'
import Badge from '../../components/ui/Badge'
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react'

const card = {
  background: 'var(--bg-card)', borderRadius: '12px',
  border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  marginBottom: '20px',
}

const sectionLabel = {
  fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: 'var(--text-secondary)',
}

export default function ParcelDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['parcel', id],
    queryFn: () => getParcel(id).then((r) => r.data),
  })

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '15px' }}>
      Loading parcel…
    </div>
  )
  if (!data) return (
    <div style={{ color: '#ef4444', fontSize: '15px', padding: '32px' }}>Parcel not found.</div>
  )

  const { parcel, routing_decision, audit_trail } = data

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '14px', color: 'var(--primary)', background: 'none', border: 'none',
          cursor: 'pointer', padding: '0', marginBottom: '24px', fontWeight: 500,
        }}
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'monospace', marginBottom: '4px' }}>{parcel.id}</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Parcel detail &amp; routing trace</p>
        </div>
        <Badge status={parcel.status} />
      </div>

      {/* Details card */}
      <div style={card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-inner)' }}>
          <span style={sectionLabel}>Parcel Details</span>
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[
            ['Weight', `${Number(parcel.weight_kg).toFixed(3)} kg`],
            ['Value', `₹${Number(parcel.value_eur).toFixed(0)}`],
            ['Destination', parcel.destination_country],
            ['Submitted by', parcel.submitted_by || '—'],
            ['Submitted at', new Date(parcel.created_at).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '2px' }}>{k}</div>
              <div style={{ fontSize: '15px', color: 'var(--text-base)', fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom attributes */}
      {parcel.attributes && Object.keys(parcel.attributes).length > 0 && (
        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-inner)' }}>
            <span style={sectionLabel}>Custom Attributes</span>
          </div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {Object.entries(parcel.attributes).map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '2px' }}>{k}</div>
                <div style={{ fontSize: '15px', color: 'var(--text-base)', fontWeight: 500, wordBreak: 'break-all' }}>{String(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Routing decision */}
      {routing_decision && (
        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-inner)' }}>
            <span style={sectionLabel}>Routing Decision</span>
          </div>
          <div style={{ padding: '20px' }}>
            {routing_decision.rules_evaluated.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '10px 0', borderBottom: i < routing_decision.rules_evaluated.length - 1 ? '1px solid var(--border-inner)' : 'none',
              }}>
                {r.matched
                  ? <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  : <Circle size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                <span style={{ fontSize: '14px', fontFamily: 'monospace', color: 'var(--text-body)', flex: 1 }}>{r.rule_id}</span>
                <span style={{ fontSize: '13px', color: r.matched ? '#047857' : 'var(--text-muted)', fontWeight: r.matched ? 600 : 400 }}>
                  {r.matched ? `MATCHED → ${r.result}` : r.result}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit trail */}
      {audit_trail?.length > 0 && (
        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-inner)' }}>
            <span style={sectionLabel}>Audit Trail</span>
          </div>
          <div style={{ padding: '20px' }}>
            {audit_trail.map((a, i) => (
              <div key={i} style={{
                display: 'flex', gap: '16px',
                padding: '8px 0', borderBottom: i < audit_trail.length - 1 ? '1px solid var(--border-inner)' : 'none',
                fontSize: '14px',
              }}>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '13px', width: '80px', flexShrink: 0 }}>
                  {new Date(a.occurred_at).toISOString().slice(11, 19)}
                </span>
                <span style={{ color: 'var(--primary)', fontWeight: 600, width: '140px', flexShrink: 0 }}>{a.action}</span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '13px' }}>{a.actor_id}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
