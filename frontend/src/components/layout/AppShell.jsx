import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Toast from '../ui/Toast'

export default function AppShell() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-app)' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
        <Outlet />
      </main>
      <Toast />
    </div>
  )
}
