import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, profileError, loading, role, refreshProfile, logout } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f1e8] text-[#17221c]">
        <div className="flex items-center gap-3 font-mono text-sm">
          <div className="size-4 animate-spin rounded-full border-2 border-[#17221c] border-t-transparent" />
          <span>Verifying authentication state...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // User is authenticated in Supabase but application profile not found or backend unreachable
  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 text-[#17221c]">
        <div className="max-w-md rounded-xl border border-[#17221c]/20 bg-white p-8 shadow-sm">
          <span className="font-mono text-xs font-bold tracking-widest text-[#4e6656] uppercase">
            {profileError ? 'Backend Service Notice' : 'Profile Notice'}
          </span>
          <h2 className="mt-2 font-serif text-2xl font-bold">
            {profileError ? 'Unable to Verify Application Profile' : 'Application Profile Not Found'}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#405047]">
            {profileError
              ? profileError
              : 'Your Supabase identity is verified, but no application profile (Student or Parent) has been associated with this account.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {profileError && (
              <button
                type="button"
                onClick={() => refreshProfile()}
                className="rounded bg-[#17221c] px-4 py-2 text-xs font-semibold text-[#f5f1e8] hover:bg-[#2b3a32]"
              >
                Retry Profile Lookup
              </button>
            )}
            <Link
              to="/register"
              className={`rounded px-4 py-2 text-xs font-semibold ${
                profileError
                  ? 'border border-[#17221c]/20 bg-[#f5f1e8] text-[#17221c] hover:bg-[#e8e2d5]'
                  : 'bg-[#17221c] text-[#f5f1e8] hover:bg-[#2b3a32]'
              }`}
            >
              Complete Registration
            </Link>
            <button
              type="button"
              onClick={logout}
              className="rounded border border-[#17221c]/20 bg-white px-4 py-2 text-xs font-semibold text-[#17221c] hover:bg-[#f5f1e8]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (requiredRole && role !== requiredRole) {
    const returnPath = role === 'parent' ? '/app/parent/dashboard' : '/app/student/dashboard'
    const returnLabel = role === 'parent' ? 'Return to Parent Portal' : 'Return to Student Portal'

    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-6 text-[var(--text-primary)]">
        <div className="max-w-md rounded-2xl border border-[var(--status-danger-border)] bg-[var(--bg-surface)] p-8 shadow-xl">
          <span className="font-mono text-xs font-bold tracking-widest text-[var(--status-danger)] uppercase">
            HTTP 403 Forbidden
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Access Restricted
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
            This protected workspace requires the <strong>{requiredRole}</strong> role. You are currently
            authenticated as a <strong>{role}</strong> ({profile?.email || user?.email || 'Active Account'}).
          </p>
          <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs">
            <Link
              to={returnPath}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-4 py-2 font-bold text-[var(--accent-contrast)] uppercase tracking-wider transition hover:bg-[var(--accent-hover)] shadow-xs"
            >
              {returnLabel}
            </Link>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2 font-semibold text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            >
              Sign Out / Switch Account
            </button>
          </div>
        </div>
      </main>
    )
  }

  return children
}


