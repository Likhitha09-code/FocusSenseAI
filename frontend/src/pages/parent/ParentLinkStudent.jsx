import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Plus,
  Users,
} from 'lucide-react'
import { getLinkedStudents, linkStudentToParent } from '../../lib/api'
import { SectionCard } from '../../components/dashboard/SectionCard'

export function ParentLinkStudent() {
  const [studentIdInput, setStudentIdInput] = useState('')
  const [linkedStudents, setLinkedStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const fetchLinks = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getLinkedStudents()
      setLinkedStudents(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load linked students.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLinks()
  }, [])

  const handleLink = async (e) => {
    e.preventDefault()
    if (!studentIdInput.trim()) return

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await linkStudentToParent(studentIdInput.trim())
      setSuccess(
        `Link request submitted for student "${res.display_name || res.student_id}". Consent status is currently '${res.consent_status}'.`
      )
      setStudentIdInput('')
      fetchLinks()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Failed to link student. Verify that the Student ID UUID is valid and registered.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-[var(--shadow-card)]">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-0.5 font-mono text-[11px] font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
            Student Association
          </span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Link Student Account
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            Connect a student's profile to your parent account using their unique Student ID.
            Student progress telemetry is protected until the student approves consent from their profile.
          </p>
        </div>
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Link Request Form */}
        <SectionCard
          title="Submit Link Request"
          subtitle="Associate a student account via UUID"
          icon={Plus}
        >
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-soft)] p-3.5 text-xs text-[var(--status-danger)]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-soft)] p-3.5 text-xs text-[var(--status-success)]">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <div className="leading-relaxed">{success}</div>
            </div>
          )}

          <form onSubmit={handleLink} className="space-y-4">
            <div>
              <label
                htmlFor="student-id"
                className="block font-mono text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]"
              >
                Student ID (UUID)
              </label>
              <input
                id="student-id"
                type="text"
                required
                value={studentIdInput}
                onChange={(e) => setStudentIdInput(e.target.value)}
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                className="mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--focus-ring)]"
              />
              <span className="mt-1 block text-[11px] text-[var(--text-muted)]">
                The student can copy their Student ID from their profile page under "Security & Identifiers".
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting || !studentIdInput.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] py-2.5 font-mono text-xs font-bold text-[var(--accent-contrast)] uppercase tracking-wider transition hover:bg-[var(--accent-hover)] shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Submitting Request...</span>
                </>
              ) : (
                <>
                  <span>Request Student Link</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </SectionCard>

        {/* Existing Links & Consent Status */}
        <SectionCard
          title="Linked Student Directory"
          subtitle="Status of active and pending student associations"
          icon={Users}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3 font-mono text-xs text-[var(--text-secondary)]">
                <div className="size-4 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
                <span>Loading linked students...</span>
              </div>
            </div>
          ) : linkedStudents.length === 0 ? (
            <p className="py-6 text-center font-mono text-xs text-[var(--text-muted)]">
              No students linked to this parent profile yet.
            </p>
          ) : (
            <div className="space-y-3">
              {linkedStudents.map((link) => (
                <div
                  key={link.link_id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[var(--text-primary)]">
                        {link.display_name || 'Unnamed Student'}
                      </p>
                      <p className="font-mono text-[10px] text-[var(--text-muted)]">
                        ID: {link.student_id}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                        link.consent_status === 'active'
                          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : link.consent_status === 'revoked'
                          ? 'border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {link.consent_status}
                    </span>
                  </div>

                  <div className="mt-2 border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--text-secondary)]">
                    {link.department && <span>Department: {link.department} • </span>}
                    {link.academic_year && <span>Year {link.academic_year} • </span>}
                    <span>Linked {new Date(link.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

