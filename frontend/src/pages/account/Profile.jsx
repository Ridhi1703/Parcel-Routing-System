import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { updateMe } from '../../api/users'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notifications'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const card = { background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '28px', maxWidth: '480px' }
const sectionLabel = { fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }

export default function Profile() {
  const { user } = useAuthStore()
  const { addToast } = useNotificationStore()

  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    current_password: '',
    new_password: '',
  })
  const [error, setError] = useState(null)

  const mutation = useMutation({
    mutationFn: (data) => updateMe(data),
    onSuccess: () => {
      setForm(f => ({ ...f, current_password: '', new_password: '' }))
      setError(null)
      addToast('Profile updated', 'success')
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to update profile'),
  })

  const handleSave = () => {
    setError(null)
    const payload = {}
    if (form.username !== user?.username) payload.username = form.username
    if (form.email !== user?.email) payload.email = form.email
    if (form.new_password) {
      if (!form.current_password) { setError('Current password is required to set a new password'); return }
      payload.password = form.new_password
      payload.current_password = form.current_password
    }
    if (Object.keys(payload).length === 0) {
      addToast('No changes to save', 'info')
      return
    }
    mutation.mutate(payload)
  }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>My Account</h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Update your username, email, or password.</p>
      </div>

      <div style={card}>
        <div style={sectionLabel}>Profile details</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
          <Input
            label="Username"
            value={form.username}
            onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
          />
        </div>

        <div style={{ ...sectionLabel }}>Change password</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
          <Input
            label="Current Password"
            type="password"
            value={form.current_password}
            onChange={(e) => setForm(f => ({ ...f, current_password: e.target.value }))}
            placeholder="Required only if changing password"
          />
          <Input
            label="New Password"
            type="password"
            value={form.new_password}
            onChange={(e) => setForm(f => ({ ...f, new_password: e.target.value }))}
            placeholder="Leave blank to keep current"
          />
        </div>

        {error && <div style={{ fontSize: '13px', color: '#ef4444', marginBottom: '14px' }}>{error}</div>}

        <Button onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
