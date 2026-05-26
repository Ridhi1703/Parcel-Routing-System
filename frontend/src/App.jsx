import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import RoleGuard from './guards/RoleGuard'
import Login from './pages/Login'
import Submit from './pages/user/Submit'
import Batch from './pages/user/Batch'
import MyParcels from './pages/user/MyParcels'
import AdminDashboard from './pages/admin/Dashboard'
import AdminParcels from './pages/admin/Parcels'
import RuleEditor from './pages/admin/RuleEditor'
import RuleHistory from './pages/admin/RuleHistory'
import DeadLetter from './pages/admin/DeadLetter'
import UserManagement from './pages/admin/UserManagement'
import ViewerDashboard from './pages/viewer/Dashboard'
import ViewerParcels from './pages/viewer/Parcels'
import ParcelDetailPage from './pages/ParcelDetailPage'
import Profile from './pages/account/Profile'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RoleGuard allow={['user', 'admin', 'viewer']} />}>
          <Route element={<AppShell />}>
            {/* User + Admin */}
            <Route element={<RoleGuard allow={['user', 'admin']} />}>
              <Route path="/submit" element={<Submit />} />
              <Route path="/batch" element={<Batch />} />
              <Route path="/my-parcels" element={<MyParcels />} />
            </Route>

            {/* Admin only */}
            <Route element={<RoleGuard allow={['admin']} />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/parcels" element={<AdminParcels />} />
              <Route path="/admin/rules" element={<RuleEditor />} />
              <Route path="/admin/rules/history" element={<RuleHistory />} />
              <Route path="/admin/dlq" element={<DeadLetter />} />
              <Route path="/admin/users" element={<UserManagement />} />
            </Route>

            {/* Viewer + Admin */}
            <Route element={<RoleGuard allow={['viewer', 'admin']} />}>
              <Route path="/viewer/dashboard" element={<ViewerDashboard />} />
              <Route path="/viewer/parcels" element={<ViewerParcels />} />
            </Route>

            {/* All authenticated */}
            <Route path="/parcels/:id" element={<ParcelDetailPage />} />
            <Route path="/account" element={<Profile />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}


