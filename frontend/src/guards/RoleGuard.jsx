import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'

export default function RoleGuard({ allow }) {
  const { token, role } = useAuthStore()

  if (!token) return <Navigate to="/login" replace />
  if (!allow.includes(role)) return <Navigate to="/login" replace />

  return <Outlet />
}
