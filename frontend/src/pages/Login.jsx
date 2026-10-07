import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brain, Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const navigate = useNavigate()
  const { login, error: authError } = useAuth()
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 py-12 text-[#17221c]">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-[#d7e65a]">
              <Brain size={21} strokeWidth={2.5} />
            </div>
            <span className="font-mono text-sm font-bold tracking-[0.18em] uppercase">
              FocusSense AI
            </span>
          </Link>
          <h1 className="mt-6 font-serif text-3xl font-bold tracking-tight">Sign In</h1>
          <p className="mt-2 text-sm text-[#405047]">
            Enter your credentials to access your study identity.
          </p>
        </div>

        {/* Error Alert */}
        {(localError || authError) && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800">
            {localError || authError}
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[#17221c]/20 bg-white p-8 shadow-sm"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block font-mono text-xs font-bold tracking-wider text-[#4e6656] uppercase"
              >
                Email Address
              </label>
              <div className="relative mt-1.5">
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.edu"
                  className="w-full rounded-lg border border-[#17221c]/20 bg-[#fbf9f4] px-3.5 py-2.5 pl-10 text-sm text-[#17221c] outline-none transition focus:border-[#17221c] focus:bg-white"
                />
                <Mail
                  size={16}
                  className="pointer-events-none absolute top-3 left-3 text-[#17221c]/40"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block font-mono text-xs font-bold tracking-wider text-[#4e6656] uppercase"
              >
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-[#17221c]/20 bg-[#fbf9f4] px-3.5 py-2.5 pl-10 text-sm text-[#17221c] outline-none transition focus:border-[#17221c] focus:bg-white"
                />
                <Lock
                  size={16}
                  className="pointer-events-none absolute top-3 left-3 text-[#17221c]/40"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex w-full items-center justify-center rounded-lg bg-[#17221c] py-2.5 font-mono text-xs font-bold tracking-wider text-[#f5f1e8] uppercase transition hover:bg-[#2b3a32] disabled:opacity-50"
          >
            {submitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 text-center text-xs text-[#405047]">
          <span>Don't have an account? </span>
          <Link
            to="/register"
            className="font-semibold text-[#17221c] underline underline-offset-2 hover:text-[#4e6656]"
          >
            Register here
          </Link>
        </div>
      </div>
    </main>
  )
}

