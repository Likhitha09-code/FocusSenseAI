import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, loading, role } = useAuth()

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

  // User is authenticated in Supabase but application profile not found
  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 text-[#17221c]">
        <div className="max-w-md rounded-xl border border-[#17221c]/20 bg-white p-8 shadow-sm">
          <span className="font-mono text-xs font-bold tracking-widest text-[#4e6656] uppercase">
            Profile Notice
          </span>
          <h2 className="mt-2 font-serif text-2xl font-bold">Application Profile Not Found</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#405047]">
            Your Supabase identity is verified, but no application profile (Student or Parent) has
            been associated with this account.
          </p>
          <div className="mt-6 flex gap-3">
            <a
              href="/register"
              className="rounded bg-[#17221c] px-4 py-2 text-xs font-semibold text-[#f5f1e8] hover:bg-[#2b3a32]"
            >
              Complete Registration
            </a>
          </div>
        </div>
      </main>
    )
  }

  if (requiredRole && role !== requiredRole) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 text-[#17221c]">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-8 text-red-900 shadow-sm">
          <span className="font-mono text-xs font-bold tracking-widest text-red-700 uppercase">
            HTTP 403 Forbidden
          </span>
          <h2 className="mt-2 font-serif text-2xl font-bold">Access Restricted</h2>
          <p className="mt-3 text-sm leading-relaxed">
            This protected area requires the <strong>{requiredRole}</strong> role. You are currently
            authenticated as a <strong>{role}</strong>.
          </p>
        </div>
      </main>
    )
  }

  return children
}

