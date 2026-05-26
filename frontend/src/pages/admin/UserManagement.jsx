import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listUsers, createUser, updateRole, deleteUser, updateUser } from '../../api/users'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { ConfirmModal } from '../../components/ui/Modal'
import { useNotificationStore } from '../../stores/notifications'
import { UserPlus, Trash2, Pencil } from 'lucide-react'

const ROLES = ['user', 'admin', 'viewer']

const card = { background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }
const sectionLabel = { fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }

// ── Edit User Modal ────────────────────────────────────────────────────────────
function EditUserModal({ user, onClose, onSaved }) {
  const { addToast } = useNotificationStore()
  const qc = useQueryClient()
  const [form, setForm] = useState({ username: user.username, email: user.email, password: '', role: user.role })
  const [error, setError] = useState(null)

  const mutation = useMutation({
    mutationFn: (data) => updateUser(user.id, data),
    onSuccess: () => {
      qc.invalidateQueries(['admin-users'])
      addToast('User updated', 'success')
      onSaved()
    },
    onError: (e) => setError(e.response?.data?.detail || 'Failed to update user'),
  })

  const handleSave = () => {
    setError(null)
    const payload = {}
    if (form.username !== user.username) payload.username = form.username
    if (form.email !== user.email) payload.email = form.email
    if (form.password) payload.password = form.password
    if (form.role !== user.role) payload.role = form.role
    if (Object.keys(payload).length === 0) { onClose(); return }
    mutation.mutate(payload)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{ ...card, padding: '28px', width: '420px', maxWidth: '95vw' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '20px' }}>
          Edit User — {user.username}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
          <Input label="Username" value={form.username} onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          <Input label="New Password" type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Leave blank to keep current" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-body)', fontWeight: 600 }}>Role</label>
            <select value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
              style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border)', color: 'var(--text-base)', padding: '8px 12px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        {error && <div style={{ fontSize: '13px', color: '#ef4444', marginBottom: '12px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function UserManagement() {
  const qc = useQueryClient()
  const { addToast } = useNotificationStore()

  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user' })
  const [formError, setFormError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // user object
  const [editUser, setEditUser] = useState(null) // user object

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => listUsers().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      qc.invalidateQueries(['admin-users'])
      setForm({ username: '', email: '', password: '', role: 'user' })
      setShowForm(false)
      setFormError(null)
      addToast('User created', 'success')
    },
    onError: (e) => setFormError(e.response?.data?.detail || 'Failed to create user'),
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => updateRole(id, role),
    onSuccess: () => { qc.invalidateQueries(['admin-users']); addToast('Role updated', 'success') },
    onError: (e) => addToast(e.response?.data?.detail || 'Failed to update role', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteUser(id),
    onSuccess: () => { qc.invalidateQueries(['admin-users']); setConfirmDelete(null); addToast('User deleted', 'success') },
    onError: (e) => { setConfirmDelete(null); addToast(e.response?.data?.detail || 'Failed to delete user', 'error') },
  })

  const handleCreate = () => {
    setFormError(null)
    if (!form.username || !form.email || !form.password) { setFormError('All fields are required'); return }
    createMutation.mutate(form)
  }

  return (
    <div>
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>User Management</h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Create accounts and manage roles.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <UserPlus size={15} /> {showForm ? 'Cancel' : 'Add User'}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ ...card, padding: '24px', marginBottom: '24px' }}>
          <div style={{ ...sectionLabel, marginBottom: '16px' }}>New user</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <Input label="Username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="jsmith" />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jsmith@example.com" />
            <Input label="Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 8 chars" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-body)', fontWeight: 600 }}>Role</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border)', color: 'var(--text-base)', padding: '8px 12px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          {formError && <div style={{ fontSize: '13px', color: '#ef4444', marginBottom: '12px' }}>{formError}</div>}
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create User'}
          </Button>
        </div>
      )}

      {/* Users table */}
      <div style={card}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-inner)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={sectionLabel}>Users ({users.length})</span>
        </div>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '15px' }}>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead style={{ background: 'var(--bg-app)' }}>
                <tr>
                  {['Username', 'Email', 'Role', 'Created', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No users found.</td></tr>
                ) : users.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? `1px solid var(--border-inner)` : 'none' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heading)' }}>{u.username}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <select
                        value={u.role}
                        onChange={(e) => roleMutation.mutate({ id: u.id, role: e.target.value })}
                        style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border)', color: 'var(--text-base)', padding: '4px 8px', borderRadius: '6px', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'monospace' }}>
                      {new Date(u.created_at).toISOString().slice(0, 10)}
                    </td>
                    <td style={{ padding: '12px 16px', display: 'flex', gap: '6px' }}>
                      <Button size="sm" variant="ghost" onClick={() => setEditUser(u)}>
                        <Pencil size={13} /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(u)}
                        style={{ color: '#ef4444' }}>
                        <Trash2 size={13} /> Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => setEditUser(null)}
        />
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete user"
        message={`Permanently delete "${confirmDelete?.username}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
