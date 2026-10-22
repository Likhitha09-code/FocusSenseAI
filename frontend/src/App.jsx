import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { StudentLayout } from './components/layout/StudentLayout'
import { ParentLayout } from './components/layout/ParentLayout'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { ProfileLanding } from './pages/ProfileLanding'
import { StudentDashboard } from './pages/student/StudentDashboard'
import { StudySessions } from './pages/student/StudySessions'
import { Behaviour } from './pages/student/Behaviour'
import { Performance } from './pages/student/Performance'
import { Recommendations } from './pages/student/Recommendations'
import { StudentProfile } from './pages/student/StudentProfile'
import { ParentDashboard } from './pages/parent/ParentDashboard'
import { ParentLinkStudent } from './pages/parent/ParentLinkStudent'

function AppRedirect() {
  const { role } = useAuth()
  if (role === 'student') {
    return <Navigate to="/app/student/dashboard" replace />
  }
  if (role === 'parent') {
    return <Navigate to="/app/parent/dashboard" replace />
  }
  return <ProfileLanding />
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Authenticated Application Root */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppRedirect />
                </ProtectedRoute>
              }
            />

            {/* Student Protected Portal Shell */}
            <Route
              path="/app/student"
              element={
                <ProtectedRoute requiredRole="student">
                  <StudentLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<StudentDashboard />} />
              <Route path="sessions" element={<StudySessions />} />
              <Route path="behaviour" element={<Behaviour />} />
              <Route path="performance" element={<Performance />} />
              <Route path="recommendations" element={<Recommendations />} />
              <Route path="profile" element={<StudentProfile />} />
            </Route>

            {/* Parent Protected Portal Shell */}
            <Route
              path="/app/parent"
              element={
                <ProtectedRoute requiredRole="parent">
                  <ParentLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ParentDashboard />} />
              <Route path="link" element={<ParentLinkStudent />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
