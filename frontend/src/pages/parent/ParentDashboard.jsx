import { useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  BookOpen,
  Brain,
  Clock,
  Flame,
  GraduationCap,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { getLinkedStudents, getParentStudentProgress, unlinkStudentFromParent } from '../../lib/api'
import { SummaryCard } from '../../components/dashboard/SummaryCard'
import { SectionCard } from '../../components/dashboard/SectionCard'
import { EmptyState } from '../../components/dashboard/EmptyState'

export function ParentDashboard() {
  const [linkedStudents, setLinkedStudents] = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [progressLoading, setProgressLoading] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [error, setError] = useState(null)
  const [progressError, setProgressError] = useState(null)

  const fetchStudents = async () => {
    setLoading(true)
    setError(null)
    try {
      const students = await getLinkedStudents()
      setLinkedStudents(students)
      if (students.length > 0) {
        // default select first active consent student if available, or first in list
        const activeStudent = students.find((s) => s.consent_status === 'active') || students[0]
        setSelectedStudentId(activeStudent.student_id)
      } else {
        setSelectedStudentId('')
        setProgress(null)
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Failed to load linked students. Please ensure backend is reachable.'
      )
    } finally {
      setLoading(false)
    }
  }

  const fetchProgress = async (studentId) => {
    if (!studentId) return
    setProgressLoading(true)
    setProgressError(null)
    try {
      const data = await getParentStudentProgress(studentId)
      setProgress(data)
    } catch (err) {
      setProgress(null)
      setProgressError(
        err.response?.data?.detail ||
          'Failed to load student progress. Active student consent is required.'
      )
    } finally {
      setProgressLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  useEffect(() => {
    if (selectedStudentId) {
      fetchProgress(selectedStudentId)
    }
  }, [selectedStudentId])

  const handleUnlinkStudent = async (studentId) => {
    if (!studentId) return
    const confirmed = window.confirm(
      'Are you sure you want to unlink this student account? This will revoke access until a new link request is approved.'
    )
    if (!confirmed) return

    setUnlinking(true)
    try {
      await unlinkStudentFromParent(studentId)
      await fetchStudents()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to unlink student account.')
    } finally {
      setUnlinking(false)
    }
  }

  const selectedLink = linkedStudents.find((s) => s.student_id === selectedStudentId)

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-0.5 font-mono text-[11px] font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
              Parent Portal
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Student Progress Overview
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              Supervise study session durations, behavioural telemetry, and AI intervention recommendations
              with verified consent and strict privacy bounds.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                fetchStudents()
                if (selectedStudentId) fetchProgress(selectedStudentId)
              }}
              disabled={loading || progressLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 font-mono text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading || progressLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <Link
              to="/app/parent/link"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 font-mono text-xs font-bold text-[var(--accent-contrast)] uppercase tracking-wider transition hover:bg-[var(--accent-hover)] shadow-xs"
            >
              <UserCheck size={14} />
              <span>Link Student</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Error */}
      {error && (
        <div className="rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-soft)] p-4 text-xs text-[var(--status-danger)]">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Error Accessing Student Directory</p>
              <p className="mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-12">
          <div className="flex items-center gap-3 font-mono text-xs text-[var(--text-secondary)]">
            <div className="size-4 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
            <span>Loading linked student accounts...</span>
          </div>
        </div>
      )}

      {/* Empty State: No linked students */}
      {!loading && !error && linkedStudents.length === 0 && (
        <EmptyState
          icon={Users}
          title="No Students Linked Yet"
          description="You currently have no students linked to your parent account. Request student linking using their Student ID to begin monitoring study habits."
          actionText="Link Student Account"
          actionLink="/app/parent/link"
        />
      )}

      {/* Student Selector Bar */}
      {!loading && linkedStudents.length > 0 && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap size={16} className="text-[var(--accent-primary)]" />
              <label htmlFor="student-selector" className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Select Linked Student:
              </label>
            </div>

            <div className="flex flex-1 max-w-lg items-center gap-2.5">
              <select
                id="student-selector"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)]"
              >
                {linkedStudents.map((s) => (
                  <option key={s.student_id} value={s.student_id}>
                    {s.display_name || 'Unnamed Student'} ({s.department || 'General'}) — Consent: {s.consent_status.toUpperCase()}
                  </option>
                ))}
              </select>

              {selectedLink && (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${
                    selectedLink.consent_status === 'active'
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : selectedLink.consent_status === 'revoked' || selectedLink.consent_status === 'rejected'
                      ? 'border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {selectedLink.consent_status}
                </span>
              )}

              <button
                type="button"
                onClick={() => handleUnlinkStudent(selectedStudentId)}
                disabled={unlinking || !selectedStudentId}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 font-mono text-xs font-semibold text-rose-600 dark:text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50 shrink-0"
                title="Unlink this student"
              >
                <UserMinus size={14} />
                <span>Unlink</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Error / Consent Restricted Notice */}
      {progressError && (
        <div className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-soft)] p-6 text-xs text-[var(--status-warning)] shadow-xs">
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} className="mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Parent Access Restricted: Student Consent Required
              </h3>
              <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">
                {progressError}
              </p>
              <p className="mt-2 text-[11px] text-[var(--text-muted)] font-mono">
                Under the FocusSense AI privacy framework, telemetry and progress analytics can only be accessed once
                the student explicitly approves the link request from their profile settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Loading */}
      {progressLoading && (
        <div className="flex items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-12">
          <div className="flex items-center gap-3 font-mono text-xs text-[var(--text-secondary)]">
            <div className="size-4 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
            <span>Retrieving student study telemetry...</span>
          </div>
        </div>
      )}

      {/* Verified Student Progress Data */}
      {!progressLoading && progress && (
        <>
          {/* Key Metric Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Study Sessions"
              value={progress.total_study_sessions}
              trend={`${progress.completed_study_sessions} completed`}
              trendDirection="neutral"
              icon={Clock}
            />

            <SummaryCard
              title="Total Duration"
              value={`${progress.total_study_duration_minutes}m`}
              trend="Logged time"
              trendDirection="neutral"
              icon={TrendingUp}
            />

            <SummaryCard
              title="Average Focus"
              value={progress.average_focus_score != null ? `${progress.average_focus_score}` : 'N/A'}
              trend={progress.average_focus_score != null ? '0-100 ML Score' : 'No analyses'}
              trendDirection={
                progress.average_focus_score >= 70
                  ? 'positive'
                  : progress.average_focus_score >= 40
                  ? 'neutral'
                  : 'negative'
              }
              icon={Flame}
            />

            <SummaryCard
              title="Distraction Level"
              value={progress.latest_distraction_level || 'N/A'}
              trend="Latest session"
              trendDirection={
                progress.latest_distraction_level === 'LOW'
                  ? 'positive'
                  : progress.latest_distraction_level === 'MEDIUM'
                  ? 'neutral'
                  : 'negative'
              }
              icon={Activity}
            />
          </div>

          {/* Deep-dive sections */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Recent Sessions */}
            <SectionCard
              title="Recent Study Sessions"
              subtitle="Logged study blocks and completion statuses"
              icon={Clock}
            >
              {progress.recent_sessions.length === 0 ? (
                <p className="py-4 text-center font-mono text-xs text-[var(--text-muted)]">
                  No study sessions recorded yet for this student.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {progress.recent_sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          {sess.started_at ? new Date(sess.started_at).toLocaleString() : 'Date unspecified'}
                        </span>
                        <p className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                          Session ID: {sess.id.slice(0, 8)}...
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                          sess.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {sess.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Behaviour & AI Analytics */}
            <SectionCard
              title="AI Behaviour Insights"
              subtitle="Model predictions and attention metrics"
              icon={Brain}
            >
              {progress.recent_behaviour_analyses.length === 0 ? (
                <p className="py-4 text-center font-mono text-xs text-[var(--text-muted)]">
                  No AI behavioural analyses generated yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {progress.recent_behaviour_analyses.map((ana) => (
                    <div
                      key={ana.id}
                      className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--text-primary)]">
                            Focus Score: {ana.focus_score != null ? ana.focus_score : 'N/A'}
                          </span>
                          <span className="font-mono text-[10px] text-[var(--text-muted)]">
                            | Pred. Perf: {ana.performance_prediction != null ? `${ana.performance_prediction}%` : 'N/A'}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          {ana.analyzed_at ? new Date(ana.analyzed_at).toLocaleDateString() : 'Analyzed'}
                        </span>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          ana.distraction_level === 'LOW'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : ana.distraction_level === 'MEDIUM'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {ana.distraction_level || 'UNKNOWN'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* AI Recommendations */}
          <SectionCard
            title="Recent Recommendation Interventions"
            subtitle="Personalized habit suggestions issued to the student"
            icon={Sparkles}
          >
            {progress.recent_recommendations.length === 0 ? (
              <p className="py-4 text-center font-mono text-xs text-[var(--text-muted)]">
                No personalized recommendations issued yet.
              </p>
            ) : (
              <div className="space-y-3">
                {progress.recent_recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                        Persona: {rec.persona || 'GENERAL'}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">
                        {rec.issued_at ? new Date(rec.issued_at).toLocaleDateString() : 'Recent'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                      {rec.reason || 'Automated personalized behavioural suggestion.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Subject Performance & Mastery Summaries */}
          <SectionCard
            title="Subject Performance & Mastery Summaries"
            subtitle="Aggregated study durations, focus stability, and evaluation scores by subject"
            icon={BookOpen}
          >
            {!progress.subject_summaries || progress.subject_summaries.length === 0 ? (
              <p className="py-4 text-center font-mono text-xs text-[var(--text-muted)]">
                No enrolled subjects or subject telemetry available.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {progress.subject_summaries.map((sub) => (
                  <div
                    key={sub.subject_id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[var(--text-primary)] truncate" title={sub.subject_name}>
                        {sub.subject_name}
                      </h4>
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">
                        {sub.total_sessions} sess.
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-secondary)]">
                      <span>Study Duration:</span>
                      <span className="font-semibold text-[var(--text-primary)]">{sub.total_study_minutes} mins</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-secondary)]">
                      <span>Avg Focus Score:</span>
                      <span className="font-semibold text-[var(--accent-primary)]">
                        {sub.average_focus_score != null ? `${sub.average_focus_score}` : '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-secondary)]">
                      <span>Quiz Mastery:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {sub.average_quiz_score != null ? `${sub.average_quiz_score}%` : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}

