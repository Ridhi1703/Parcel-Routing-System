import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listRules, diffRules } from '../../api/rules'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Table from '../../components/ui/Table'

function VersionStatus(rv) {
  if (rv.is_active) return 'ACTIVE'
  if (rv.applied_at) return 'SUPERSEDED'
  return 'DRAFT'
}

const card = {
  background: 'var(--bg-card)', borderRadius: '12px',
  border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  marginBottom: '20px',
}

const sectionLabel = {
  fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: 'var(--text-secondary)',
}

const selectStyle = {
  background: 'var(--bg-input)', border: '1.5px solid var(--border)',
  color: 'var(--text-base)', padding: '8px 12px', borderRadius: '8px', fontSize: '14px', outline: 'none',
}

export default function RuleHistory() {
  const [expanded, setExpanded] = useState(null)
  const [diffA, setDiffA] = useState(null)
  const [diffB, setDiffB] = useState(null)
  const [diffResult, setDiffResult] = useState(null)

  const { data: versions } = useQuery({ queryKey: ['rules'], queryFn: () => listRules().then((r) => r.data) })

  const handleDiff = async () => {
    if (!diffA || !diffB) return
    const res = await diffRules(diffA, diffB)
    setDiffResult(res.data)
  }

  const COLUMNS = [
    { key: 'version_number', label: 'Version', render: (v) => `v${v}` },
    { key: 'created_at', label: 'Created', render: (v) => new Date(v).toISOString().slice(0, 16).replace('T', ' ') },
    { key: 'tested_at', label: 'Tested', render: (v) => v ? new Date(v).toISOString().slice(0, 16).replace('T', ' ') : '—' },
    { key: 'applied_at', label: 'Applied', render: (v) => v ? new Date(v).toISOString().slice(0, 16).replace('T', ' ') : '—' },
    { key: '_status', label: 'Status', render: (_, row) => <Badge status={VersionStatus(row)} /> },
  ]

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>Rule History</h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Browse past rule versions and compare changes.</p>
      </div>

      {/* Diff tool */}
      <div style={card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-inner)' }}>
          <span style={sectionLabel}>Compare versions</span>
        </div>
        <div style={{ padding: '20px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-body)', display: 'block', marginBottom: '5px' }}>Version A</label>
            <select value={diffA || ''} onChange={(e) => setDiffA(e.target.value)} style={selectStyle}>
              <option value="">Select…</option>
              {(versions || []).map((v) => <option key={v.id} value={v.id}>v{v.version_number}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-body)', display: 'block', marginBottom: '5px' }}>Version B</label>
            <select value={diffB || ''} onChange={(e) => setDiffB(e.target.value)} style={selectStyle}>
              <option value="">Select…</option>
              {(versions || []).map((v) => <option key={v.id} value={v.id}>v{v.version_number}</option>)}
            </select>
          </div>
          <Button variant="secondary" onClick={handleDiff} disabled={!diffA || !diffB}>Compare</Button>
        </div>
        {diffResult && (
          <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {['version_a', 'version_b'].map((key) => (
              <div key={key} style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ ...sectionLabel, marginBottom: '10px' }}>{key === 'version_a' ? 'Version A' : 'Version B'}</div>
                <pre style={{ fontSize: '12px', color: 'var(--text-body)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', overflowX: 'auto' }}>
                  {JSON.stringify(diffResult[key], null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Version table */}
      <div style={card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-inner)' }}>
          <span style={sectionLabel}>All versions</span>
        </div>
        <Table
          columns={COLUMNS}
          data={versions || []}
          onRowClick={(row) => setExpanded(expanded === row.id ? null : row.id)}
          emptyMessage="No rule versions."
        />
      </div>

      {expanded && versions && (() => {
        const rv = versions.find((v) => v.id === expanded)
        if (!rv) return null
        return (
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-inner)' }}>
              <span style={sectionLabel}>Version {rv.version_number} config</span>
            </div>
            <div style={{ padding: '20px' }}>
              <pre style={{ fontSize: '13px', color: 'var(--text-body)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', background: 'var(--bg-app)', padding: '16px', borderRadius: '8px' }}>
                {JSON.stringify(rv.config, null, 2)}
              </pre>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
