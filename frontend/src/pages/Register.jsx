import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  Moon,
  Sun,
  User,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export function Register() {
  const navigate = useNavigate()
  const {
    user,
    profile,
    registerStudent,
    registerParent,
    completeProfileRegistration,
    logout,
    error: authError,
  } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const isCompletingProfile = Boolean(user && !profile)
  const metadata = user?.user_metadata || {}

  const [role, setRole] = useState(() =>
    metadata.role === 'parent' ? 'parent' : 'student'
  )
  const [name, setName] = useState(() => metadata.name || '')
  const [email, setEmail] = useState(() => user?.email || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Student specific fields
  const [department, setDepartment] = useState(() => metadata.department || '')
  const [semester, setSemester] = useState(() =>
    metadata.semester ? String(metadata.semester) : '1'
  )
  const [academicYear, setAcademicYear] = useState(() =>
    metadata.academic_year ? String(metadata.academic_year) : '1'
  )

  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState(null)
  const [successNotice, setSuccessNotice] = useState(null)

  if (user && profile) {
    return <Navigate to="/app" replace />
  }

  const effectiveEmail = isCompletingProfile ? user?.email || email : email
  const effectiveName = name || (isCompletingProfile ? metadata.name || '' : '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)
    setSuccessNotice(null)

    if (!effectiveName.trim()) {
      setLocalError('Please enter your full name.')
      return
    }

    if (isCompletingProfile) {
      setSubmitting(true)
      try {
        await completeProfileRegistration({
          role,
          name: effectiveName.trim(),
          department: department.trim() || null,
          semester: semester ? parseInt(semester, 10) : null,
          academic_year: academicYear ? parseInt(academicYear, 10) : null,
        })
        navigate('/app')
      } catch (err) {
        setLocalError(
          err.message || 'Failed to complete profile registration. Please try again.'
        )
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!effectiveEmail.trim() || !password) {
      setLocalError('Please enter a valid email and password.')
      return
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      if (role === 'student') {
        const res = await registerStudent({
          email: effectiveEmail.trim(),
          password,
          name: effectiveName.trim(),
          department: department.trim() || null,
          semester: semester ? parseInt(semester, 10) : null,
          academic_year: academicYear ? parseInt(academicYear, 10) : null,
        })

        if (res.confirmationRequired) {
          setSuccessNotice(res.message)
        } else {
          navigate('/app')
        }
      } else {
        const res = await registerParent({
          email: effectiveEmail.trim(),
          password,
          name: effectiveName.trim(),
        })

        if (res.confirmationRequired) {
          setSuccessNotice(res.message)
        } else {
          navigate('/app')
        }
      }
    } catch (err) {
      setLocalError(err.message || 'Registration failed. Please check your information.')
    } finally {
      setSubmitting(false)
    }
  }

  const activeError = localError || authError

  return (
    <main className="flex min-h-screen flex-col justify-between bg-[var(--bg-canvas)] px-4 py-8 text-[var(--text-primary)] transition-colors sm:px-6 lg:px-8">
      {/* Top Navbar with Home Link & Theme Toggle */}
      <div className="mx-auto flex w-full max-w-lg items-center justify-between pb-6">
        <Link to="/" className="flex items-center gap-2.5 transition hover:opacity-85">
          <div className="grid size-9 place-items-center rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent-primary)] shadow-sm">
            <Brain size={20} strokeWidth={2.5} />
          </div>
          <span className="font-mono text-xs font-bold tracking-widest text-[var(--text-primary)] uppercase">
            FocusSense AI
          </span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-mono text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          {theme === 'dark' ? (
            <Sun size={14} className="text-[var(--status-warning)]" />
          ) : (
            <Moon size={14} className="text-[var(--accent-primary)]" />
          )}
          <span className="text-[11px] font-mono capitalize">{theme}</span>
        </button>
      </div>

      {/* Main Registration Card */}
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-xl sm:p-8">
          {/* Header */}
          <div className="mb-6">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--accent-primary)]">
              {isCompletingProfile ? 'Profile Setup' : 'New Identity'}
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {isCompletingProfile ? 'Complete Profile Setup' : 'Create an Account'}
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              {isCompletingProfile
                ? 'Link a Student or Parent profile to your verified Supabase identity.'
                : 'Join FocusSense AI to begin tracking study telemetry and behavioural metrics.'}
            </p>
          </div>

          {/* Verified Identity Banner */}
          {isCompletingProfile && (
            <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-3 text-xs text-[var(--text-primary)]">
              <div>
                <span className="font-mono font-bold uppercase text-[var(--accent-primary)]">
                  Verified Identity:{' '}
                </span>
                <span className="font-semibold">{user.email}</span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="shrink-0 font-mono text-[11px] font-semibold text-[var(--accent-primary)] underline hover:text-[var(--accent-hover)]"
              >
                Switch Account
              </button>
            </div>
          )}

          {/* Email Verification Success Alert */}
          {successNotice && (
            <div className="mb-6 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-soft)] p-5 text-sm text-[var(--text-primary)] shadow-sm">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[var(--status-success)]" />
                <div>
                  <h3 className="font-bold text-[var(--text-primary)]">Verification Email Sent</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {successNotice}
                  </p>
                  <div className="mt-4">
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)]"
                    >
                      <span>Proceed to Sign In</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {activeError && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-soft)] p-3.5 text-xs text-[var(--status-danger)]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="font-medium leading-relaxed">{activeError}</div>
            </div>
          )}

          {!successNotice && (
            <>
              {/* Role Selection Tabs */}
              <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-[var(--bg-elevated)] p-1.5 border border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
                    role === 'student'
                      ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] border border-[var(--border-subtle)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <BookOpen size={15} />
                  <span>Student</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('parent')}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
                    role === 'parent'
                      ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] border border-[var(--border-subtle)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Users size={15} />
                  <span>Parent</span>
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label
                    htmlFor="name"
                    className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]"
                  >
                    Full Name
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="name"
                      type="text"
                      required
                      value={effectiveName}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={
                        role === 'student' ? 'e.g. Alex Morgan' : 'e.g. Eleanor Morgan'
                      }
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 pl-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--focus-ring)]"
                    />
                    <User
                      size={16}
                      className="pointer-events-none absolute top-3 left-3 text-[var(--text-muted)]"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label
                    htmlFor="reg-email"
                    className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]"
                  >
                    Email Address
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="reg-email"
                      type="email"
                      required
                      autoComplete="email"
                      disabled={isCompletingProfile}
                      value={effectiveEmail}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@university.edu"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 pl-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <Mail
                      size={16}
                      className="pointer-events-none absolute top-3 left-3 text-[var(--text-muted)]"
                    />
                  </div>
                </div>

                {/* Student Specific Fields */}
                {role === 'student' && (
                  <div className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-mono">
                      <GraduationCap size={15} className="text-[var(--accent-primary)]" />
                      <span>Academic Credentials</span>
                    </div>

                    <div>
                      <label
                        htmlFor="department"
                        className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]"
                      >
                        Department / Major
                      </label>
                      <input
                        id="department"
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g. Computer Science & Engineering"
                        className="mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="academic-year"
                          className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]"
                        >
                          Year
                        </label>
                        <select
                          id="academic-year"
                          value={academicYear}
                          onChange={(e) => setAcademicYear(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)]"
                        >
                          <option value="1">Year 1</option>
                          <option value="2">Year 2</option>
                          <option value="3">Year 3</option>
                          <option value="4">Year 4</option>
                          <option value="5">Year 5</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="semester"
                          className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]"
                        >
                          Semester
                        </label>
                        <select
                          id="semester"
                          value={semester}
                          onChange={(e) => setSemester(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)]"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((sem) => (
                            <option key={sem} value={sem}>
                              Semester {sem}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Password Fields */}
                {!isCompletingProfile && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="reg-password"
                        className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]"
                      >
                        Password
                      </label>
                      <div className="relative mt-1.5">
                        <input
                          id="reg-password"
                          type="password"
                          required
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min 6 chars"
                          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 pl-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--focus-ring)]"
                        />
                        <Lock
                          size={16}
                          className="pointer-events-none absolute top-3 left-3 text-[var(--text-muted)]"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="confirm-password"
                        className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]"
                      >
                        Confirm Password
                      </label>
                      <div className="relative mt-1.5">
                        <input
                          id="confirm-password"
                          type="password"
                          required
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat password"
                          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 pl-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--focus-ring)]"
                        />
                        <Lock
                          size={16}
                          className="pointer-events-none absolute top-3 left-3 text-[var(--text-muted)]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] py-3 font-mono text-xs font-bold text-[var(--accent-contrast)] uppercase tracking-wider transition hover:bg-[var(--accent-hover)] shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Provisioning Profile...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {isCompletingProfile
                          ? `Complete ${role === 'student' ? 'Student' : 'Parent'} Setup`
                          : `Register as ${role === 'student' ? 'Student' : 'Parent'}`}
                      </span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* Footer Sign-in Link */}
          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5 text-center text-xs text-[var(--text-secondary)]">
            <span>Already registered? </span>
            <Link
              to="/login"
              className="font-semibold text-[var(--accent-primary)] underline underline-offset-2 transition hover:text-[var(--accent-hover)]"
            >
              Sign in here
            </Link>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mx-auto mt-8 w-full max-w-lg text-center font-mono text-[11px] text-[var(--text-muted)]">
        <span>Protected by Supabase Auth & FocusSense AI Security</span>
      </div>
    </main>
  )
}
