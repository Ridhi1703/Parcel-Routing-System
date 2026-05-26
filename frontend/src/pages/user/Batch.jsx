import { useState, useRef, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { uploadBatch } from '../../api/parcels'
import { getBatchProgress } from '../../api/dashboard'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { UploadCloud, FileText, Download, CheckCircle2, XCircle } from 'lucide-react'

const EXAMPLE_CSV = `weight_kg,value_inr,destination_country,description,attr_expensive,attr_fragile
0.5,499,IN,Documents envelope,,
2.3,1299,US,Electronics,,true
8.0,85000,GB,Laptop,true,true
0.2,199,DE,Accessories,,
15.0,12000,AU,Heavy goods,,
`

const CSV_COLUMNS = [
  { name: 'weight_kg', type: 'number', required: true, example: '2.5', desc: 'Weight in kilograms' },
  { name: 'value_inr', type: 'number', required: true, example: '1499', desc: 'Declared value in Indian Rupees (₹)' },
  { name: 'destination_country', type: 'string (2-letter ISO)', required: true, example: 'IN', desc: 'ISO 3166-1 alpha-2 country code' },
  { name: 'description', type: 'string', required: false, example: 'Documents', desc: 'Optional parcel description' },
  { name: 'attr_*', type: 'string', required: false, example: 'attr_fragile', desc: 'Custom attribute columns — prefix any column name with attr_ (e.g. attr_fragile, attr_expensive). The value is stored as a parcel attribute and can be matched in routing rules using the bare field name (e.g. fragile = yes).' },
]

function parseCSVPreview(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map((h) => h.trim())
  const rows = lines.slice(1, 11).map((line) =>
    Object.fromEntries(line.split(',').map((v, i) => [headers[i], v.trim()]))
  )
  return { headers, rows }
}

function downloadExampleCSV() {
  const blob = new Blob([EXAMPLE_CSV], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'parcelflow_batch_example.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function Batch() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [batchJobId, setBatchJobId] = useState(null)
  const [uploadErrors, setUploadErrors] = useState([])
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const inputRef = useRef()

  const handleFile = (f) => {
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(parseCSVPreview(e.target.result))
    reader.readAsText(f)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [])

  const mutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('file', file)
      return uploadBatch(fd)
    },
    onSuccess: (res) => {
      setBatchJobId(res.data.batch_job_id)
      setUploadErrors(res.data.errors || [])
      setShowSuccessDialog(true)
    },
  })

  const { data: progressData } = useQuery({
    queryKey: ['batch-progress', batchJobId],
    queryFn: () => getBatchProgress(batchJobId).then((r) => r.data),
    enabled: !!batchJobId,
    refetchInterval: (query) => (query.state.data?.status === 'PROCESSING' ? 500 : false),
  })

  const pct = progressData
    ? Math.round((progressData.processed_count / Math.max(progressData.total_count, 1)) * 100)
    : 0
  const isDone = progressData?.status === 'COMPLETED'

  const card = {
    background: 'var(--bg-card)', borderRadius: '12px',
    border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    padding: '24px', marginBottom: '24px',
  }

  const sectionLabel = {
    fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '12px',
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '6px' }}>Batch Upload</h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Upload a CSV file to submit multiple parcels at once.</p>
      </div>

      {/* Instructions card */}
      <div style={card}>
        <div style={sectionLabel}>How it works</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          {[
            { icon: <Download size={18} />, title: 'Download template', desc: 'Get the example CSV with the correct column headers.' },
            { icon: <FileText size={18} />, title: 'Fill your data', desc: 'Add one parcel per row. Required: weight, value, country.' },
            { icon: <UploadCloud size={18} />, title: 'Upload & track', desc: 'Drop the CSV here. Processing happens in real time.' },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'var(--primary-light)', color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {step.icon}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-base)', marginBottom: '2px' }}>{step.title}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={sectionLabel}>Required columns</div>
        <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Column', 'Type', 'Required', 'Example', 'Description'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CSV_COLUMNS.map((col) => (
                <tr key={col.name} style={{ borderBottom: '1px solid var(--border-inner)' }}>
                  <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-base)', fontSize: '13px' }}>{col.name}</td>
                  <td style={{ padding: '7px 12px', color: 'var(--text-secondary)', fontSize: '13px' }}>{col.type}</td>
                  <td style={{ padding: '7px 12px' }}>
                    {col.required
                      ? <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 600 }}>Yes</span>
                      : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No</span>}
                  </td>
                  <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: 'var(--primary)', fontSize: '13px' }}>{col.example}</td>
                  <td style={{ padding: '7px 12px', color: 'var(--text-secondary)', fontSize: '13px' }}>{col.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={downloadExampleCSV}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500,
            border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-body)',
            cursor: 'pointer', transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary-border)'; e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-body)' }}
        >
          <Download size={15} /> Download example CSV
        </button>
      </div>

      {/* Drop zone */}
      <div style={card}>
        <div style={sectionLabel}>Upload file</div>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--primary-border)'}`,
            borderRadius: '10px', padding: '40px 24px', textAlign: 'center',
            cursor: 'pointer', marginBottom: file ? '20px' : '0',
            transition: 'all 150ms ease',
            background: isDragging ? 'var(--primary-light)' : 'var(--bg-app)',
          }}
        >
          <UploadCloud size={32} style={{ color: isDragging ? 'var(--primary)' : '#94a3b8', margin: '0 auto 12px' }} />
          {file ? (
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-base)', marginBottom: '4px' }}>{file.name}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Click to change file</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-base)', marginBottom: '4px' }}>Drop your CSV here</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>or click to browse — .csv files only</div>
            </div>
          )}
          <input ref={inputRef} type="file" accept=".csv" hidden onChange={(e) => handleFile(e.target.files[0])} />
        </div>

        {preview && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ ...sectionLabel, marginBottom: '8px' }}>Preview — first {preview.rows.length} rows</div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)' }}>
                    {preview.headers.map((h) => (
                      <th key={h} style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '12px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-inner)' }}>
                      {preview.headers.map((h) => (
                        <td key={h} style={{ padding: '8px 12px', color: 'var(--text-body)' }}>{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {file && !batchJobId && (
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '10px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
                border: 'none', background: 'var(--primary)', color: '#fff',
                cursor: mutation.isPending ? 'not-allowed' : 'pointer',
                opacity: mutation.isPending ? 0.7 : 1,
                transition: 'background 150ms ease',
              }}
            >
              <UploadCloud size={16} />
              {mutation.isPending ? 'Uploading…' : 'Submit Batch'}
            </button>
          </div>
        )}

        {mutation.isError && (
          <div style={{ marginTop: '12px', color: '#ef4444', fontSize: '14px' }}>
            {mutation.error?.response?.data?.detail?.message || 'Upload failed. Please check your file and try again.'}
          </div>
        )}
      </div>

      {/* Row validation errors */}
      {uploadErrors.length > 0 && (
        <div style={{ ...card, borderColor: '#fde68a', background: '#fffbeb' }}>
          <div style={{ ...sectionLabel, color: '#92400e', marginBottom: '12px' }}>
            Row validation errors ({uploadErrors.length})
          </div>
          {(showAllErrors ? uploadErrors : uploadErrors.slice(0, 10)).map((e, i) => (
            <div key={i} style={{ fontSize: '13px', color: '#b45309', marginBottom: '4px', fontFamily: 'monospace' }}>
              Row {e.row}: {e.error}
            </div>
          ))}
          {uploadErrors.length > 10 && (
            <button
              onClick={() => setShowAllErrors((v) => !v)}
              style={{ marginTop: '10px', background: 'none', border: 'none', color: '#92400e', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              {showAllErrors ? 'Show less' : `Show all ${uploadErrors.length} errors`}
            </button>
          )}
        </div>
      )}

      {/* Upload success dialog */}
      {showSuccessDialog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: '16px', padding: '36px 40px',
            width: '420px', maxWidth: '95vw', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            border: '1px solid var(--border)',
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'var(--primary-light)', color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <UploadCloud size={26} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '8px' }}>
              Batch Accepted
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <strong style={{ color: 'var(--text-base)' }}>{progressData?.total_count ?? '…'} parcels</strong> queued for routing.
            </p>
            {uploadErrors.length > 0 && (
              <p style={{ fontSize: '13px', color: '#b45309', marginBottom: '8px' }}>
                {uploadErrors.length} row{uploadErrors.length !== 1 ? 's' : ''} had validation errors and were skipped.
              </p>
            )}
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Track routing progress in the panel below.
            </p>
            <Button onClick={() => setShowSuccessDialog(false)}>Got it</Button>
          </div>
        </div>
      )}

      {/* Progress */}
      {progressData && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-base)' }}>
                Batch {batchJobId.slice(0, 8)}…
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {progressData.processed_count} of {progressData.total_count} parcels processed
              </div>
            </div>
            <Badge status={progressData.status} />
          </div>

          {/* Progress bar */}
          <div style={{ background: 'var(--bg-tag)', borderRadius: '6px', height: '10px', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{
              height: '100%',
              background: progressData.failed_count > 0
                ? 'linear-gradient(90deg, #10b981, #f59e0b)'
                : isDone ? '#10b981' : 'var(--primary)',
              width: `${pct}%`,
              transition: 'width 400ms ease',
              borderRadius: '6px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* shimmer while processing */}
              {!isDone && pct > 0 && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                  animation: 'shimmer 1.2s infinite',
                }} />
              )}
            </div>
          </div>
          <style>{`@keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }`}</style>

          <div style={{ display: 'flex', gap: '24px', fontSize: '14px' }}>
            <span style={{ color: '#10b981', fontWeight: 500 }}>
              <CheckCircle2 size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              {progressData.processed_count - progressData.failed_count} succeeded
            </span>
            {progressData.failed_count > 0 && (
              <span style={{ color: '#ef4444', fontWeight: 500 }}>
                <XCircle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                {progressData.failed_count} failed
              </span>
            )}
            {!isDone && (
              <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: '13px' }}>
                {pct}%
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
