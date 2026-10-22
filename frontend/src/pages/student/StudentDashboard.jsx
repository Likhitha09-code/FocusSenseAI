import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Brain,
  Calendar,
  Clock,
  GraduationCap,
  Orbit,
  Play,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { SummaryCard } from '../../components/dashboard/SummaryCard'
import { SectionCard } from '../../components/dashboard/SectionCard'
import { EmptyState } from '../../components/dashboard/EmptyState'
import {
  getStudentBehaviour,
  getStudentDashboard,
  getStudySessions,
} from '../../lib/api'

function ChartTooltip({ active, payload, label, unit = '' }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-2.5 shadow-md font-mono text-xs text-[var(--text-primary)]">
        <p className="font-semibold text-[var(--text-secondary)] mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={`tooltip-${index}`} className="flex items-center gap-1.5 font-bold" style={{ color: entry.color }}>
            <span>{entry.name}:</span>
            <span>
              {entry.value}
              {unit}
            </span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function StudentDashboard() {
  const { profile } = useAuth()
  const { isDark } = useTheme()
  const studentName = profile?.name ? profile.name.split(' ')[0] : 'Student'
  const studentDept = profile?.department || 'General Curriculum'

  const [dashData, setDashData] = useState(null)
  const [recentSessions, setRecentSessions] = useState([])
  const [behaviourAnalyses, setBehaviourAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    setError(null)
    try {
      const [dashRes, sessionsRes, behRes] = await Promise.all([
        getStudentDashboard(),
        getStudySessions({ limit: 6 }).catch(() => ({ items: [] })),
        getStudentBehaviour({ limit: 10 }).catch(() => []),
      ])
      setDashData(dashRes)
      setRecentSessions(sessionsRes?.items || (Array.isArray(sessionsRes) ? sessionsRes : []))
      setBehaviourAnalyses(Array.isArray(behRes) ? behRes : [])
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setError('Unable to load dashboard data. Please check network connection.')
    } finally {
      setLoading(false)
      if (isManualRefresh) setRefreshing(false)
    }
  }

  useEffect(() => {
    let ignore = false
    async function initialFetch() {
      try {
        const [dashRes, sessionsRes, behRes] = await Promise.all([
          getStudentDashboard(),
          getStudySessions({ limit: 6 }).catch(() => ({ items: [] })),
          getStudentBehaviour({ limit: 10 }).catch(() => []),
        ])
        if (!ignore) {
          setDashData(dashRes)
          setRecentSessions(sessionsRes?.items || (Array.isArray(sessionsRes) ? sessionsRes : []))
          setBehaviourAnalyses(Array.isArray(behRes) ? behRes : [])
          setLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load dashboard data:', err)
          setError('Unable to load dashboard data. Please check network connection.')
          setLoading(false)
        }
      }
    }
    initialFetch()
    return () => {
      ignore = true
    }
  }, [])

  // KPI Formattings
  const focusScoreVal =
    dashData?.focus_score !== null && dashData?.focus_score !== undefined
      ? `${Math.round(dashData.focus_score)} / 100`
      : null

  const distractionVal = dashData?.distraction_level ? dashData.distraction_level : null

  const studyTimeMins = dashData?.study_time_minutes || 0
  const studyTimeVal =
    studyTimeMins > 0 ? `${Math.floor(studyTimeMins / 60)}h ${studyTimeMins % 60}m` : null

  const perfVal =
    dashData?.performance_score !== null && dashData?.performance_score !== undefined
      ? `${Math.round(dashData.performance_score)}%`
      : null

  // Focus Trend Chart Data
  // Build time series from behaviour analyses (sorted chronologically)
  const focusTrendData = behaviourAnalyses
    .filter((a) => a.focus_score !== null && a.focus_score !== undefined)
    .slice()
    .reverse()
    .map((item, idx) => {
      const dateStr = item.session_started_at || item.analyzed_at
      const dateLabel = dateStr
        ? new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : `Sess ${idx + 1}`
      return {
        label: dateLabel,
        focus: Math.round(item.focus_score),
        session: item.subject_name || `Session ${idx + 1}`,
      }
    })

  // Subject Performance Chart Data
  const subjectChartData = (dashData?.subject_performance || [])
    .filter((sp) => sp.average_score !== null && sp.average_score !== undefined)
    .map((sp) => ({
      name: sp.subject_name.length > 14 ? `${sp.subject_name.slice(0, 12)}...` : sp.subject_name,
      fullName: sp.subject_name,
      score: Math.round(sp.average_score),
      quizzes: sp.total_quizzes,
    }))

  const gridColor = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.08)'
  const axisColor = isDark ? '#94a3b8' : '#64748b'
  const primaryStroke = isDark ? '#818cf8' : '#6366f1'
  const barColor = isDark ? '#38bdf8' : '#0284c7'

  const formattedDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome & Context Header */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-0.5 font-mono text-[11px] font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
                <span className="size-1.5 rounded-full bg-[var(--accent-primary)]" />
                Student Workspace
              </span>
              <span className="font-mono text-xs text-[var(--text-muted)]">•</span>
              <span className="font-mono text-xs text-[var(--text-secondary)]">{studentDept}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Welcome back, {studentName}
            </h2>

            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <Calendar size={14} className="text-[var(--text-muted)]" />
              <span>{formattedDate}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing || loading}
              aria-label="Refresh dashboard data"
              title="Refresh Metrics"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
            </button>

            <Link
              to="/app/student/sessions"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2 font-mono text-xs font-bold text-[var(--accent-contrast)] uppercase tracking-wider transition hover:bg-[var(--accent-hover)] shadow-xs"
            >
              <Play size={14} fill="currentColor" />
              <span>Start Study Session</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Loading Skeletons */}
      {loading && (
        <div className="space-y-8 animate-pulse">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-72 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]" />
            <div className="h-72 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]" />
          </div>
        </div>
      )}

      {/* Error Feedback */}
      {error && !loading && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--status-danger)]/40 bg-[var(--status-danger)]/10 p-4 text-[var(--text-primary)]">
          <div className="flex items-center gap-2.5 text-xs font-medium">
            <AlertCircle size={18} className="text-[var(--status-danger)] shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadData(false)}
            className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-1 font-mono text-xs font-semibold hover:border-[var(--border-strong)]"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Key Performance Indicators */}
          <section aria-label="Key Performance Indicators">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                title="Focus Score"
                icon={Orbit}
                value={focusScoreVal}
                status={focusScoreVal ? 'AI Regressor' : 'No study data yet'}
                description="AI Regressor prediction derived from session attention stability."
              />

              <SummaryCard
                title="Distraction Level"
                icon={AlertTriangle}
                value={distractionVal}
                status={distractionVal ? 'AI Classifier' : 'Not evaluated'}
                description="AI Classifier rating derived from context switches and non-productive ratio."
              />

              <SummaryCard
                title="Study Time"
                icon={Clock}
                value={studyTimeVal}
                status={studyTimeVal ? 'Recorded Telemetry' : '0 hrs recorded'}
                description="Cumulative verified study intervals recorded within the application."
              />

              <SummaryCard
                title="Performance"
                icon={TrendingUp}
                value={perfVal}
                status={perfVal ? 'AI Estimate' : 'No assessment yet'}
                description="AI Regressor estimate derived from session telemetry and quiz baseline."
              />
            </div>
          </section>

          {/* Quick Module Navigation */}
          <section aria-label="Core Student Modules">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                to="/app/student/sessions"
                className="group flex items-center gap-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] transition hover:border-[var(--accent-border)] hover:bg-[var(--bg-elevated)]"
              >
                <div className="grid size-10 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--accent-soft)] text-[var(--accent-primary)] transition group-hover:scale-105">
                  <Clock size={18} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <span className="block truncate font-semibold text-sm text-[var(--text-primary)]">
                    Study Sessions
                  </span>
                  <span className="block truncate text-xs text-[var(--text-secondary)]">
                    Track intervals & activities
                  </span>
                </div>
              </Link>

              <Link
                to="/app/student/behaviour"
                className="group flex items-center gap-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] transition hover:border-[var(--accent-border)] hover:bg-[var(--bg-elevated)]"
              >
                <div className="grid size-10 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--accent-soft)] text-[var(--accent-primary)] transition group-hover:scale-105">
                  <Activity size={18} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <span className="block truncate font-semibold text-sm text-[var(--text-primary)]">
                    Behaviour Analysis
                  </span>
                  <span className="block truncate text-xs text-[var(--text-secondary)]">
                    Real ML predictions & what-if
                  </span>
                </div>
              </Link>

              <Link
                to="/app/student/performance"
                className="group flex items-center gap-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] transition hover:border-[var(--accent-border)] hover:bg-[var(--bg-elevated)]"
              >
                <div className="grid size-10 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--accent-soft)] text-[var(--accent-primary)] transition group-hover:scale-105">
                  <GraduationCap size={18} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <span className="block truncate font-semibold text-sm text-[var(--text-primary)]">
                    Subject Performance
                  </span>
                  <span className="block truncate text-xs text-[var(--text-secondary)]">
                    Quiz scores & mastery
                  </span>
                </div>
              </Link>

              <Link
                to="/app/student/recommendations"
                className="group flex items-center gap-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] transition hover:border-[var(--accent-border)] hover:bg-[var(--bg-elevated)]"
              >
                <div className="grid size-10 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--accent-soft)] text-[var(--accent-primary)] transition group-hover:scale-105">
                  <Sparkles size={18} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <span className="block truncate font-semibold text-sm text-[var(--text-primary)]">
                    Recommendations
                  </span>
                  <span className="block truncate text-xs text-[var(--text-secondary)]">
                    AI adaptive interventions
                  </span>
                </div>
              </Link>
            </div>
          </section>

          {/* Core Analytics Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Focus Score Trajectory */}
            <SectionCard
              title="Focus Trajectory"
              subtitle="Historical attention stability across completed sessions"
              icon={Orbit}
              action={
                <Link
                  to="/app/student/behaviour"
                  className="font-mono text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  View Details →
                </Link>
              }
            >
              {focusTrendData.length > 0 ? (
                <div className="space-y-3">
                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={focusTrendData}>
                        <defs>
                          <linearGradient id="focusGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={primaryStroke} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={primaryStroke} stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis
                          dataKey="label"
                          stroke={axisColor}
                          fontSize={11}
                          fontFamily="monospace"
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          stroke={axisColor}
                          fontSize={11}
                          fontFamily="monospace"
                          tickLine={false}
                          width={32}
                        />
                        <Tooltip content={<ChartTooltip unit=" pts" />} />
                        <Area
                          type="monotone"
                          dataKey="focus"
                          name="Focus Score"
                          stroke={primaryStroke}
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#focusGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="font-mono text-[11px] text-[var(--text-muted)] text-right">
                    Showing latest {focusTrendData.length} analyzed sessions
                  </p>
                </div>
              ) : (
                <EmptyState
                  icon={Orbit}
                  title="No focus data available yet"
                  description="Start and complete a study session to record window activity, interruption frequency, and compute your baseline focus score."
                  actionText="Start First Session"
                  actionLink="/app/student/sessions"
                />
              )}
            </SectionCard>

            {/* Subject Performance Comparison */}
            <SectionCard
              title="Subject Performance"
              subtitle="Curriculum mastery vs quiz evaluations"
              icon={GraduationCap}
              action={
                <Link
                  to="/app/student/performance"
                  className="font-mono text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  Full Report →
                </Link>
              }
            >
              {subjectChartData.length > 0 ? (
                <div className="space-y-3">
                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subjectChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis
                          dataKey="name"
                          stroke={axisColor}
                          fontSize={11}
                          fontFamily="monospace"
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          stroke={axisColor}
                          fontSize={11}
                          fontFamily="monospace"
                          tickLine={false}
                        />
                        <Tooltip content={<ChartTooltip unit="%" />} />
                        <Bar
                          dataKey="score"
                          name="Average Score"
                          fill={barColor}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    {subjectChartData.slice(0, 4).map((item) => (
                      <div
                        key={item.fullName}
                        className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5"
                      >
                        <span className="truncate text-[var(--text-secondary)]">{item.fullName}</span>
                        <span className="font-bold text-[var(--accent-primary)]">{item.score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Brain}
                  title="No subject assessment data"
                  description="Complete quizzes and associate sessions with subjects to visualize curriculum retention and focus correlations."
                  actionText="View Subjects"
                  actionLink="/app/student/performance"
                />
              )}
            </SectionCard>

            {/* Recent Study Sessions */}
            <SectionCard
              title="Recent Study Sessions"
              subtitle="Latest recorded study intervals and durations"
              icon={Clock}
              action={
                <Link
                  to="/app/student/sessions"
                  className="font-mono text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  Manage Sessions →
                </Link>
              }
            >
              {recentSessions.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] uppercase">
                      <tr>
                        <th className="px-3.5 py-2.5 font-bold">Date</th>
                        <th className="px-3.5 py-2.5 font-bold">Status</th>
                        <th className="px-3.5 py-2.5 font-bold">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {recentSessions.map((sess) => {
                        const start = new Date(sess.started_at)
                        const end = sess.ended_at ? new Date(sess.ended_at) : null
                        const durationText = end
                          ? `${Math.max(1, Math.round((end - start) / 60000))} mins`
                          : 'In progress'

                        return (
                          <tr key={sess.id} className="hover:bg-[var(--bg-elevated)]/60 transition">
                            <td className="px-3.5 py-2.5 font-medium text-[var(--text-primary)]">
                              <div>{start.toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                              <div className="text-[10px] text-[var(--text-muted)]">
                                {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span
                                className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  sess.status === 'completed'
                                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : sess.status === 'active'
                                    ? 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    : 'border border-gray-500/30 bg-gray-500/10 text-gray-500'
                                }`}
                              >
                                {sess.status}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-[var(--text-secondary)]">
                              {durationText}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={Clock}
                  title="No study sessions recorded yet"
                  description="When you start and complete study sessions, they will be listed here with timestamps and duration telemetry."
                  actionText="Start Session"
                  actionLink="/app/student/sessions"
                />
              )}
            </SectionCard>

            {/* AI Recommendations */}
            <SectionCard
              title="AI Recommendations"
              subtitle="Personalized adaptive interventions for study habits"
              icon={Sparkles}
              action={
                <Link
                  to="/app/student/recommendations"
                  className="font-mono text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  View All →
                </Link>
              }
            >
              {dashData?.recommendations && dashData.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {dashData.recommendations.map((rec) => (
                    <div
                      key={rec.recommendation_id}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[var(--accent-primary)]">
                          {rec.recommendation_type}
                        </span>
                        {rec.issued_at && (
                          <span className="font-mono text-[10px] text-[var(--text-muted)]">
                            {new Date(rec.issued_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h4 className="mt-2 text-xs font-bold text-[var(--text-primary)]">
                        {rec.title}
                      </h4>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Sparkles}
                  title="No recommendations generated yet"
                  description="Recommendations appear after behavioural patterns and focus stability are established across multiple sessions."
                  actionText="View Interventions"
                  actionLink="/app/student/recommendations"
                />
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  )
}
