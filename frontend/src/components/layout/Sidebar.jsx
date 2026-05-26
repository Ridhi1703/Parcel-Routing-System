import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { logout } from '../../api/auth'
import {
  Package, UploadCloud, List, LayoutDashboard,
  SlidersHorizontal, History, AlertTriangle, LogOut, Layers,
  Users, Sun, Moon, UserCircle,
} from 'lucide-react'
import { ConfirmModal } from '../ui/Modal'

// ── Dark mode hook ─────────────────────────────────────────────────────────
const DARK_KEY = 'pf_dark'
function getInitialDark() {
  try {
    const stored = localStorage.getItem(DARK_KEY)
    if (stored !== null) return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch { return false }
}
export function useDarkMode() {
  const [dark, setDark] = useState(getInitialDark)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    try { localStorage.setItem(DARK_KEY, String(dark)) } catch {}
  }, [dark])
  return [dark, setDark]
}

// ── Sub-components ─────────────────────────────────────────────────────────
function SectionLabel({ children, collapsed }) {
  if (collapsed) return <div style={{ height: '24px' }} />
  return (
    <div style={{
      fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '16px 16px 6px',
    }}>
      {children}
    </div>
  )
}

function NavItem({ to, icon, children, collapsed, end: endProp }) {
  return (
    <NavLink
      to={to}
      end={endProp}
      title={collapsed ? String(children) : undefined}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: collapsed ? 0 : '10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '8px' : '8px 12px',
        borderRadius: '8px', margin: '1px 8px',
        fontSize: '14px', fontWeight: 500, textDecoration: 'none',
        transition: 'background 150ms ease, color 150ms ease',
        overflow: 'hidden',
        ...(isActive
          ? { background: 'var(--primary)', color: '#fff', boxShadow: '0 1px 4px rgba(79,70,229,0.3)' }
          : { color: 'var(--text-nav)' }),
      })}
      onMouseEnter={(e) => {
        if (e.currentTarget.style.background === 'rgb(79, 70, 229)') return
        e.currentTarget.style.background = 'var(--primary-light)'
        e.currentTarget.style.color = 'var(--primary)'
      }}
      onMouseLeave={(e) => {
        if (e.currentTarget.style.background === 'rgb(79, 70, 229)') return
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-nav)'
      }}
    >
      <span style={{ flexShrink: 0, opacity: 0.85 }}>{icon}</span>
      {!collapsed && children}
    </NavLink>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: 'var(--border-sidebar)', margin: '8px 16px' }} />
}

const SIDEBAR_KEY = 'pf_sidebar_collapsed'

export default function Sidebar() {
  const { role, user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true' } catch { return false }
  })
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [dark, setDark] = useDarkMode()

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c
      try { localStorage.setItem(SIDEBAR_KEY, String(next)) } catch {}
      return next
    })
  }

  const handleLogout = async () => {
    try { await logout() } catch {}
    clearAuth()
    navigate('/login')
  }

  const w = collapsed ? '64px' : '240px'

  return (
    <>
      <aside style={{
        width: w, minWidth: w,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-sidebar)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 200ms ease, min-width 200ms ease',
        overflow: 'hidden',
      }}>
        {/* Brand — click to toggle collapse */}
        <div
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            padding: '16px 12px 12px',
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '10px', minHeight: '60px',
            cursor: 'pointer', userSelect: 'none',
          }}
        >
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px', background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Layers size={15} color="#fff" />
          </div>
          {!collapsed && (
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>
              ParcelFlow
            </span>
          )}
        </div>

        <nav style={{ flex: 1, paddingBottom: '8px', overflow: 'hidden' }}>
          {(role === 'user' || role === 'admin') && (
            <>
              <SectionLabel collapsed={collapsed}>Parcels</SectionLabel>
              <NavItem to="/submit" icon={<Package size={16} />} collapsed={collapsed}>Submit Parcel</NavItem>
              <NavItem to="/batch" icon={<UploadCloud size={16} />} collapsed={collapsed}>Batch Upload</NavItem>
              <NavItem to="/my-parcels" icon={<List size={16} />} collapsed={collapsed}>My Parcels</NavItem>
            </>
          )}
          {role === 'admin' && (
            <>
              <Divider />
              <SectionLabel collapsed={collapsed}>Admin</SectionLabel>
              <NavItem to="/admin/dashboard" icon={<LayoutDashboard size={16} />} collapsed={collapsed}>Dashboard</NavItem>
              <NavItem to="/admin/parcels" icon={<List size={16} />} collapsed={collapsed}>All Parcels</NavItem>
              {/* `end` prevents /admin/rules matching /admin/rules/history */}
              <NavItem to="/admin/rules" end icon={<SlidersHorizontal size={16} />} collapsed={collapsed}>Rule Editor</NavItem>
              <NavItem to="/admin/rules/history" icon={<History size={16} />} collapsed={collapsed}>Rule History</NavItem>
              <NavItem to="/admin/dlq" icon={<AlertTriangle size={16} />} collapsed={collapsed}>Dead Letter Queue</NavItem>
              <NavItem to="/admin/users" icon={<Users size={16} />} collapsed={collapsed}>User Management</NavItem>
            </>
          )}
          {role === 'viewer' && (
            <>
              <SectionLabel collapsed={collapsed}>Viewer</SectionLabel>
              <NavItem to="/viewer/dashboard" icon={<LayoutDashboard size={16} />} collapsed={collapsed}>Dashboard</NavItem>
              <NavItem to="/viewer/parcels" icon={<List size={16} />} collapsed={collapsed}>Parcels</NavItem>
            </>
          )}
          <Divider />
          <NavItem to="/account" icon={<UserCircle size={16} />} collapsed={collapsed}>My Account</NavItem>
        </nav>

        {/* User footer */}
        <div style={{
          borderTop: '1px solid var(--border-sidebar)', padding: '10px 12px',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between', gap: '6px',
        }}>
          {!collapsed && (
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.username}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{role}</div>
            </div>
          )}
          {/* Dark mode toggle */}
          <button
            onClick={() => setDark((d) => !d)}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: '5px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', flexShrink: 0,
              transition: 'color 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          {/* Logout */}
          <button
            onClick={() => setConfirmLogout(true)}
            title="Logout"
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: '5px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', flexShrink: 0,
              transition: 'color 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <ConfirmModal
        open={confirmLogout}
        title="Sign out"
        message="Are you sure you want to sign out of ParcelFlow?"
        confirmLabel="Sign out"
        variant="danger"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </>
  )
}
