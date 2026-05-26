import { useState } from 'react'
import { X, ChevronRight, Layers, FlaskConical, CheckCircle2, Zap, GitBranch, AlertTriangle } from 'lucide-react'

const card = {
  background: 'var(--bg-card)', borderRadius: '12px',
  border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
}

const pill = (bg, color) => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
  fontSize: '12px', fontWeight: 600, background: bg, color,
})

const STEPS = [
  {
    icon: <Layers size={20} color="var(--primary)" />,
    title: 'Rule Groups & Priority',
    content: (
      <div>
        <p style={{ margin: '0 0 12px' }}>
          Rules are evaluated <strong>in priority order</strong> (lowest number first). The <strong>first rule that matches wins</strong> — evaluation stops immediately.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          {[
            { p: 1, id: 'insurance-gate', summary: 'value_eur > 5000 → INSURANCE_HOLD', match: true },
            { p: 2, id: 'mail-dept',      summary: 'weight_kg ≤ 1 → Mail Department',    match: false },
            { p: 3, id: 'heavy-dept',     summary: 'weight_kg > 10 → Heavy Department',  match: false },
          ].map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: r.match ? 'var(--status-routed-bg)' : 'var(--bg-app)', border: `1px solid ${r.match ? 'var(--status-routed-text)' : 'var(--border)'}` }}>
              <span style={{ ...pill('var(--primary-light)', 'var(--primary)'), minWidth: '24px', textAlign: 'center' }}>{r.p}</span>
              <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-base)', flex: 1 }}>{r.id}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.summary}</span>
              {r.match && <span style={pill('var(--status-routed-bg)', 'var(--status-routed-text)')}>✓ matched</span>}
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 14px', background: 'var(--bg-app)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)', borderLeft: '3px solid var(--primary)' }}>
          Tip: keep the most specific / restrictive rules at <strong>lower priority numbers</strong> so they are checked first.
        </div>
      </div>
    ),
  },
  {
    icon: <GitBranch size={20} color="var(--primary)" />,
    title: 'Conditions — AND vs OR',
    content: (
      <div>
        <p style={{ margin: '0 0 12px' }}>
          Each rule group can have multiple conditions. You control whether <strong>all</strong> must match (AND) or <strong>any one</strong> is enough (OR) — click the badge between conditions to toggle.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          {[
            { logic: 'AND', conds: ['weight_kg > 10', 'destination_country = US'], pass: 'both must be true', col: 'var(--primary)' },
            { logic: 'OR',  conds: ['weight_kg > 10', 'destination_country = US'], pass: 'either one is enough', col: '#059669' },
          ].map((ex) => (
            <div key={ex.logic} style={{ ...card, padding: '14px' }}>
              <div style={{ fontWeight: 700, color: ex.col, marginBottom: '8px', fontSize: '13px' }}>Logic: {ex.logic}</div>
              {ex.conds.map((c, i) => (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  {i > 0 && <span style={{ fontSize: '11px', fontWeight: 700, color: ex.col, marginRight: '2px' }}>{ex.logic}</span>}
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', background: 'var(--bg-app)', padding: '2px 7px', borderRadius: '5px', color: 'var(--text-base)' }}>{c}</span>
                </div>
              ))}
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>→ {ex.pass}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: <Zap size={20} color="var(--primary)" />,
    title: 'Actions & Fields',
    content: (
      <div>
        <p style={{ margin: '0 0 14px' }}>Available fields and actions:</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div style={{ ...card, padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '10px' }}>Built-in Fields</div>
            {[
              { f: 'weight_kg', d: 'Parcel weight in kilograms' },
              { f: 'value_eur', d: 'Declared value (shown as ₹)' },
              { f: 'destination_country', d: 'ISO 2-letter country code' },
            ].map(({ f, d }) => (
              <div key={f} style={{ marginBottom: '8px' }}>
                <code style={{ fontSize: '12px', background: 'var(--bg-app)', padding: '1px 6px', borderRadius: '4px', color: 'var(--primary)' }}>{f}</code>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{d}</div>
              </div>
            ))}
            <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-inner)', paddingTop: '8px' }}>
              Any custom attribute key (e.g. <code style={{ background: 'var(--bg-app)', padding: '1px 5px', borderRadius: '4px' }}>fragile</code>) is also supported.
            </div>
          </div>
          <div style={{ ...card, padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '10px' }}>Actions</div>
            {[
              { a: 'ROUTE_TO', d: 'Send parcel to a named department', color: 'var(--primary)' },
              { a: 'INSURANCE_HOLD', d: 'Flag parcel for insurance review', color: '#d97706' },
            ].map(({ a, d, color }) => (
              <div key={a} style={{ marginBottom: '10px' }}>
                <span style={pill('var(--bg-app)', color)}>{a}</span>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>{d}</div>
              </div>
            ))}
            <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-inner)', paddingTop: '8px' }}>
              If no rule matches, the <strong>fallback</strong> applies (default: DEAD_LETTER).
            </div>
          </div>
        </div>
        <div style={{ padding: '10px 14px', background: '#fef3c7', borderRadius: '8px', fontSize: '13px', color: '#92400e', borderLeft: '3px solid #d97706', display: 'flex', gap: '8px' }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>Operators <code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: '4px' }}>&gt; &lt; ≥ ≤</code> only work on numeric fields. Use <code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: '4px' }}>=</code> or <code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: '4px' }}>≠</code> for text like <code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: '4px' }}>destination_country</code>.</span>
        </div>
      </div>
    ),
  },
  {
    icon: <FlaskConical size={20} color="var(--primary)" />,
    title: 'Save Draft → Test → Apply',
    content: (
      <div>
        <p style={{ margin: '0 0 16px' }}>Changes are <strong>never live until applied</strong>. The workflow is always:</p>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[
            { n: '1', label: 'Edit rule groups', sub: 'Add, edit, or delete groups in the chain' },
            { n: '2', label: 'Save Draft', sub: 'Persists your changes as an unapplied version' },
            { n: '3', label: 'Test (optional)', sub: 'Run test parcels against the draft via backend' },
            { n: '4', label: 'Apply Rules', sub: 'Makes the draft live — all new parcels use it' },
          ].map((s, i, arr) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              <div style={{ textAlign: 'center', minWidth: '140px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>{s.n}</div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-base)' }}>{s.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.sub}</div>
              </div>
              {i < arr.length - 1 && <ChevronRight size={18} color="var(--text-muted)" style={{ flexShrink: 0, margin: '0 -4px' }} />}
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 14px', background: 'var(--status-routed-bg)', borderRadius: '8px', fontSize: '13px', color: 'var(--status-routed-text)', borderLeft: '3px solid var(--status-routed-text)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
          An <strong>orange banner</strong> appears when you have an unapplied draft. A <strong>blue banner</strong> appears when you have unsaved local changes — save draft to preserve them.
        </div>
      </div>
    ),
  },
]

export default function RuleHelp({ onClose }) {
  const [step, setStep] = useState(0)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ ...card, width: '100%', maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)' }}>Rule Editor Guide</h2>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>How to build and apply routing rules</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Step tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', flexShrink: 0, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {STEPS.map((s, i) => (
            <button key={i} onClick={() => setStep(i)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
              borderRadius: '8px 8px 0 0', border: '1px solid var(--border)', borderBottom: 'none',
              background: step === i ? 'var(--bg-card)' : 'var(--bg-app)',
              color: step === i ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: step === i ? 600 : 400, fontSize: '13px', cursor: 'pointer',
              marginBottom: step === i ? '-1px' : '0', whiteSpace: 'nowrap',
            }}>
              {s.icon}
              {s.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, fontSize: '14px', color: 'var(--text-base)', lineHeight: 1.6 }}>
          {STEPS[step].content}
        </div>

        {/* Footer nav */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: step === 0 ? 'var(--text-muted)' : 'var(--text-body)', cursor: step === 0 ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
            ← Previous
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{step + 1} / {STEPS.length}</span>
          {step < STEPS.length - 1
            ? <button onClick={() => setStep((s) => s + 1)} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Next →</button>
            : <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Done ✓</button>
          }
        </div>
      </div>
    </div>
  )
}
