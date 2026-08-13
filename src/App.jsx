import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { FullPageLoader } from './components/ui'
import AuthPage from './pages/AuthPage'
import AppLayout from './layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Assignments from './pages/Assignments'
import AssignmentDetail from './pages/AssignmentDetail'
import GradePage from './pages/GradePage'
import Schedule from './pages/Schedule'
import Students from './pages/Students'

export default function App() {
  const { loading, user } = useAuth()

  if (loading) return <FullPageLoader label="Starting up…" />
  if (!user) return <AuthPage />

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="assignments/:id" element={<AssignmentDetail />} />
        <Route path="assignments/:id/grade/:submissionId" element={<GradePage />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="students" element={<Students />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
