import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const Input = forwardRef(({ label, error, type, ...props }, ref) => {
  const isPassword = type === 'password'
  const [show, setShow] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {label && (
        <label style={{ fontSize: '13px', color: 'var(--text-body)', fontWeight: 600 }}>{label}</label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={ref}
          type={isPassword ? (show ? 'text' : 'password') : type}
          {...props}
          style={{
            background: 'var(--bg-input)',
            border: `1.5px solid ${error ? '#ef4444' : 'var(--border)'}`,
            borderRadius: '8px',
            color: 'var(--text-base)',
            padding: isPassword ? '8px 36px 8px 12px' : '8px 12px',
            fontSize: '14px',
            outline: 'none',
            width: '100%',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
            ...props.style,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--primary)'
            e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.12)'
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            e.target.style.borderColor = error ? '#ef4444' : 'var(--border)'
            e.target.style.boxShadow = 'none'
            props.onBlur?.(e)
          }}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((v) => !v)}
            style={{
              position: 'absolute', right: '10px',
              background: 'none', border: 'none', padding: '2px',
              cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center',
              transition: 'color 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {error && <span style={{ fontSize: '12px', color: '#ef4444' }}>{error}</span>}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
