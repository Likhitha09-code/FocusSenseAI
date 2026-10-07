import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Brain,
  Clock,
  Compass,
  GraduationCap,
  Orbit,
  Play,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { SummaryCard } from '../../components/dashboard/SummaryCard'
import { SectionCard } from '../../components/dashboard/SectionCard'
import { EmptyState } from '../../components/dashboard/EmptyState'
import { getStudentDashboard } from '../../lib/api'

export function StudentDashboard() {
  const { profile } = useAuth()
  const studentName = profile?.name ? profile.name.split(' ')[0] : 'Student'

  const [dashData, setDashData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDashboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getStudentDashboard()
      setDashData(data)
    } catch (err) {
      console.error('Failed to load dashboard summary:', err)
      setError('Unable to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  const focusScoreVal = dashData?.focus_score !== null && dashData?.focus_score !== undefined
    ? `${Math.round(dashData.focus_score)} / 100`
    : null

  const distractionVal = dashData?.distraction_level ? dashData.distraction_level : null

  const studyTimeMins = dashData?.study_time_minutes || 0
  const studyTimeVal = studyTimeMins > 0
    ? `${Math.floor(studyTimeMins / 60)}h ${studyTimeMins % 60}m`
    : null

  const perfVal = dashData?.performance_score !== null && dashData?.performance_score !== undefined
    ? `${Math.round(dashData.performance_score)}%`
    : null

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome Banner */}
      <section className="rounded-2xl border border-[#17221c]/15 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-mono text-xs font-bold tracking-widest text-[#4e6656] uppercase">
              Student Overview
            </span>
            <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#17221c]">
              Welcome back, {studentName}
            </h2>
            <p className="mt-2 text-sm text-[#405047] max-w-2xl leading-relaxed">
              Track your study behaviour, focus patterns, and learning performance. Telemetry and predictive models populate as you complete study sessions.
            </p>
          </div>

          <div className="flex flex-shrink-0 gap-2">
            <Link
              to="/app/student/sessions"
              className="inline-flex items-center gap-2 rounded-lg bg-[#17221c] px-4 py-2.5 font-mono text-xs font-bold tracking-wider text-[#f5f1e8] uppercase transition hover:bg-[#2b3a32]"
            >
              <Play size={14} fill="currentColor" />
              <span>Start Session</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Loading & Error States */}
      {loading && (
        <div className="flex items-center justify-center rounded-xl border border-[#17221c]/15 bg-white p-8">
          <RefreshCw className="mr-2 size-5 animate-spin text-[#4e6656]" />
          <span className="font-mono text-xs font-semibold text-[#4e6656]">Loading dashboard metrics...</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <div className="flex items-center gap-2 text-xs font-medium">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDashboard}
            className="rounded-md bg-red-100 px-3 py-1 font-mono text-xs font-bold hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary Metrics Cards */}
          <section aria-label="Key Performance Indicators">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                title="Focus Score"
                icon={Orbit}
                value={focusScoreVal}
                status={focusScoreVal ? "AI Model Prediction" : "No study data yet"}
                description="AI Regressor prediction derived from session attention stability."
              />

              <SummaryCard
                title="Distraction Level"
                icon={AlertTriangle}
                value={distractionVal}
                status={distractionVal ? "AI Classifier Output" : "Not evaluated yet"}
                description="AI Classifier output derived from context switches and non-productive ratio."
              />

              <SummaryCard
                title="Study Time"
                icon={Clock}
                value={studyTimeVal}
                status={studyTimeVal ? "Verified Telemetry" : "0 hrs recorded"}
                description="Cumulative verified study intervals recorded within the application."
              />

              <SummaryCard
                title="Performance"
                icon={TrendingUp}
                value={perfVal}
                status={perfVal ? "AI Regressor Estimate" : "No assessment yet"}
                description="AI Regressor estimate derived from session telemetry and quiz baseline."
              />
            </div>
          </section>

          {/* Quick Actions Strip */}
          <section aria-label="Quick Actions">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Link
                to="/app/student/sessions"
                className="flex items-center gap-3.5 rounded-xl border border-[#17221c]/15 bg-white p-4 transition hover:border-[#17221c]/40 hover:bg-[#fbf9f4]"
              >
                <div className="grid size-10 place-items-center rounded-lg bg-[#d7e65a] text-[#17221c]">
                  <Clock size={18} strokeWidth={2.2} />
                </div>
                <div>
                  <span className="block font-serif text-sm font-bold text-[#17221c]">
                    Study Sessions
                  </span>
                  <span className="block text-xs text-[#405047]">Record interval telemetry</span>
                </div>
              </Link>

              <Link
                to="/app/student/behaviour"
                className="flex items-center gap-3.5 rounded-xl border border-[#17221c]/15 bg-white p-4 transition hover:border-[#17221c]/40 hover:bg-[#fbf9f4]"
              >
                <div className="grid size-10 place-items-center rounded-lg bg-[#f5f1e8] text-[#17221c]">
                  <Activity size={18} strokeWidth={2.2} />
                </div>
                <div>
                  <span className="block font-serif text-sm font-bold text-[#17221c]">
                    Behaviour Analysis
                  </span>
                  <span className="block text-xs text-[#405047]">Real ML model predictions</span>
                </div>
              </Link>

              <Link
                to="/app/student/performance"
                className="flex items-center gap-3.5 rounded-xl border border-[#17221c]/15 bg-white p-4 transition hover:border-[#17221c]/40 hover:bg-[#fbf9f4]"
              >
                <div className="grid size-10 place-items-center rounded-lg bg-[#f5f1e8] text-[#17221c]">
                  <GraduationCap size={18} strokeWidth={2.2} />
                </div>
                <div>
                  <span className="block font-serif text-sm font-bold text-[#17221c]">
                    Subject Performance
                  </span>
                  <span className="block text-xs text-[#405047]">Quiz correlations & progress</span>
                </div>
              </Link>
            </div>
          </section>

          {/* Main Analysis Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Focus Overview */}
            <SectionCard
              title="Focus Overview"
              subtitle="Session attention trajectories and stability"
              icon={Compass}
            >
              <EmptyState
                icon={Orbit}
                title="No focus data available yet"
                description="Start a study session to record window activity, interruption frequency, and compute your baseline focus score."
                actionText="Go to Study Sessions"
                actionLink="/app/student/sessions"
              />
            </SectionCard>

            {/* AI Recommendations */}
            <SectionCard
              title="AI Recommendations"
              subtitle="Adaptive interventions and habit suggestions"
              icon={Sparkles}
            >
              <EmptyState
                icon={Sparkles}
                title="No recommendations generated yet"
                description="Recommendations appear after behavioural patterns and focus stability are established across multiple sessions."
              />
            </SectionCard>

            {/* Recent Study Activity */}
            <SectionCard
              title="Recent Study Activity"
              subtitle="Application usage and event timeline"
              icon={Activity}
            >
              {dashData?.recent_activity && dashData.recent_activity.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-[#17221c]/10 bg-white">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-[#fbf9f4] text-[#4e6656] uppercase border-b border-[#17221c]/10">
                      <tr>
                        <th className="px-3 py-2 font-bold">Activity</th>
                        <th className="px-3 py-2 font-bold">Duration</th>
                        <th className="px-3 py-2 font-bold">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#17221c]/10">
                      {dashData.recent_activity.map((act) => (
                        <tr key={act.activity_id}>
                          <td className="px-3 py-2 font-semibold text-[#17221c]">{act.activity_type}</td>
                          <td className="px-3 py-2 text-[#405047]">{Math.round((act.duration_seconds || 0) / 60)} mins</td>
                          <td className="px-3 py-2 text-[#405047]">{new Date(act.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={Clock}
                  title="No study activity recorded yet"
                  description="Active window titles, category tags, and duration telemetry will list here."
                />
              )}
            </SectionCard>

            {/* Subject Performance */}
            <SectionCard
              title="Subject Performance"
              subtitle="Curriculum mastery vs focus correlations"
              icon={GraduationCap}
            >
              {dashData?.subject_performance && dashData.subject_performance.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-[#17221c]/10 bg-white">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-[#fbf9f4] text-[#4e6656] uppercase border-b border-[#17221c]/10">
                      <tr>
                        <th className="px-3 py-2 font-bold">Subject</th>
                        <th className="px-3 py-2 font-bold">Average Score</th>
                        <th className="px-3 py-2 font-bold">Quizzes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#17221c]/10">
                      {dashData.subject_performance.map((sp) => (
                        <tr key={sp.subject_id}>
                          <td className="px-3 py-2 font-semibold text-[#17221c]">{sp.subject_name}</td>
                          <td className="px-3 py-2 font-bold text-emerald-800">{sp.average_score !== null ? `${sp.average_score}%` : '—'}</td>
                          <td className="px-3 py-2 text-[#405047]">{sp.total_quizzes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={Brain}
                  title="No subject assessment data"
                  description="Analysis will correlate quiz results with recorded focus patterns to highlight subjects needing targeted revision."
                />
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  )
}
