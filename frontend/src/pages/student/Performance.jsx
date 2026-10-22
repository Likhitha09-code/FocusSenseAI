import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  GraduationCap,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import { SectionCard } from '../../components/dashboard/SectionCard'
import { EmptyState } from '../../components/dashboard/EmptyState'
import {
  getStudentBehaviour,
  getStudentDashboard,
  getStudentPerformance,
  getStudentQuizzes,
} from '../../lib/api'

function PerformanceChartTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-2.5 shadow-md font-mono text-xs text-[var(--text-primary)]">
        <p className="font-semibold text-[var(--text-secondary)] mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p
            key={`tooltip-${index}`}
            className="flex items-center gap-1.5 font-bold"
            style={{ color: entry.color }}
          >
            <span>{entry.name}:</span>
            <span>{entry.value}%</span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function Performance() {
  const { isDark } = useTheme()
  const [analyses, setAnalyses] = useState([])
  const [reports, setReports] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [behData, perfData, dashData, quizData] = await Promise.all([
        getStudentBehaviour({ limit: 10 }).catch(() => []),
        getStudentPerformance({ limit: 20 }).catch(() => []),
        getStudentDashboard().catch(() => null),
        getStudentQuizzes().catch(() => []),
      ])
      setAnalyses(Array.isArray(behData) ? behData : [])
      setReports(Array.isArray(perfData) ? perfData : [])
      setDashboardData(dashData)
      setQuizzes(Array.isArray(quizData) ? quizData : [])
    } catch (err) {
      console.error('Failed to load performance data:', err)
      setError('Unable to load performance analytics. Please check network connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    async function initialFetch() {
      try {
        const [behData, perfData, dashData, quizData] = await Promise.all([
          getStudentBehaviour({ limit: 10 }).catch(() => []),
          getStudentPerformance({ limit: 20 }).catch(() => []),
          getStudentDashboard().catch(() => null),
          getStudentQuizzes().catch(() => []),
        ])
        if (!ignore) {
          setAnalyses(Array.isArray(behData) ? behData : [])
          setReports(Array.isArray(perfData) ? perfData : [])
          setDashboardData(dashData)
          setQuizzes(Array.isArray(quizData) ? quizData : [])
          setLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load performance data:', err)
          setError('Unable to load performance analytics. Please check network connection.')
          setLoading(false)
        }
      }
    }
    initialFetch()
    return () => {
      ignore = true
    }
  }, [])

  const latestAnalysis = analyses.length > 0 ? analyses[0] : null

  // Subject Performance Data
  const subjectPerformanceList = dashboardData?.subject_performance || []
  const evaluatedSubjects = subjectPerformanceList.filter(
    (sp) => sp.average_score !== null && sp.average_score !== undefined
  )

  // Determine Strongest and Weakest: prefer quiz scores if >= 2 evaluated, else fallback to focus score
  const hasRelativeComparison = evaluatedSubjects.length >= 2
  const subjectsWithFocus = subjectPerformanceList.filter(
    (sp) => sp.average_focus_score !== null && sp.average_focus_score !== undefined
  )
  const hasFocusComparison = !hasRelativeComparison && subjectsWithFocus.length >= 2

  let strongestSubject = null
  let weakestSubject = null
  let comparisonMetricLabel = 'Average Quiz Score'

  if (hasRelativeComparison) {
    const sorted = [...evaluatedSubjects].sort((a, b) => (b.average_score || 0) - (a.average_score || 0))
    strongestSubject = sorted[0]
    weakestSubject = sorted[sorted.length - 1]
    comparisonMetricLabel = 'Average Quiz Score'
  } else if (hasFocusComparison) {
    const sorted = [...subjectsWithFocus].sort(
      (a, b) => (b.average_focus_score || 0) - (a.average_focus_score || 0)
    )
    strongestSubject = sorted[0]
    weakestSubject = sorted[sorted.length - 1]
    comparisonMetricLabel = 'Study Focus Stability'
  }

  // Combined assessments list (performance reports + quizzes)
  const combinedAssessments = [
    ...reports.map((r) => ({
      id: r.id,
      title: r.performance_metric,
      type: 'Performance Report',
      score: r.score != null ? `${r.score}` : '—',
      maxScore: r.max_score != null ? `${r.max_score}` : '100',
      date: r.measured_at,
    })),
    ...quizzes.map((q) => {
      const subj = subjectPerformanceList.find((s) => s.subject_id === q.subject_id)
      return {
        id: q.id,
        title: q.title,
        type: `Quiz Assessment (${subj?.subject_name || 'Subject'})`,
        score: 'Recorded',
        maxScore: 'N/A',
        date: q.quiz_date || q.created_at,
      }
    }),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

  // Chart data for subject performance
  const chartData = evaluatedSubjects.map((sp) => ({
    name: sp.subject_name.length > 14 ? `${sp.subject_name.slice(0, 12)}...` : sp.subject_name,
    fullName: sp.subject_name,
    score: Math.round(sp.average_score),
    quizzes: sp.total_quizzes,
  }))

  const gridColor = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.08)'
  const axisColor = isDark ? '#94a3b8' : '#64748b'
  const barColor = isDark ? '#818cf8' : '#6366f1'

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-[var(--shadow-card)]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-0.5 font-mono text-[11px] font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
          Academic Correlation & Mastery
        </span>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Performance Analytics & AI Grade Prediction
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
          Correlate your measured study patterns with academic outcomes and AI regressor
          predictions to identify study habits that maximize score retention.
        </p>
      </section>

      {/* Loading Skeletons */}
      {loading && (
        <div className="flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10">
          <RefreshCw className="mr-2.5 size-5 animate-spin text-[var(--accent-primary)]" />
          <span className="font-mono text-xs font-semibold text-[var(--text-secondary)]">
            Loading performance analytics...
          </span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--status-danger)]/40 bg-[var(--status-danger)]/10 p-4 text-[var(--text-primary)]">
          <div className="flex items-center gap-2 text-xs font-medium">
            <AlertCircle size={16} className="text-[var(--status-danger)] shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1 font-mono text-xs font-bold hover:border-[var(--border-strong)]"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {/* AI Predicted Performance Card */}
          <SectionCard
            title="AI Predicted Performance Score"
            subtitle="Gradient Boosting Regressor estimate derived from session telemetry and quiz indicators"
            icon={Brain}
          >
            {latestAnalysis && latestAnalysis.performance_prediction !== null ? (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 text-center space-y-4">
                <div>
                  <span className="inline-block rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1 font-mono text-xs font-bold text-[var(--accent-primary)] uppercase tracking-wider">
                    AI Regressor Model Prediction
                  </span>
                  <div className="mt-3 text-4xl sm:text-5xl font-extrabold text-[var(--text-primary)] tracking-tight">
                    {latestAnalysis.performance_prediction}%
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                    Estimated academic performance capacity based on your session telemetry and
                    historical quiz baseline.
                  </p>
                </div>

                {/* Observed Telemetry Inputs Used by Model */}
                {latestAnalysis.feature_snapshot && (
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-left">
                    <div className="font-mono text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-2.5">
                      Observed Feature Inputs (Model Telemetry Context)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                      <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5 border border-[var(--border-subtle)]">
                        <span className="text-[var(--text-secondary)] block text-[10px] uppercase font-semibold">
                          Productive Ratio
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {Math.round(
                            (latestAnalysis.feature_snapshot.productive_activity_ratio || 0) * 100
                          )}
                          %
                        </span>
                      </div>
                      <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5 border border-[var(--border-subtle)]">
                        <span className="text-[var(--text-secondary)] block text-[10px] uppercase font-semibold">
                          Distraction Ratio
                        </span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                          {Math.round(
                            (latestAnalysis.feature_snapshot.distraction_activity_ratio || 0) * 100
                          )}
                          %
                        </span>
                      </div>
                      <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5 border border-[var(--border-subtle)]">
                        <span className="text-[var(--text-secondary)] block text-[10px] uppercase font-semibold">
                          Context Switches
                        </span>
                        <span className="font-bold text-[var(--text-primary)] text-sm">
                          {latestAnalysis.feature_snapshot.activity_switch_count ?? 0}
                        </span>
                      </div>
                      <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5 border border-[var(--border-subtle)]">
                        <span className="text-[var(--text-secondary)] block text-[10px] uppercase font-semibold">
                          Quiz Baseline
                        </span>
                        <span className="font-bold text-[var(--text-primary)] text-sm">
                          {latestAnalysis.feature_snapshot.quiz_score !== null &&
                          latestAnalysis.feature_snapshot.quiz_score !== undefined
                            ? `${latestAnalysis.feature_snapshot.quiz_score}%`
                            : 'Median Imputed'}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2.5 text-[10px] text-[var(--text-muted)] italic">
                      Note: These observed feature metrics represent model inputs and statistical
                      associations, not direct causal guarantees.
                    </p>
                  </div>
                )}

                <div className="inline-flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1 font-mono text-[11px] font-semibold text-[var(--text-secondary)] uppercase">
                  <span>Model: {latestAnalysis.model_version || 'v1.0'}</span>
                  <span>•</span>
                  <span>
                    Analyzed: {new Date(latestAnalysis.analyzed_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Brain}
                title="Not enough activity data for AI performance prediction"
                description="Record study session activity and complete quizzes. The AI regression model will predict your academic performance trajectory."
              />
            )}
          </SectionCard>

          {/* Subject Mastery & Relative Strengths Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Subject Mastery Bar Chart */}
            <SectionCard
              title="Subject Mastery Overview"
              subtitle="Average quiz performance across evaluated curriculum subjects"
              icon={BookOpen}
            >
              {chartData.length > 0 ? (
                <div className="space-y-4">
                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
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
                        <Tooltip content={<PerformanceChartTooltip />} />
                        <Bar
                          dataKey="score"
                          name="Average Score"
                          fill={barColor}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    {evaluatedSubjects.map((sp) => (
                      <div
                        key={sp.subject_id}
                        className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-[var(--text-primary)] block truncate">
                            {sp.subject_name}
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            {sp.total_quizzes} quiz{sp.total_quizzes !== 1 ? 'zes' : ''} completed
                          </span>
                        </div>
                        <span className="font-bold text-sm text-[var(--accent-primary)]">
                          {Math.round(sp.average_score)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : subjectPerformanceList.length > 0 ? (
                <div className="space-y-3 font-mono text-xs">
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs text-[var(--text-secondary)] leading-relaxed">
                    <p className="font-semibold text-[var(--text-primary)] mb-1">
                      Enrolled Curriculum Subjects ({subjectPerformanceList.length})
                    </p>
                    Showing verified study session metrics. Formal quiz score averages will render once assessments are recorded.
                  </div>
                  {subjectPerformanceList.map((sp) => (
                    <div
                      key={sp.subject_id}
                      className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-[var(--text-primary)] block truncate">
                          {sp.subject_name}
                        </span>
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          {sp.total_sessions || 0} session{(sp.total_sessions || 0) !== 1 ? 's' : ''} • {sp.total_study_minutes || 0} mins logged
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-xs text-[var(--accent-primary)] block">
                          {sp.average_focus_score != null ? `${sp.average_focus_score} Focus` : 'Focus Pending'}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">Quiz Pending</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="No subjects evaluated"
                  description="Enrolled subjects and quiz score averages will be visualized here as assessments are recorded."
                />
              )}
            </SectionCard>

            {/* Relative Focus & Mastery Diagnostic */}
            <SectionCard
              title="Curriculum Diagnostics"
              subtitle="Comparative strength and priority revision analysis"
              icon={Award}
            >
              {hasRelativeComparison || hasFocusComparison ? (
                <div className="space-y-4">
                  {/* Strongest Subject Card */}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                        <TrendingUp size={14} />
                        <span>Highest Performing Subject ({comparisonMetricLabel})</span>
                      </span>
                      <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {hasRelativeComparison
                          ? `${Math.round(strongestSubject.average_score)}%`
                          : `${strongestSubject.average_focus_score} pts`}
                      </span>
                    </div>
                    <h4 className="mt-2 text-base font-bold text-[var(--text-primary)]">
                      {strongestSubject.subject_name}
                    </h4>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {hasRelativeComparison
                        ? `Strong retention demonstrated across ${strongestSubject.total_quizzes} quiz evaluations.`
                        : `Higher relative focus stability observed across ${strongestSubject.total_sessions} study sessions.`}
                    </p>
                  </div>

                  {/* Weakest / Focus Needed Card */}
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">
                        <TrendingDown size={14} />
                        <span>Needs Focus & Revision ({comparisonMetricLabel})</span>
                      </span>
                      <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                        {hasRelativeComparison
                          ? `${Math.round(weakestSubject.average_score)}%`
                          : `${weakestSubject.average_focus_score} pts`}
                      </span>
                    </div>
                    <h4 className="mt-2 text-base font-bold text-[var(--text-primary)]">
                      {weakestSubject.subject_name}
                    </h4>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      Lower relative score retention. Targeted revision and focused session
                      intervals recommended.
                    </p>
                  </div>
                </div>
              ) : evaluatedSubjects.length === 1 || subjectsWithFocus.length === 1 ? (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 text-center space-y-2">
                  <CheckCircle2 size={24} className="mx-auto text-[var(--accent-primary)]" />
                  <h4 className="font-bold text-sm text-[var(--text-primary)]">
                    Single Subject Evaluated
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                    {(evaluatedSubjects[0] || subjectsWithFocus[0]).subject_name} has data recorded.
                    Relative strength and priority comparison requires at least 2 evaluated
                    subjects.
                  </p>
                </div>
              ) : (
                <EmptyState
                  icon={Award}
                  title="Comparative diagnostics unavailable"
                  description="Complete quizzes or study sessions across 2 or more subjects to evaluate relative strengths and identify areas requiring targeted study sessions."
                />
              )}
            </SectionCard>
          </div>

          {/* Performance Assessment History */}
          <SectionCard
            title="Performance Assessment History"
            subtitle="Historical quiz evaluations and logged assessment metrics"
            icon={GraduationCap}
          >
            {combinedAssessments.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] uppercase">
                    <tr>
                      <th className="px-4 py-2.5 font-bold">Metric / Assessment</th>
                      <th className="px-4 py-2.5 font-bold">Type</th>
                      <th className="px-4 py-2.5 font-bold">Score</th>
                      <th className="px-4 py-2.5 font-bold">Max Scale</th>
                      <th className="px-4 py-2.5 font-bold">Recorded Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {combinedAssessments.map((rep) => (
                      <tr key={rep.id} className="hover:bg-[var(--bg-elevated)]/60 transition">
                        <td className="px-4 py-2.5 font-semibold text-[var(--text-primary)]">
                          {rep.title}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                          {rep.type}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-emerald-600 dark:text-emerald-400">
                          {rep.score}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                          {rep.maxScore}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                          {rep.date ? new Date(rep.date).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={GraduationCap}
                title="No assessment reports recorded yet"
                description="Reports capturing average focus, quiz scores, and performance tiers will list chronologically as academic assessments are completed."
              />
            )}
          </SectionCard>
        </div>
      )}
    </div>
  )
}
