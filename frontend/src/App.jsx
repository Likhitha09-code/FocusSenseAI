import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { Brain, GitBranch, LogIn, Orbit, UserCheck, UserPlus } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { StudentLayout } from './components/layout/StudentLayout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { ProfileLanding } from './pages/ProfileLanding'
import { StudentDashboard } from './pages/student/StudentDashboard'
import { StudySessions } from './pages/student/StudySessions'
import { Behaviour } from './pages/student/Behaviour'
import { Performance } from './pages/student/Performance'
import { Recommendations } from './pages/student/Recommendations'
import { StudentProfile } from './pages/student/StudentProfile'

function AppRedirect() {
  const { role } = useAuth()
  if (role === 'student') {
    return <Navigate to="/app/student/dashboard" replace />
  }
  return <ProfileLanding />
}

function HomeLanding() {
  const { user, profile } = useAuth()

  return (
    <main className="min-h-screen bg-[#f5f1e8] px-6 py-8 text-[#17221c] sm:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-[#17221c]/20 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-[#d7e65a]">
              <Brain size={21} strokeWidth={2.5} />
            </div>
            <span className="font-mono text-sm font-bold tracking-[0.18em] uppercase">
              FocusSense AI
            </span>
          </div>

          <div className="flex items-center gap-3">
            {user && profile ? (
              <Link
                to={profile.role === 'student' ? '/app/student/dashboard' : '/app'}
                className="flex items-center gap-2 rounded-lg bg-[#17221c] px-4 py-2 font-mono text-xs font-bold tracking-wider text-[#f5f1e8] uppercase transition hover:bg-[#2b3a32]"
              >
                <UserCheck size={14} />
                <span>Go to Portal ({profile.role})</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center gap-2 rounded-lg border border-[#17221c]/20 bg-white px-3.5 py-2 font-mono text-xs font-semibold text-[#17221c] transition hover:bg-[#17221c] hover:text-[#f5f1e8]"
                >
                  <LogIn size={14} />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-2 rounded-lg bg-[#17221c] px-3.5 py-2 font-mono text-xs font-semibold text-[#f5f1e8] transition hover:bg-[#2b3a32]"
                >
                  <UserPlus size={14} />
                  <span>Register</span>
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="grid gap-12 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:py-28">
          <div>
            <p className="mb-6 font-mono text-xs font-bold tracking-[0.2em] text-[#4e6656] uppercase">
              AI study behaviour analyzer
            </p>
            <h1 className="max-w-3xl font-serif text-5xl leading-[0.95] tracking-tight sm:text-7xl">
              Understand what changes focus.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-[#405047]">
              A modular foundation for measuring study behaviour, explaining predictions, and
              learning which interventions help each student.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/register"
                className="rounded-lg bg-[#17221c] px-6 py-3 font-mono text-xs font-bold tracking-wider text-[#f5f1e8] uppercase transition hover:bg-[#2b3a32]"
              >
                Create Student / Parent Account
              </Link>
              <Link
                to="/login"
                className="rounded-lg border border-[#17221c]/20 bg-white px-6 py-3 font-mono text-xs font-bold tracking-wider text-[#17221c] uppercase transition hover:bg-[#17221c] hover:text-[#f5f1e8]"
              >
                Sign In
              </Link>
            </div>
          </div>

          <div className="border-l-2 border-[#17221c] pl-6 lg:mb-2">
            <p className="font-mono text-xs font-bold tracking-widest text-[#4e6656] uppercase">
              Architecture in motion
            </p>
            <div className="mt-6 space-y-5">
              {[
                ['01', 'Behavioural evidence', Brain],
                ['02', 'Interpretable predictions', Orbit],
                ['03', 'Measured interventions', GitBranch],
              ].map(([number, label, Icon]) => (
                <div className="flex items-center gap-4" key={number}>
                  <span className="font-mono text-xs text-[#4e6656]">{number}</span>
                  <Icon size={18} />
                  <span className="text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-[#17221c]/20 pt-5 font-mono text-xs text-[#405047] sm:flex-row sm:justify-between">
          <span>React + Vite + Tailwind CSS + Supabase Auth</span>
          <span>Task 6 Student Dashboard Foundation Active</span>
        </footer>
      </div>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeLanding />} />
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
