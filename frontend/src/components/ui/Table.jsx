export default function Table({ columns, data, onRowClick, emptyMessage = 'No data.' }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead style={{ background: 'var(--bg-app)' }}>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{
                textAlign: 'left', padding: '10px 14px',
                color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px',
                borderBottom: '1px solid var(--border)',
                whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '32px 14px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '14px' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : data.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              style={{
                borderBottom: i < data.length - 1 ? '1px solid var(--border-inner)' : 'none',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={(e) => onRowClick && (e.currentTarget.style.background = 'var(--bg-row-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {columns.map((col) => (
                <td key={col.key} style={{ padding: '11px 14px', color: 'var(--text-base)', ...col.cellStyle }}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
