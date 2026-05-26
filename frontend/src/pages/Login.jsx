import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { login } from '../api/auth'
import { useAuthStore } from '../stores/auth'
import Input from '../components/ui/Input'
import { jwtDecode } from '../utils/jwt'
import { Layers, CheckCircle2 } from 'lucide-react'

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const onSubmit = async (data) => {
    setLoading(true)
    setError(null)
    try {
      const res = await login(data.username, data.password)
      const token = res.data.access_token
      const payload = jwtDecode(token)
      setAuth({ username: payload.username, role: payload.role, id: payload.sub }, token)
      const dest = payload.role === 'admin' ? '/admin/dashboard'
        : payload.role === 'viewer' ? '/viewer/dashboard'
        : '/submit'
      navigate(dest, { replace: true })
    } catch (e) {
      setError(e.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', overflow: 'hidden' }}>
      {/* Left panel — branded gradient, intentionally ignores dark mode */}
      <div style={{
        width: '40%', minWidth: '340px',
        background: 'linear-gradient(135deg, #312e81 0%, #3730a3 55%, #1e293b 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '48px 48px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Dot grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.07,
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
        <div style={{ position: 'relative' }}>
          <Layers size={48} color="#a5b4fc" style={{ marginBottom: '24px' }} />
          <h1 style={{ fontSize: '36px', fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: '12px' }}>
            ParcelFlow
          </h1>
          <div style={{ width: '32px', height: '2px', background: '#818cf8', marginBottom: '20px' }} />
          <p style={{ fontSize: '15px', color: '#c7d2fe', marginBottom: '32px', lineHeight: 1.7 }}>
            Intelligent parcel routing for modern logistics operations.
          </p>
          {[
            'Rule-based automated routing',
            'Batch processing with live tracking',
            'Full audit trail per parcel',
            'Role-based access control',
          ].map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <CheckCircle2 size={16} color="#818cf8" />
              <span style={{ fontSize: '14px', color: '#e0e7ff' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-app)',
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(99,102,241,0.025) 0, rgba(99,102,241,0.025) 1px, transparent 0, transparent 50%)',
        backgroundSize: '16px 16px',
        padding: '32px',
      }}>
        <div style={{
          background: 'var(--bg-card)', borderRadius: '16px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
          border: '1px solid var(--border)',
          padding: '40px', width: '100%', maxWidth: '380px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>ParcelFlow</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sign in to your account</div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <Input
              label="Username"
              {...register('username', { required: 'Required' })}
              error={errors.username?.message}
              autoFocus
            />
            <Input
              label="Password"
              type="password"
              {...register('password', { required: 'Required' })}
              error={errors.password?.message}
            />
            {error && (
              <div style={{ fontSize: '13px', color: '#ef4444', background: '#fee2e2', padding: '10px 12px', borderRadius: '8px' }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px', borderRadius: '8px',
                background: loading ? '#818cf8' : 'var(--primary)', color: '#fff',
                border: 'none', fontSize: '15px', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 150ms ease',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
