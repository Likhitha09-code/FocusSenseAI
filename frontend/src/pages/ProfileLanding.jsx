import { useState } from 'react'
import { Brain, CheckCircle2, LogOut, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

export function ProfileLanding() {
  const { profile, role, logout } = useAuth()
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)

  const runApiTest = async (endpoint) => {
    setTesting(true)
    setTestResult(null)
    try {
      const response = await api.get(endpoint)
      setTestResult({
        endpoint,
        status: response.status,
        data: response.data,
        success: true,
      })
    } catch (err) {
      setTestResult({
        endpoint,
        status: err.response?.status || 'Error',
        data: err.response?.data || { error: err.message },
        success: false,
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f1e8] px-6 py-10 text-[#17221c] sm:px-10 lg:px-16">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#17221c]/20 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-[#d7e65a]">
              <Brain size={21} strokeWidth={2.5} />
            </div>
            <div>
              <span className="font-mono text-sm font-bold tracking-[0.18em] uppercase">
                FocusSense AI
              </span>
              <span className="ml-3 rounded bg-[#4e6656]/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#4e6656] uppercase">
                Authenticated Session
              </span>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-lg border border-[#17221c]/20 bg-white px-3.5 py-2 font-mono text-xs font-semibold text-[#17221c] transition hover:bg-[#17221c] hover:text-[#f5f1e8]"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </header>

        {/* Foundation Notice */}
        <div className="my-8 rounded-xl border border-[#4e6656]/30 bg-[#f0f5ee] p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="mt-0.5 text-[#4e6656]" />
            <div>
              <h2 className="font-serif text-lg font-bold text-[#17221c]">
                Task 5 Foundation Verified: Authenticated Session & Profile Link
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#405047]">
                Your Supabase Auth token has been verified by the FastAPI backend, and your application
                profile has been successfully resolved. Feature dashboards, study session telemetry, and ML
                explainability modules will be introduced in subsequent tasks.
              </p>
            </div>
          </div>
        </div>

        {/* Identity Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Resolved Application Profile */}
          <div className="rounded-xl border border-[#17221c]/20 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#17221c]/10 pb-4">
              <div className="flex items-center gap-2">
                <User size={18} className="text-[#4e6656]" />
                <h3 className="font-serif text-base font-bold">Application Profile</h3>
              </div>
              <span className="rounded-full bg-[#17221c] px-3 py-0.5 font-mono text-xs font-bold text-[#f5f1e8] uppercase">
                {role}
              </span>
            </div>

            <dl className="mt-4 space-y-3 text-xs">
              <div>
                <dt className="font-mono text-[#4e6656] uppercase">Display Name</dt>
                <dd className="mt-0.5 text-sm font-semibold text-[#17221c]">
                  {profile?.name || 'Not provided'}
                </dd>
              </div>

              <div>
                <dt className="font-mono text-[#4e6656] uppercase">Registered Email</dt>
                <dd className="mt-0.5 font-mono text-xs text-[#17221c]">
                  {profile?.email || 'Authenticated via token'}
                </dd>
              </div>

              <div>
                <dt className="font-mono text-[#4e6656] uppercase">
                  {role === 'student' ? 'Student ID (DB PK)' : 'Parent ID (DB PK)'}
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-[#17221c]">
                  {role === 'student' ? profile?.student_id : profile?.parent_id}
                </dd>
              </div>

              <div>
                <dt className="font-mono text-[#4e6656] uppercase">Supabase Auth UUID</dt>
                <dd className="mt-0.5 font-mono text-[11px] text-[#405047] break-all">
                  {profile?.auth_user_id}
                </dd>
              </div>
            </dl>
          </div>

          {/* Verification & Security Test Suite */}
          <div className="rounded-xl border border-[#17221c]/20 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#17221c]/10 pb-4">
              <ShieldCheck size={18} className="text-[#4e6656]" />
              <h3 className="font-serif text-base font-bold">Backend Role Verification</h3>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[#405047]">
              Execute authenticated calls through Axios with automatic Bearer token injection to test
              backend role dependencies:
            </p>

            <div className="mt-4 space-y-2">
              <button
                onClick={() => runApiTest('/api/v1/auth/me')}
                disabled={testing}
                className="w-full rounded border border-[#17221c]/20 px-3 py-2 text-left font-mono text-xs hover:bg-[#f5f1e8] transition disabled:opacity-50"
              >
                GET /api/v1/auth/me
              </button>
              <button
                onClick={() => runApiTest('/api/v1/auth/student-test')}
                disabled={testing}
                className="w-full rounded border border-[#17221c]/20 px-3 py-2 text-left font-mono text-xs hover:bg-[#f5f1e8] transition disabled:opacity-50"
              >
                GET /api/v1/auth/student-test
              </button>
              <button
                onClick={() => runApiTest('/api/v1/auth/parent-test')}
                disabled={testing}
                className="w-full rounded border border-[#17221c]/20 px-3 py-2 text-left font-mono text-xs hover:bg-[#f5f1e8] transition disabled:opacity-50"
              >
                GET /api/v1/auth/parent-test
              </button>
            </div>

            {testResult && (
              <div
                className={`mt-4 rounded-lg p-3 text-xs font-mono ${
                  testResult.success
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                <div className="flex justify-between font-bold">
                  <span>{testResult.endpoint}</span>
                  <span>HTTP {testResult.status}</span>
                </div>
                <pre className="mt-2 max-h-32 overflow-auto text-[11px]">
                  {JSON.stringify(testResult.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
