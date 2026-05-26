export default function Button({ children, variant = 'primary', size = 'md', disabled, onClick, type = 'button', style: extra }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    fontFamily: 'inherit', fontWeight: 600,
    borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
  }

  const sizes = {
    sm: { fontSize: '13px', padding: '5px 12px' },
    md: { fontSize: '14px', padding: '8px 18px' },
    lg: { fontSize: '15px', padding: '10px 24px' },
  }

  const variants = {
    primary:   { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' },
    secondary: { background: 'var(--bg-card)', color: 'var(--text-body)', borderColor: 'var(--border)' },
    danger:    { background: '#ef4444', color: '#fff', borderColor: '#ef4444' },
    ghost:     { background: 'transparent', color: 'var(--primary)', borderColor: 'transparent' },
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...sizes[size], ...variants[variant], ...extra }}
      onMouseEnter={(e) => {
        if (disabled) return
        if (variant === 'primary') e.currentTarget.style.background = 'var(--primary-hover)'
        if (variant === 'secondary') { e.currentTarget.style.borderColor = 'var(--primary-border)'; e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)' }
        if (variant === 'ghost') e.currentTarget.style.background = 'var(--primary-light)'
      }}
      onMouseLeave={(e) => {
        if (variant === 'primary') e.currentTarget.style.background = 'var(--primary)'
        if (variant === 'secondary') { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-body)' }
        if (variant === 'ghost') e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}
