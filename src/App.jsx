import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { FullPageLoader } from './components/ui'
import AuthPage from './pages/AuthPage'
import NotConfigured from './pages/NotConfigured'
import AppLayout from './layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Assignments from './pages/Assignments'
import AssignmentDetail from './pages/AssignmentDetail'
import GradePage from './pages/GradePage'
import Schedule from './pages/Schedule'

export default function App() {
  const { isConfigured, loading, session, profile } = useAuth()

  if (!isConfigured) return <NotConfigured />
  if (loading) return <FullPageLoader label="Starting up…" />
  if (!session) return <AuthPage />

  // Signed in but profile row not created yet (rare race right after signup).
  if (!profile) return <FullPageLoader label="Preparing your account…" />

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="assignments/:id" element={<AssignmentDetail />} />
        <Route path="assignments/:id/grade/:submissionId" element={<GradePage />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
