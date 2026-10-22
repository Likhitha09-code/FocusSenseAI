import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, Brain, Lock, Loader2, Mail, Moon, Sun } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export function Login() {
  const navigate = useNavigate()
  const { login, error: authError } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)

    if (!email.trim() || !password) {
      setLocalError('Please enter both email and password.')
      return
    }

    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate('/app')
    } catch (err) {
      setLocalError(err.message || 'Login failed. Please verify your credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  const activeError = localError || authError

  return (
    <main className="flex min-h-screen flex-col justify-between bg-[var(--bg-canvas)] px-4 py-8 text-[var(--text-primary)] transition-colors sm:px-6 lg:px-8">
      {/* Top Navbar Bar with Home Link & Theme Toggle */}
      <div className="mx-auto flex w-full max-w-md items-center justify-between pb-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 transition hover:opacity-85"
        >
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

      {/* Main Form Card Container */}
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-xl sm:p-8">
          {/* Header */}
          <div className="mb-6">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--accent-primary)]">
              Welcome Back
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              Sign In to Your Identity
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              Enter your verified email and password to access your study portal.
            </p>
          </div>

          {/* Error Banner */}
          {activeError && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-soft)] p-3.5 text-xs text-[var(--status-danger)]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="font-medium leading-relaxed">{activeError}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]"
              >
                Email Address
              </label>
              <div className="relative mt-1.5">
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.edu"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 pl-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--focus-ring)]"
                />
                <Mail
                  size={16}
                  className="pointer-events-none absolute top-3 left-3 text-[var(--text-muted)]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]"
                >
                  Password
                </label>
              </div>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 pl-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--focus-ring)]"
                />
                <Lock
                  size={16}
                  className="pointer-events-none absolute top-3 left-3 text-[var(--text-muted)]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] py-3 font-mono text-xs font-bold text-[var(--accent-contrast)] uppercase tracking-wider transition hover:bg-[var(--accent-hover)] shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Footer Register Link */}
          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5 text-center text-xs text-[var(--text-secondary)]">
            <span>Don&apos;t have an account yet? </span>
            <Link
              to="/register"
              className="font-semibold text-[var(--accent-primary)] underline underline-offset-2 transition hover:text-[var(--accent-hover)]"
            >
              Register here
            </Link>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mx-auto mt-8 w-full max-w-md text-center font-mono text-[11px] text-[var(--text-muted)]">
        <span>Protected by Supabase Auth & FocusSense AI Security</span>
      </div>
    </main>
  )
}
