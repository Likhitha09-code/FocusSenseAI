import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  X,
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
  createStudentPerformance,
  createStudentQuiz,
  createStudentSubject,
  getStudentBehaviour,
  getStudentDashboard,
  getStudentPerformance,
  getStudentQuizzes,
  getStudentSubjects,
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
  const [subjects, setSubjects] = useState([])
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Assessment modal & form state
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSubjectId, setFormSubjectId] = useState('')
  const [newSubjectName, setNewSubjectName] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formScore, setFormScore] = useState('')
  const [formMaxScore, setFormMaxScore] = useState('100')
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [behData, perfData, dashData, quizData, subjData] = await Promise.all([
        getStudentBehaviour({ limit: 10 }).catch(() => []),
        getStudentPerformance({ limit: 50 }),
        getStudentDashboard().catch(() => null),
        getStudentQuizzes(),
        getStudentSubjects().catch(() => []),
      ])
      setAnalyses(Array.isArray(behData) ? behData : [])
      setReports(Array.isArray(perfData) ? perfData : [])
      setDashboardData(dashData)
      setQuizzes(Array.isArray(quizData) ? quizData : [])
      setSubjects(Array.isArray(subjData) ? subjData : [])
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
        const [behData, perfData, dashData, quizData, subjData] = await Promise.all([
          getStudentBehaviour({ limit: 10 }).catch(() => []),
          getStudentPerformance({ limit: 50 }),
          getStudentDashboard().catch(() => null),
          getStudentQuizzes(),
          getStudentSubjects().catch(() => []),
        ])
        if (!ignore) {
          setAnalyses(Array.isArray(behData) ? behData : [])
          setReports(Array.isArray(perfData) ? perfData : [])
          setDashboardData(dashData)
          setQuizzes(Array.isArray(quizData) ? quizData : [])
          setSubjects(Array.isArray(subjData) ? subjData : [])
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

  const handleRecordAssessment = async (e) => {
    e.preventDefault()
    setFormError('')

    const parsedScore = parseFloat(formScore)
    const parsedMax = parseFloat(formMaxScore) || 100.0

    if (isNaN(parsedScore) || parsedScore < 0) {
      setFormError('Please enter a valid non-negative score.')
      return
    }
    if (parsedScore > parsedMax) {
      setFormError(`Score (${parsedScore}) cannot exceed max scale (${parsedMax}).`)
      return
    }
    if (!formTitle.trim()) {
      setFormError('Please enter an assessment title.')
      return
    }

    setIsSubmitting(true)
    try {
      let resolvedSubjectId = formSubjectId

      if (formSubjectId === 'NEW_SUBJECT') {
        if (!newSubjectName.trim()) {
          setFormError('Please enter a name for the new curriculum subject.')
          setIsSubmitting(false)
          return
        }
        const createdSubj = await createStudentSubject({ name: newSubjectName.trim() })
        resolvedSubjectId = createdSubj.id
        setSubjects((prev) => [...prev, createdSubj])
      }

      if (resolvedSubjectId && resolvedSubjectId !== '') {
        await createStudentQuiz({
          subject_id: resolvedSubjectId,
          title: formTitle.trim(),
          quiz_date: formDate || undefined,
          score: parsedScore,
          max_score: parsedMax,
        })
      } else {
        await createStudentPerformance({
          performance_metric: formTitle.trim(),
          score: parsedScore,
          max_score: parsedMax,
          measured_at: formDate ? new Date(formDate).toISOString() : new Date().toISOString(),
        })
      }

      setFormTitle('')
      setFormScore('')
      setFormMaxScore('100')
      setFormSubjectId('')
      setNewSubjectName('')
      setShowAddModal(false)
      await loadData()
    } catch (err) {
      console.error('Failed to record assessment:', err)
      const detail = err.response?.data?.detail
      setFormError(
        typeof detail === 'string'
          ? detail
          : 'Failed to record assessment. Please check input values.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

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

  // Combined assessments list (deduplicating linked reports and quizzes)
  const linkedQuizIds = new Set(reports.map((r) => r.quiz_id).filter(Boolean))

  const combinedAssessments = [
    ...reports.map((r) => {
      let subjName = r.subject_name
      if (!subjName && r.quiz_id) {
        const q = quizzes.find((qz) => qz.id === r.quiz_id)
        if (q) {
          const s =
            subjects.find((sb) => sb.id === q.subject_id) ||
            subjectPerformanceList.find((sp) => sp.subject_id === q.subject_id)
          subjName = s?.name || s?.subject_name
        }
      }
      return {
        id: r.id,
        title: r.performance_metric,
        type: subjName ? `Quiz Assessment (${subjName})` : 'Performance Report',
        score: r.score != null ? `${r.score}` : '—',
        maxScore: r.max_score != null ? `${r.max_score}` : '100',
        date: r.measured_at,
      }
    }),
    ...quizzes
      .filter((q) => !linkedQuizIds.has(q.id))
      .map((q) => {
        const subj =
          subjects.find((s) => s.id === q.subject_id) ||
          subjectPerformanceList.find((s) => s.subject_id === q.subject_id)
        const sName = subj?.name || subj?.subject_name || 'Subject'
        return {
          id: q.id,
          title: q.title,
          type: `Quiz Assessment (${sName})`,
          score: q.score != null ? `${q.score}` : 'Recorded',
          maxScore: q.max_score != null ? `${q.max_score}` : (q.score != null ? '100' : 'N/A'),
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
            action={
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(true)
                  setFormError('')
                }}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 font-mono text-xs font-semibold text-white shadow-sm hover:opacity-90 transition"
              >
                <Plus size={14} />
                <span>Record Assessment</span>
              </button>
            }
          >
            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center space-y-3">
                <AlertCircle size={28} className="mx-auto text-red-500" />
                <h4 className="font-bold text-sm text-[var(--text-primary)]">
                  Unable to load assessment history
                </h4>
                <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">{error}</p>
                <button
                  type="button"
                  onClick={loadData}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 font-mono text-xs font-semibold text-white hover:opacity-90"
                >
                  <RefreshCw size={13} /> Retry
                </button>
              </div>
            ) : combinedAssessments.length > 0 ? (
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
                actionLabel="Record Your First Assessment"
                onAction={() => {
                  setShowAddModal(true)
                  setFormError('')
                }}
              />
            )}
          </SectionCard>
        </div>
      )}

      {/* Record Assessment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="text-[var(--accent-primary)]" size={20} />
                <h3 className="font-bold text-base text-[var(--text-primary)]">
                  Record Academic Assessment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false)
                  setFormError('')
                }}
                className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 font-mono text-xs text-red-600 dark:text-red-400">
                <AlertCircle size={15} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRecordAssessment} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Curriculum Subject
                </label>
                <select
                  value={formSubjectId}
                  onChange={(e) => setFormSubjectId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                >
                  <option value="">General Assessment (No Subject)</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                  <option value="NEW_SUBJECT">+ Add New Subject...</option>
                </select>
              </div>

              {formSubjectId === 'NEW_SUBJECT' && (
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    New Subject Name
                  </label>
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="e.g. Distributed Systems, Calculus"
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Assessment / Quiz Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Midterm Quiz 1, Weekly Lab Test"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Score Achieved
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formScore}
                    onChange={(e) => setFormScore(e.target.value)}
                    placeholder="e.g. 85"
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Max Scale
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={formMaxScore}
                    onChange={(e) => setFormMaxScore(e.target.value)}
                    placeholder="100"
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Assessment Date
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setFormError('')
                  }}
                  className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-4 py-2 font-semibold text-white shadow hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Assessment</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
