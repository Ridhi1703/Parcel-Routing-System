import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRules, createDraft, testRule, applyRule, deleteDraft } from '../../api/rules'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { ConfirmModal } from '../../components/ui/Modal'
import { useNotificationStore } from '../../stores/notifications'
import RuleHelp from './RuleHelp'
import {
  Plus, Trash2, X, ChevronDown, ChevronUp, Download, Upload,
  ArrowLeft, FlaskConical, CheckCircle2, XCircle, Pencil, HelpCircle,
} from 'lucide-react'

// ── Presets ───────────────────────────────────────────────────────────────────
const FIELD_PRESETS   = ['weight_kg', 'value_eur', 'destination_country']
const OPERATOR_OPTIONS = [
  { value: 'gt',  label: '> greater than' },
  { value: 'gte', label: '≥ greater or equal' },
  { value: 'lt',  label: '< less than' },
  { value: 'lte', label: '≤ less or equal' },
  { value: 'eq',  label: '= equals' },
  { value: 'neq', label: '≠ not equals' },
]
const ACTION_PRESETS = ['ROUTE_TO', 'INSURANCE_HOLD']

// System/default actions
const SYSTEM_ACTIONS = ['ROUTE_TO', 'INSURANCE_HOLD']

// Allow target for custom actions
function actionSupportsTarget(action) {
  return (
    action === 'ROUTE_TO' ||
    !SYSTEM_ACTIONS.includes(action)
  )
}
const TARGET_PRESETS = ['Mail Department', 'Regular Department', 'Heavy Department', 'Secure Route']
const NUMERIC_FIELDS = new Set(['weight_kg', 'value_eur'])
const isNumeric = (f) => NUMERIC_FIELDS.has(f)

// ── Local rule evaluator ──────────────────────────────────────────────────────
function resolveField(field, parcel) {
  if (field.includes('.')) {
    const [parent, child] = field.split('.', 2)
    return parcel[parent]?.[child] ?? null
  }
  const top = parcel[field]
  if (top !== undefined && top !== null) return top
  return parcel.attributes?.[field] ?? null
}
function isNumericVal(v) { return v !== '' && v !== null && v !== undefined && !isNaN(Number(v)) }
function evalCondition(cond, parcel) {
  const val = resolveField(cond.field, parcel)
  if (val === null || val === undefined) return false
  const { operator, value: threshold } = cond
  if (isNumericVal(val) && isNumericVal(threshold)) {
    const pv = Number(val), tv = Number(threshold)
    if (operator === 'gt')  return pv > tv
    if (operator === 'gte') return pv >= tv
    if (operator === 'lt')  return pv < tv
    if (operator === 'lte') return pv <= tv
    if (operator === 'eq')  return pv === tv
    if (operator === 'neq') return pv !== tv
  } else {
    const pv = String(val).trim().toLowerCase()
    const tv = String(threshold).trim().toLowerCase()
    if (operator === 'eq')  return pv === tv
    if (operator === 'neq') return pv !== tv
  }
  return false
}
function evalRule(rule, parcel) {
  if (!rule.conditions?.length) return false
  if (rule.logic === 'OR') return rule.conditions.some((c) => evalCondition(c, parcel))
  return rule.conditions.every((c) => evalCondition(c, parcel))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseAttrs(str) {
  const attrs = {}
  str.split(',').forEach((pair) => {
    const [k, ...rest] = pair.trim().split('=')
    if (k && rest.length) attrs[k.trim()] = rest.join('=').trim()
  })
  return attrs
}
function attrsStr(attrs) { return Object.entries(attrs || {}).map(([k, v]) => `${k}=${v}`).join(', ') }
function emptyCondition() { return { field: 'weight_kg', operator: 'lte', value: 1 } }
function emptyRule(priority) {
  return { id: `rule-${crypto.randomUUID().slice(0, 6)}`, conditions: [emptyCondition()], logic: 'AND', action: 'ROUTE_TO', target: 'Mail Department', priority, description: '' }
}
function normaliseRules(rules) {
  return rules.map((r) => ({
    ...r,
    conditions: Array.isArray(r.conditions) && r.conditions.length > 0
      ? r.conditions : r.condition ? [r.condition] : [emptyCondition()],
    logic: r.logic || 'AND',
  }))
}
function ruleSummary(r) {
  const conds = (r.conditions || []).map((c) => {
    const op = OPERATOR_OPTIONS.find((o) => o.value === c.operator)?.label.split(' ')[0] || c.operator
    return `${c.field} ${op} ${c.value}`
  }).join(` ${r.logic} `)
  return conds + (r.action === 'ROUTE_TO' ? ` → ${r.target}` : ` → ${r.action}`)
}
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const cell = {
  background: 'var(--bg-input)', border: '1.5px solid var(--border)',
  color: 'var(--text-base)', padding: '6px 10px', borderRadius: '7px',
  fontSize: '13px', outline: 'none',
}
const fieldLabel = {
  fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '4px',
}
const card = { background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }

// ── SelectOrType ──────────────────────────────────────────────────────────────
function SelectOrType({ presets, value, onChange, style: extra }) {
  const isCustom = value !== '' && !presets.includes(value)
  const [custom, setCustom] = useState(isCustom)
  const handleSelect = (e) => {
    if (e.target.value === '__custom__') { setCustom(true); onChange('') }
    else { setCustom(false); onChange(e.target.value) }
  }
  if (custom) return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder="type field…" style={{ ...cell, ...extra, minWidth: '90px' }} />
      <button onClick={() => { setCustom(false); onChange(presets[0]) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}><X size={12} /></button>
    </div>
  )
  return (
    <select value={value} onChange={handleSelect} style={{ ...cell, ...extra }}>
      {presets.map((p) => <option key={p} value={p}>{p}</option>)}
      <option value="__custom__">Custom…</option>
    </select>
  )
}

// ── ConditionRow ──────────────────────────────────────────────────────────────
function ConditionRow({ cond, onChange, onRemove, removable, isFirst, logic, onLogicChange }) {
  const numeric = isNumeric(cond.field)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid var(--border-inner)' }}>
      {!isFirst && (
        <button onClick={() => onLogicChange(logic === 'AND' ? 'OR' : 'AND')} title="Toggle AND / OR"
          style={{ padding: '3px 10px', borderRadius: '999px', border: '1.5px solid var(--primary-border)', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          {logic}
        </button>
      )}
      {isFirst && <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', width: '36px', flexShrink: 0 }}>IF</span>}
      <SelectOrType presets={FIELD_PRESETS} value={cond.field}
        onChange={(f) => onChange({ ...cond, field: f, value: isNumeric(f) ? 1 : '' })} style={{ minWidth: '150px' }} />
      <select value={cond.operator} onChange={(e) => onChange({ ...cond, operator: e.target.value })} style={{ ...cell, minWidth: '140px' }}>
        {OPERATOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <input
        type={numeric ? 'number' : 'text'} step={numeric ? '0.01' : undefined}
        value={cond.value} placeholder={numeric ? '0' : 'value…'}
        onChange={(e) => onChange({ ...cond, value: numeric ? (parseFloat(e.target.value) || 0) : e.target.value })}
        style={{ ...cell, width: numeric ? '90px' : '120px', textAlign: numeric ? 'right' : 'left' }}
      />
      {removable && (
        <button onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px', borderRadius: '5px', display: 'flex', marginLeft: 'auto' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}>
          <X size={13} />
        </button>
      )}
    </div>
  )
}

// ── GroupTestPanel ────────────────────────────────────────────────────────────
function GroupTestPanel({ rule }) {
  const [tp, setTp] = useState({ weight_kg: 1, value_eur: 1000, destination_country: 'IN', attrsStr: '' })
  const [result, setResult] = useState(null)
  const up = (k, v) => { setTp((p) => ({ ...p, [k]: v })); setResult(null) }

  const runTest = () => {
    const parcel = {
      weight_kg: parseFloat(tp.weight_kg) || 0,
      value_eur: parseFloat(tp.value_eur) || 0,
      destination_country: tp.destination_country.toUpperCase(),
      attributes: parseAttrs(tp.attrsStr),
    }
    setResult({ matched: evalRule(rule, parcel), parcel })
  }

  return (
    <div style={{ ...card, padding: '20px', marginTop: '24px' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <FlaskConical size={14} /> Test this rule
        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '12px' }}>— evaluated locally, no draft needed</span>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={fieldLabel}>Weight kg</div>
          <input type="number" step="0.01" value={tp.weight_kg} onChange={(e) => up('weight_kg', e.target.value)} style={{ ...cell, width: '90px' }} />
        </div>
        <div>
          <div style={fieldLabel}>Value ₹</div>
          <input type="number" step="1" value={tp.value_eur} onChange={(e) => up('value_eur', e.target.value)} style={{ ...cell, width: '90px' }} />
        </div>
        <div>
          <div style={fieldLabel}>Country</div>
          <input maxLength={2} value={tp.destination_country} onChange={(e) => up('destination_country', e.target.value.toUpperCase())} style={{ ...cell, width: '56px', textAlign: 'center', textTransform: 'uppercase' }} />
        </div>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <div style={fieldLabel}>Attributes (key=value, comma-sep)</div>
          <input placeholder="e.g. expensive=yes, fragile=true" value={tp.attrsStr} onChange={(e) => up('attrsStr', e.target.value)} style={{ ...cell, width: '100%' }} />
        </div>
        <button onClick={runTest}
          style={{ padding: '7px 18px', borderRadius: '8px', border: '1.5px solid var(--primary-border)', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          Run
        </button>
      </div>

      {result && (
        <div style={{ marginTop: '12px', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', background: result.matched ? 'var(--status-routed-bg)' : 'var(--bg-tag)', border: `1px solid ${result.matched ? 'var(--status-routed-text)' : 'var(--border)'}` }}>
          {result.matched
            ? <CheckCircle2 size={16} color="var(--status-routed-text)" style={{ flexShrink: 0 }} />
            : <XCircle size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: result.matched ? 'var(--status-routed-text)' : 'var(--text-secondary)' }}>
              {result.matched
                ? `Matched — ${rule.action === 'ROUTE_TO' ? `→ ${rule.target}` : rule.action}`
                : 'No match — this rule would not trigger'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
              {result.parcel.weight_kg}kg / ₹{result.parcel.value_eur} / {result.parcel.destination_country}
              {Object.keys(result.parcel.attributes).length > 0 ? ' / ' + attrsStr(result.parcel.attributes) : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── GroupEditView ─────────────────────────────────────────────────────────────
function GroupEditView({ rule: initial, onSave, onDiscard }) {
  const [rule, setRule] = useState({ ...initial })
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const updateCond = (idx, updated) => setRule((r) => ({ ...r, conditions: r.conditions.map((c, i) => i === idx ? updated : c) }))
  const removeCond = (idx) => setRule((r) => ({ ...r, conditions: r.conditions.filter((_, i) => i !== idx) }))
  const addCond = () => setRule((r) => ({ ...r, conditions: [...r.conditions, emptyCondition()] }))

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => setConfirmDiscard(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0 }}>
          <ArrowLeft size={15} /> All groups
        </button>
        <span style={{ color: 'var(--border)', fontSize: '16px' }}>|</span>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>Edit Rule Group</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => downloadJSON(rule, `rule-${rule.id}.json`)}><Download size={14} /> Export</Button>
          <Button variant="secondary" onClick={() => setConfirmDiscard(true)}>Discard</Button>
          <Button onClick={() => onSave(rule)}>Save to Chain</Button>
        </div>
      </div>

      <ConfirmModal
        open={confirmDiscard}
        title="Discard changes"
        message="Discard all unsaved changes to this rule group and return to the list?"
        confirmLabel="Discard"
        variant="danger"
        onConfirm={onDiscard}
        onCancel={() => setConfirmDiscard(false)}
      />

      {/* Meta card */}
      <div style={{ ...card, padding: '20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>Group Settings</div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ width: '80px' }}>
            <div style={fieldLabel}>Priority</div>
            <input type="number" min="1" value={rule.priority}
              onChange={(e) => setRule((r) => ({ ...r, priority: parseInt(e.target.value) || 1 }))}
              style={{ ...cell, width: '100%', textAlign: 'center', fontWeight: 700, fontSize: '16px' }} />
          </div>
          <div style={{ width: '180px' }}>
            <div style={fieldLabel}>Rule ID</div>
            <input value={rule.id} onChange={(e) => setRule((r) => ({ ...r, id: e.target.value }))}
              style={{ ...cell, width: '100%', fontFamily: 'monospace', fontSize: '13px' }} />
          </div>
          <div>
            <div style={fieldLabel}>Action</div>
            <SelectOrType
              presets={ACTION_PRESETS}
              value={rule.action}
              onChange={(v) =>
                setRule((r) => ({
                  ...r,
                  action: v,
                  target: actionSupportsTarget(v)
                    ? (r.target || TARGET_PRESETS[0])
                    : undefined,
                }))
              }
              style={{ minWidth: '150px' }}
            />
          </div>
          {actionSupportsTarget(rule.action) && (
            <div>
              <div style={fieldLabel}>Target</div>
              <SelectOrType presets={TARGET_PRESETS} value={rule.target || ''}
                onChange={(v) => setRule((r) => ({ ...r, target: v }))}
                style={{ minWidth: '160px' }} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={fieldLabel}>Description</div>
            <input value={rule.description || ''} onChange={(e) => setRule((r) => ({ ...r, description: e.target.value }))}
              placeholder="optional description" style={{ ...cell, width: '100%' }} />
          </div>
        </div>
      </div>

      {/* Conditions card */}
      <div style={{ ...card, padding: '20px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
            Conditions
            <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              logic: click the AND / OR badge between conditions to toggle
            </span>
          </div>
          <button onClick={addCond}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', border: '1.5px dashed var(--primary-border)', background: 'transparent', color: 'var(--primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-light)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <Plus size={13} /> Add condition
          </button>
        </div>

        {rule.conditions.map((cond, ci) => (
          <ConditionRow key={ci} cond={cond} isFirst={ci === 0} logic={rule.logic}
            onLogicChange={(l) => setRule((r) => ({ ...r, logic: l }))}
            onChange={(updated) => updateCond(ci, updated)}
            onRemove={() => removeCond(ci)}
            removable={rule.conditions.length > 1} />
        ))}
      </div>

      {/* Per-group test */}
      <GroupTestPanel rule={rule} />
    </div>
  )
}

// ── GroupListItem ─────────────────────────────────────────────────────────────
function GroupListItem({ rule, onEdit, onDelete, onExport }) {
  return (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', marginBottom: '8px', cursor: 'pointer', transition: 'box-shadow 150ms ease' }}
      onClick={onEdit}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(79,70,229,0.12)' }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)' }}>

      {/* Priority badge */}
      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', flexShrink: 0 }}>
        {rule.priority}
      </div>

      {/* ID + summary */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-base)', fontFamily: 'monospace', marginBottom: '3px' }}>{rule.id}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ruleSummary(rule)}</div>
      </div>

      {/* Condition count */}
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
        {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''} · {rule.logic}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onEdit} title="Edit"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '5px 7px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-light)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}>
          <Pencil size={13} />
        </button>
        <button onClick={onExport} title="Export this group"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '5px 7px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-light)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}>
          <Download size={13} />
        </button>
        <button onClick={onDelete} title="Delete"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '5px 7px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fee2e2' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
const sLabel = { fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }

export default function RuleEditor() {
  const qc = useQueryClient()
  const { addToast } = useNotificationStore()
  const importRef = useRef(null)
  const importGroupRef = useRef(null)

  const [rules, setRules] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [draftId, setDraftId] = useState(null)
  const [draftDiscarded, setDraftDiscarded] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [testParcels, setTestParcels] = useState([{ weight_kg: 0.5, value_eur: 3999, destination_country: 'IN', attrsStr: '' }])
  const [testResults, setTestResults] = useState(null)
  const [applyError, setApplyError] = useState(null)
  const [confirmApply, setConfirmApply] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [importError, setImportError] = useState(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const { data: versions } = useQuery({
    queryKey: ['rules'],
    queryFn: () => listRules().then((r) => r.data),
  })

  useEffect(() => {
    if (versions && rules === null && versions.length > 0) {
      // versions is sorted desc by version_number — versions[0] is always most recent
      // Prefer the most recent version (may be an unapplied draft) over the active one
      const latest = versions[0]
      setRules(normaliseRules(latest.config.rules || []))
    }
  }, [versions])

  const activeVersion = versions?.find((v) => v.is_active)
  const latestVersion = versions?.[0]
  const viewingDraft = latestVersion && !latestVersion.is_active && !draftDiscarded
  // On page load draftId is null — but if we're viewing a saved draft we can still apply it
  const effectiveDraftId = draftId || (viewingDraft ? latestVersion.id : null)
  const sorted = rules ? [...rules].sort((a, b) => a.priority - b.priority) : []

  // ── Mutations ─────────────────────────────────────────────────────────────
  const draftMutation = useMutation({
    mutationFn: () => {
      // Re-number priorities sequentially before saving to eliminate duplicates
      const renumbered = sorted.map((r, i) => ({ ...r, priority: i + 1 }))
      return createDraft({
        version: (activeVersion?.version_number || 0) + 1,
        rules: renumbered,
        fallback: 'DEAD_LETTER',
      })
    },
    onSuccess: (res) => {
      // Sync local state to renumbered priorities
      setRules((prev) => prev ? [...prev].sort((a, b) => a.priority - b.priority).map((r, i) => ({ ...r, priority: i + 1 })) : prev)
      setDraftId(res.data.id); setDraftDiscarded(false); setHasUnsavedChanges(false); setTestResults(null); setApplyError(null)
      qc.invalidateQueries(['rules']); addToast('Draft saved', 'success')
    },
    onError: (e) => addToast(e.response?.data?.detail || 'Save failed', 'error'),
  })

  const testMutation = useMutation({
    mutationFn: () => {
      const parcels = testParcels.map((tp) => ({
        weight_kg: parseFloat(tp.weight_kg) || 0,
        value_eur: parseFloat(tp.value_eur) || 0,
        destination_country: tp.destination_country.toUpperCase(),
        attributes: parseAttrs(tp.attrsStr || ''),
      }))
      return testRule(effectiveDraftId, parcels)
    },
    onSuccess: (res) => setTestResults(res.data.results),
    onError: (e) => addToast(e.response?.data?.detail || 'Test failed', 'error'),
  })

  const applyMutation = useMutation({
    mutationFn: () => applyRule(effectiveDraftId),
    onSuccess: () => {
      qc.invalidateQueries(['rules']); setDraftId(null); setTestResults(null)
      setConfirmApply(false); setApplyError(null); addToast('Rules applied', 'success')
    },
    onError: (e) => {
      const err = e.response?.data?.detail
      setApplyError(typeof err === 'object' ? JSON.stringify(err, null, 2) : String(err))
      setConfirmApply(false)
    },
  })

  const discardMutation = useMutation({
    mutationFn: () => deleteDraft(effectiveDraftId),
    onSuccess: () => {
      const active = versions?.find((v) => v.is_active)
      setRules(normaliseRules(active ? (active.config.rules || []) : []))
      setDraftId(null)
      setDraftDiscarded(true)
      qc.invalidateQueries(['rules'])
      addToast('Draft discarded', 'success')
    },
    onError: (e) => addToast(e.response?.data?.detail || 'Discard failed', 'error'),
  })

  // ── Rule ops ──────────────────────────────────────────────────────────────
  const saveGroup = (updated) => {
    setRules((prev) => prev.map((r) => r.id === editingId ? updated : r))
    setHasUnsavedChanges(true)
    setEditingId(null)
  }
  const deleteRule = (id) => { setRules((prev) => prev.filter((r) => r.id !== id)); setHasUnsavedChanges(true); setConfirmDeleteId(null) }
  const addRule = () => {
    const nr = emptyRule((rules?.length || 0) + 1)
    setRules((prev) => [...(prev || []), nr])
    setHasUnsavedChanges(true)
    setEditingId(nr.id)
  }

  // ── Export / Import ───────────────────────────────────────────────────────
  const exportAll = () => downloadJSON(sorted, 'rules.json')
  const exportOne = (rule) => downloadJSON(rule, `rule-${rule.id}.json`)

  const handleImportAll = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result)
        const arr = Array.isArray(parsed) ? parsed : parsed.rules
        if (!Array.isArray(arr)) throw new Error('Expected array of rules or { rules: [...] }')
        setRules(normaliseRules(arr.map((r, i) => ({ ...r, priority: r.priority ?? i + 1 }))))
        setImportError(null); setHasUnsavedChanges(true); addToast(`Imported ${arr.length} rules`, 'success')
      } catch (err) { setImportError(err.message) }
    }
    reader.readAsText(file); e.target.value = ''
  }

  const handleImportGroup = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result)
        const obj = Array.isArray(parsed) ? parsed[0] : parsed
        if (!obj || typeof obj !== 'object') throw new Error('Expected a rule group object')
        const normed = normaliseRules([{ ...obj, priority: obj.priority ?? (rules?.length || 0) + 1 }])[0]
        setRules((prev) => [...(prev || []), normed])
        setEditingId(normed.id)
        setImportError(null); setHasUnsavedChanges(true); addToast(`Imported group "${normed.id}"`, 'success')
      } catch (err) { setImportError(err.message) }
    }
    reader.readAsText(file); e.target.value = ''
  }

  if (rules === null) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '15px' }}>
      Loading rule chain…
    </div>
  )

  const deletingRule = confirmDeleteId ? rules.find((r) => r.id === confirmDeleteId) : null
  const editingRule = editingId ? rules.find((r) => r.id === editingId) : null

  // ── Group edit view ───────────────────────────────────────────────────────
  if (editingId && editingRule) {
    return (
      <>
        <GroupEditView
          rule={editingRule}
          onSave={saveGroup}
          onDiscard={() => setEditingId(null)}
        />
      </>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>Rule Editor</h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
            Click a group to edit. Groups evaluated by priority (lowest first). First match wins.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => setHelpOpen(true)}><HelpCircle size={14} /> Help</Button>
          <Button variant="secondary" onClick={exportAll}><Download size={14} /> Export All</Button>
          <Button variant="secondary" onClick={() => importRef.current?.click()}><Upload size={14} /> Import All</Button>
          <Button variant="secondary" onClick={() => importGroupRef.current?.click()}><Upload size={14} /> Import Group</Button>
          <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportAll} />
          <input ref={importGroupRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportGroup} />
          <Button onClick={() => draftMutation.mutate()} disabled={draftMutation.isPending}>
            {draftMutation.isPending ? 'Saving…' : 'Save Draft'}
          </Button>
        </div>
      </div>

      {viewingDraft && (
        <div style={{ padding: '10px 14px', marginBottom: '12px', borderRadius: '8px', background: 'var(--status-hold-bg)', color: 'var(--status-hold-text)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>Viewing unapplied draft</span>
          <span style={{ fontWeight: 400 }}>— v{latestVersion.version_number} (saved {new Date(latestVersion.created_at).toISOString().slice(0, 16).replace('T', ' ')})</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => discardMutation.mutate()}
              disabled={discardMutation.isPending}
              style={{ fontSize: '13px', fontWeight: 600, padding: '4px 12px', borderRadius: '6px', border: '1.5px solid var(--status-hold-text)', background: 'transparent', color: 'var(--status-hold-text)', cursor: discardMutation.isPending ? 'not-allowed' : 'pointer', opacity: discardMutation.isPending ? 0.6 : 1 }}
            >
              {discardMutation.isPending ? 'Discarding…' : 'Discard Draft'}
            </button>
          </div>
        </div>
      )}

      {hasUnsavedChanges && (
        <div style={{ padding: '10px 14px', marginBottom: '12px', borderRadius: '8px', background: 'var(--primary-light)', border: '1.5px solid var(--primary-border)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Unsaved changes</span>
          <span style={{ color: 'var(--text-secondary)' }}>— you've modified the rule chain. Save a draft to persist and apply these changes.</span>
          <Button style={{ marginLeft: 'auto' }} onClick={() => draftMutation.mutate()} disabled={draftMutation.isPending}>
            {draftMutation.isPending ? 'Saving…' : 'Save Draft'}
          </Button>
        </div>
      )}

      {importError && (
        <div style={{ padding: '10px 14px', marginBottom: '12px', borderRadius: '8px', background: 'var(--status-failed-bg)', color: 'var(--status-failed-text)', fontSize: '13px' }}>
          Import error: {importError}
        </div>
      )}

      {/* Group list */}
      {sorted.length === 0 ? (
        <div style={{ ...card, padding: '48px', textAlign: 'center', color: 'var(--text-muted)', marginBottom: '12px' }}>
          <div style={{ fontSize: '15px', marginBottom: '8px' }}>No rule groups yet.</div>
          <div style={{ fontSize: '13px' }}>Click "Add Group" to create your first routing rule.</div>
        </div>
      ) : sorted.map((rule) => (
        <GroupListItem
          key={rule.id}
          rule={rule}
          onEdit={() => setEditingId(rule.id)}
          onDelete={(e) => { setConfirmDeleteId(rule.id) }}
          onExport={() => exportOne(rule)}
        />
      ))}

      {/* Add group */}
      <button onClick={addRule}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '10px', border: '1.5px dashed var(--primary-border)', background: 'transparent', color: 'var(--primary)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'background 150ms ease', marginBottom: '24px', marginTop: sorted.length ? '4px' : '0' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-light)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
        <Plus size={15} /> Add Group
      </button>

      {/* Status + apply */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        {effectiveDraftId ? (
          <span style={{ fontSize: '13px', color: 'var(--status-routed-text)', background: 'var(--status-routed-bg)', padding: '4px 12px', borderRadius: '999px', fontWeight: 600 }}>
            Draft saved — ready to test &amp; apply
          </span>
        ) : (
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Save a draft to run the full-chain test and apply.</span>
        )}
        {effectiveDraftId && <Button onClick={() => setConfirmApply(true)} disabled={applyMutation.isPending}>Apply Rules…</Button>}
      </div>

      {applyError && (
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <pre style={{ fontSize: '12px', color: '#dc2626', whiteSpace: 'pre-wrap', background: 'var(--status-failed-bg)', borderRadius: '8px', padding: '12px 36px 12px 12px', margin: 0 }}>
            {applyError}
          </pre>
          <button onClick={() => setApplyError(null)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Test All (collapsible) */}
      <div style={card}>
        <button onClick={() => setTestOpen((v) => !v)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: testOpen ? '1px solid var(--border-inner)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={sLabel}>Test All Groups</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— runs full chain via backend, requires a saved draft</span>
          </div>
          {testOpen ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
        </button>

        {testOpen && (
          <div style={{ padding: '20px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Runs every rule group in priority order. Use <code style={{ background: 'var(--bg-app)', padding: '1px 5px', borderRadius: '4px', fontSize: '12px' }}>key=value</code> in Attributes (e.g. <code style={{ background: 'var(--bg-app)', padding: '1px 5px', borderRadius: '4px', fontSize: '12px' }}>expensive=yes</code>).
            </p>

            {testParcels.map((tp, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <div style={fieldLabel}>Weight kg</div>
                  <input type="number" step="0.01" value={tp.weight_kg}
                    onChange={(e) => setTestParcels((prev) => prev.map((p, j) => j === i ? { ...p, weight_kg: e.target.value } : p))}
                    style={{ ...cell, width: '90px' }} />
                </div>
                <div>
                  <div style={fieldLabel}>Value ₹</div>
                  <input type="number" step="1" value={tp.value_eur}
                    onChange={(e) => setTestParcels((prev) => prev.map((p, j) => j === i ? { ...p, value_eur: e.target.value } : p))}
                    style={{ ...cell, width: '90px' }} />
                </div>
                <div>
                  <div style={fieldLabel}>Country</div>
                  <input maxLength={2} value={tp.destination_country}
                    onChange={(e) => setTestParcels((prev) => prev.map((p, j) => j === i ? { ...p, destination_country: e.target.value.toUpperCase() } : p))}
                    style={{ ...cell, width: '56px', textAlign: 'center', textTransform: 'uppercase' }} />
                </div>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <div style={fieldLabel}>Attributes (key=value, comma-sep)</div>
                  <input placeholder="e.g. expensive=yes, fragile=true" value={tp.attrsStr || ''}
                    onChange={(e) => setTestParcels((prev) => prev.map((p, j) => j === i ? { ...p, attrsStr: e.target.value } : p))}
                    style={{ ...cell, width: '100%' }} />
                </div>
                <button onClick={() => setTestParcels((prev) => prev.filter((_, j) => j !== i))}
                  style={{ ...cell, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fca5a5' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-base)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                  <X size={13} />
                </button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
              <button onClick={() => setTestParcels((prev) => [...prev, { weight_kg: 1, value_eur: 1000, destination_country: 'IN', attrsStr: '' }])}
                style={{ fontSize: '13px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                + Add row
              </button>
              <Button onClick={() => testMutation.mutate()} disabled={!effectiveDraftId || testMutation.isPending}>
                {testMutation.isPending ? 'Running…' : 'Run Test'}
              </Button>
              {!effectiveDraftId && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Save a draft first.</span>}
            </div>

            {testResults && (
              <div style={{ borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ background: 'var(--bg-app)' }}>
                    <tr>
                      {['Parcel', 'Attributes', 'Decision'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, borderBottom: '1px solid var(--border)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.map((r, i) => (
                      <tr key={i} style={{ borderBottom: i < testResults.length - 1 ? '1px solid var(--border-inner)' : 'none' }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {r.parcel.weight_kg}kg / ₹{r.parcel.value_eur} / {r.parcel.destination_country}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {Object.keys(r.parcel.attributes || {}).length > 0 ? attrsStr(r.parcel.attributes) : '—'}
                        </td>
                        <td style={{ padding: '8px 12px' }}><Badge status={r.decision} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm modals */}
      <ConfirmModal
        open={!!confirmDeleteId}
        title="Delete rule group"
        message={`Delete "${deletingRule?.id}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteRule(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <ConfirmModal
        open={confirmApply}
        title="Apply rules"
        message="This replaces the live rule chain immediately. Run the test sandbox first to verify decisions."
        confirmLabel="Apply Rules"
        variant="warning"
        onConfirm={() => applyMutation.mutate()}
        onCancel={() => setConfirmApply(false)}
        isPending={applyMutation.isPending}
      />

      {helpOpen && <RuleHelp onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
