import { useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  Brain,
  Calendar,
  Clock,
  Info,
  Layers,
  Link as LinkIcon,
  Orbit,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  Tag,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import { SectionCard } from '../../components/dashboard/SectionCard'
import { EmptyState } from '../../components/dashboard/EmptyState'
import { getStudentBehaviour, simulateCounterfactual } from '../../lib/api'

function BehaviourChartTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-2.5 shadow-md font-mono text-xs text-[var(--text-primary)]">
        <p className="font-semibold text-[var(--text-secondary)] mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p
            key={`tooltip-${index}`}
            className="flex items-center gap-2 font-bold"
            style={{ color: entry.color }}
          >
            <span>{entry.name}:</span>
            <span>{entry.value}</span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

function ShapChartTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const isPositive = Number(data.attribution) >= 0
    return (
      <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3 shadow-md font-mono text-xs text-[var(--text-primary)] max-w-xs">
        <p className="font-bold text-[var(--accent-primary)] mb-1">{data.displayName}</p>
        <p className="text-[var(--text-secondary)] mb-1.5">
          Observed Value:{' '}
          <span className="font-semibold text-[var(--text-primary)]">{data.formattedValue}</span>
        </p>
        <div className="flex items-center gap-1.5 pt-1.5 border-t border-[var(--border-subtle)] font-bold">
          <span className={isPositive ? 'text-emerald-500' : 'text-red-500'}>
            {isPositive ? '+' : ''}
            {data.attribution} pts
          </span>
          <span className="text-[10px] text-[var(--text-secondary)] font-normal">
            ({isPositive ? 'increases focus score' : 'decreases focus score'})
          </span>
        </div>
      </div>
    )
  }
  return null
}

export function Behaviour() {
  const { isDark } = useTheme()
  const [analyses, setAnalyses] = useState([])
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Task 17 Counterfactual Simulation State
  const [simInputs, setSimInputs] = useState({
    productiveMinutes: 0,
    distractionMinutes: 0,
    breakMinutes: 0,
    activitySwitchCount: 0,
    uniqueApplicationCount: 1,
  })
  const [simResult, setSimResult] = useState(null)
  const [simLoading, setSimLoading] = useState(false)
  const [simError, setSimError] = useState(null)

  const syncSimInputsFromAnalysis = (analysis) => {
    const snap = analysis?.feature_snapshot || {}
    setSimInputs({
      productiveMinutes: Math.round(((snap.productive_duration || 0) / 60) * 10) / 10,
      distractionMinutes: Math.round(((snap.distraction_duration || 0) / 60) * 10) / 10,
      breakMinutes: Math.round(((snap.break_duration || 0) / 60) * 10) / 10,
      activitySwitchCount: Number(snap.activity_switch_count || 0),
      uniqueApplicationCount: Math.max(1, Number(snap.unique_application_count || 1)),
    })
    setSimResult(null)
    setSimError(null)
  }

  const fetchBehaviour = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getStudentBehaviour({ limit: 20 })
      const items = Array.isArray(data) ? data : []
      setAnalyses(items)
      if (items.length > 0) {
        setSelectedAnalysisId(items[0].id)
        syncSimInputsFromAnalysis(items[0])
      }
    } catch (err) {
      console.error('Failed to fetch behavioural analysis:', err)
      setError(
        'Unable to load behavioural analysis. Please check network connection and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    async function initialFetch() {
      try {
        const data = await getStudentBehaviour({ limit: 20 })
        if (!ignore) {
          const items = Array.isArray(data) ? data : []
          setAnalyses(items)
          if (items.length > 0) {
            setSelectedAnalysisId(items[0].id)
            syncSimInputsFromAnalysis(items[0])
          }
          setLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to fetch behavioural analysis:', err)
          setError(
            'Unable to load behavioural analysis. Please check network connection and try again.'
          )
          setLoading(false)
        }
      }
    }
    initialFetch()
    return () => {
      ignore = true
    }
  }, [])

  const latestAnalysis =
    analyses.find((a) => a.id === selectedAnalysisId) || (analyses.length > 0 ? analyses[0] : null)
  const features = latestAnalysis?.feature_snapshot || {}

  const handleSelectAnalysis = (analysisId) => {
    setSelectedAnalysisId(analysisId)
    const found = analyses.find((a) => a.id === analysisId)
    if (found) {
      syncSimInputsFromAnalysis(found)
    }
  }

  const handleResetSimulation = () => {
    if (latestAnalysis) {
      syncSimInputsFromAnalysis(latestAnalysis)
    }
  }

  const handleRunSimulation = async (e) => {
    e.preventDefault()
    if (!latestAnalysis) return
    setSimLoading(true)
    setSimError(null)
    try {
      const payload = {
        analysis_id: latestAnalysis.id,
        productive_duration: Math.max(0, Number(simInputs.productiveMinutes) * 60),
        distraction_duration: Math.max(0, Number(simInputs.distractionMinutes) * 60),
        break_duration: Math.max(0, Number(simInputs.breakMinutes) * 60),
        activity_switch_count: Math.max(0, Math.round(Number(simInputs.activitySwitchCount))),
        unique_application_count: Math.max(1, Math.round(Number(simInputs.uniqueApplicationCount))),
      }
      const res = await simulateCounterfactual(payload)
      setSimResult(res)
    } catch (err) {
      console.error('Failed to run counterfactual simulation:', err)
      const detail = err?.response?.data?.detail
      setSimError(
        typeof detail === 'string'
          ? detail
          : 'Unable to run counterfactual simulation. Ensure total simulated session duration is greater than 0 minutes.'
      )
    } finally {
      setSimLoading(false)
    }
  }

  const getDistractionBadgeStyle = (level) => {
    switch ((level || '').toUpperCase()) {
      case 'LOW':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      case 'MEDIUM':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
      case 'HIGH':
        return 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
      default:
        return 'border-gray-500/30 bg-gray-500/10 text-gray-500'
    }
  }

  const getDeltaBadgeStyle = (delta) => {
    if (delta > 0)
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    if (delta < 0) return 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
    return 'border-gray-500/30 bg-gray-500/10 text-[var(--text-secondary)]'
  }

  const formatDelta = (delta, suffix = '') => {
    if (delta === undefined || delta === null) return '0'
    const sign = delta > 0 ? '+' : ''
    return `${sign}${delta}${suffix}`
  }

  const formatSeconds = (sec) => {
    if (sec === undefined || sec === null) return '—'
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    if (m === 0) return `${s}s`
    return `${m}m ${s}s`
  }

  // Chart time series from historical analyses (chronological order)
  const trendChartData = analyses
    .slice()
    .reverse()
    .map((item, idx) => {
      const snap = item.feature_snapshot || {}
      const dateStr = item.session_started_at || item.analyzed_at
      const dateLabel = dateStr
        ? new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : `Sess ${idx + 1}`
      return {
        name: dateLabel,
        focusScore: item.focus_score !== null ? Math.round(item.focus_score) : null,
        productiveRatio:
          snap.productive_activity_ratio !== undefined
            ? Math.round(snap.productive_activity_ratio * 100)
            : null,
        distractionRatio:
          snap.distraction_activity_ratio !== undefined
            ? Math.round(snap.distraction_activity_ratio * 100)
            : null,
      }
    })

  const gridColor = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.08)'
  const axisColor = isDark ? '#94a3b8' : '#64748b'
  const focusColor = isDark ? '#818cf8' : '#6366f1'
  const productiveColor = isDark ? '#34d399' : '#10b981'
  const distractionColor = isDark ? '#fbbf24' : '#f59e0b'

  const formatFeatureValue = (featureName, rawVal) => {
    if (rawVal === null || rawVal === undefined) return 'Unrecorded (Imputed)'
    if (featureName.includes('ratio')) return `${(rawVal * 100).toFixed(1)}%`
    if (featureName.includes('duration')) return formatSeconds(rawVal)
    if (featureName === 'quiz_score') return `${rawVal}%`
    if (featureName === 'activity_switch_count') return `${rawVal} switches`
    if (featureName === 'activity_count') return `${rawVal} activities`
    if (featureName === 'unique_application_count') return `${rawVal} apps`
    return String(rawVal)
  }

  const shapData = latestAnalysis?.shap_values
  const hasShap = Boolean(
    shapData &&
      Array.isArray(shapData.attributions) &&
      shapData.attributions.length > 0
  )

  const shapChartData = hasShap
    ? shapData.attributions.map((item) => ({
        name: item.display_name,
        attribution: item.attribution,
        featureName: item.feature_name,
        displayName: item.display_name,
        rawValue: item.feature_value,
        formattedValue: formatFeatureValue(item.feature_name, item.feature_value),
        impact: item.impact,
      }))
    : []

  const shapPositiveColor = isDark ? '#34d399' : '#10b981'
  const shapNegativeColor = isDark ? '#f87171' : '#ef4444'

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-[var(--shadow-card)]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-0.5 font-mono text-[11px] font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
          Student Insights & Behaviour Pipeline
        </span>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Behavioural Telemetry & AI Predictions
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
          Review observed study session measurements alongside AI model predictions. Telemetry
          features are aggregated deterministically from your session activity.
        </p>
      </section>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10">
          <RefreshCw className="mr-2.5 size-5 animate-spin text-[var(--accent-primary)]" />
          <span className="font-mono text-xs font-semibold text-[var(--text-secondary)]">
            Loading AI analysis flow...
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
            onClick={fetchBehaviour}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1 font-mono text-xs font-bold hover:border-[var(--border-strong)]"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {latestAnalysis ? (
            <div className="space-y-8">
              {/* Session-to-Analysis Linking Badge & Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-xs font-mono">
                <div className="flex flex-wrap items-center gap-2 text-[var(--text-primary)]">
                  <LinkIcon size={14} className="text-[var(--accent-primary)]" />
                  <span className="font-bold">Source Session:</span>
                  {analyses.length > 1 ? (
                    <select
                      aria-label="Select analyzed study session"
                      value={latestAnalysis.id}
                      onChange={(e) => handleSelectAnalysis(e.target.value)}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    >
                      {analyses.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.subject_name ? `${item.subject_name} — ` : ''}
                          {item.study_session_id.slice(0, 8)}... (
                          {formatSeconds(item.feature_snapshot?.total_session_duration)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{latestAnalysis.study_session_id}</span>
                  )}
                  {latestAnalysis.subject_name && (
                    <span className="rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-primary)] uppercase">
                      {latestAnalysis.subject_name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-[var(--text-secondary)]">
                  {latestAnalysis.session_started_at && (
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      <span>
                        Session: {new Date(latestAnalysis.session_started_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} />
                    <span>
                      Analyzed:{' '}
                      {new Date(latestAnalysis.analyzed_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* --------------------------------------------------------------------------- */}
              {/* SECTION 1: OBSERVED BEHAVIOUR (TELEMETRY MEASUREMENTS) */}
              {/* --------------------------------------------------------------------------- */}
              <SectionCard
                title="1. Observed Behaviour (Session Telemetry)"
                subtitle="Measured session statistics collected deterministically prior to model execution"
                icon={Layers}
              >
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 font-mono text-xs">
                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3.5 border border-[var(--border-subtle)]">
                    <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      Total Duration
                    </span>
                    <span className="block text-lg font-bold text-[var(--text-primary)]">
                      {formatSeconds(features.total_session_duration)}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3.5 border border-[var(--border-subtle)]">
                    <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      Productive Time
                    </span>
                    <span className="block text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {formatSeconds(features.productive_duration)}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {features.productive_activity_ratio !== undefined
                        ? `(${(features.productive_activity_ratio * 100).toFixed(1)}% ratio)`
                        : ''}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3.5 border border-[var(--border-subtle)]">
                    <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      Distraction Time
                    </span>
                    <span className="block text-lg font-bold text-amber-600 dark:text-amber-400">
                      {formatSeconds(features.distraction_duration)}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {features.distraction_activity_ratio !== undefined
                        ? `(${(features.distraction_activity_ratio * 100).toFixed(1)}% ratio)`
                        : ''}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3.5 border border-[var(--border-subtle)]">
                    <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      Break Time
                    </span>
                    <span className="block text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formatSeconds(features.break_duration)}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3.5 border border-[var(--border-subtle)]">
                    <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      Activity Switches
                    </span>
                    <span className="block text-lg font-bold text-[var(--text-primary)]">
                      {features.activity_switch_count ?? '—'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3.5 border border-[var(--border-subtle)]">
                    <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      Recorded Activities
                    </span>
                    <span className="block text-lg font-bold text-[var(--text-primary)]">
                      {features.activity_count ?? '—'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3.5 border border-[var(--border-subtle)]">
                    <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      Unique Applications
                    </span>
                    <span className="block text-lg font-bold text-[var(--text-primary)]">
                      {features.unique_application_count ?? '—'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3.5 border border-[var(--border-subtle)]">
                    <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      Enriched Quiz Score
                    </span>
                    <span className="block text-lg font-bold text-[var(--text-primary)]">
                      {features.quiz_score !== null && features.quiz_score !== undefined
                        ? `${features.quiz_score}%`
                        : 'Unrecorded (Imputed)'}
                    </span>
                  </div>
                </div>
              </SectionCard>

              {/* --------------------------------------------------------------------------- */}
              {/* SECTION 2: AI INSIGHTS & PREDICTIONS */}
              {/* --------------------------------------------------------------------------- */}
              <SectionCard
                title="2. AI Insights & Predictions"
                subtitle="Scikit-learn model predictions generated from observed feature inputs"
                icon={Sparkles}
              >
                <div className="space-y-4">
                  {/* Label Header */}
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-[var(--accent-primary)]" />
                      <span className="font-mono text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        AI-generated predictions
                      </span>
                    </div>
                    <span className="rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[var(--accent-primary)]">
                      Model Pipeline {latestAnalysis.model_version || 'v1.0'}
                    </span>
                  </div>

                  {/* AI Prediction Cards Grid */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {/* Focus Score Model Prediction */}
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                          AI Focus Score
                        </span>
                        <div className="grid size-8 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--accent-primary)]">
                          <Orbit size={18} />
                        </div>
                      </div>
                      <div className="mt-3 text-3xl font-bold text-[var(--text-primary)]">
                        {latestAnalysis.focus_score !== null
                          ? `${latestAnalysis.focus_score} / 100`
                          : '—'}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        RandomForestRegressor estimate based on productive ratio & switch telemetry.
                      </p>
                      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-[var(--text-secondary)]">
                        <span>Model: {latestAnalysis.model_version || 'v1.0'}</span>
                        <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                          AI Predicted
                        </span>
                      </div>
                    </div>

                    {/* Distraction Level Model Classification */}
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                          AI Distraction Level
                        </span>
                        <div className="grid size-8 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--accent-primary)]">
                          <Activity size={18} />
                        </div>
                      </div>
                      <div className="mt-3">
                        {latestAnalysis.distraction_level ? (
                          <span
                            className={`inline-block rounded-md border px-3 py-1 font-mono text-base font-bold uppercase ${getDistractionBadgeStyle(
                              latestAnalysis.distraction_level
                            )}`}
                          >
                            {latestAnalysis.distraction_level}
                          </span>
                        ) : (
                          <span className="text-xl text-[var(--text-muted)]">—</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        RandomForestClassifier rating derived from distraction ratio & window
                        switching.
                      </p>
                      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-[var(--text-secondary)]">
                        <span>Model: {latestAnalysis.model_version || 'v1.0'}</span>
                        <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                          AI Classifier
                        </span>
                      </div>
                    </div>

                    {/* Performance Model Prediction */}
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                          AI Performance Score
                        </span>
                        <div className="grid size-8 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--accent-primary)]">
                          <Brain size={18} />
                        </div>
                      </div>
                      <div className="mt-3 text-3xl font-bold text-[var(--text-primary)]">
                        {latestAnalysis.performance_prediction !== null
                          ? `${latestAnalysis.performance_prediction}%`
                          : '—'}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        GradientBoostingRegressor prediction derived from attention stability &
                        quiz history.
                      </p>
                      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-[var(--text-secondary)]">
                        <span>Model: {latestAnalysis.model_version || 'v1.0'}</span>
                        <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                          AI Regressor
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ethical & Development Disclaimer */}
                  <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-xs text-[var(--text-secondary)] flex items-start gap-2.5">
                    <AlertCircle
                      size={15}
                      className="mt-0.5 text-[var(--accent-primary)] shrink-0"
                    />
                    <div>
                      <span className="font-bold text-[var(--text-primary)]">
                        Development Initial Model Disclaimer:{' '}
                      </span>
                      AI predictions are generated by scikit-learn models trained on an initial
                      synthetic benchmark dataset. Predictions are provided for educational
                      reference only and are not clinically or academically validated ground truth.
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* --------------------------------------------------------------------------- */}
              {/* SECTION 3: FEATURE ATTRIBUTION (EXPLAINABLE AI / SHAP) */}
              {/* --------------------------------------------------------------------------- */}
              <SectionCard
                title="3. Feature Attribution (Explainable AI / SHAP)"
                subtitle="Examine how individual telemetry metrics increase or decrease your predicted focus score relative to the baseline"
                icon={Brain}
              >
                <div className="space-y-6">
                  {/* Explanation Status & Metadata Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-[var(--accent-primary)]" />
                      <span className="font-mono text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Feature Attribution Decomposition
                      </span>
                    </div>
                    {hasShap && (
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                        <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[var(--text-secondary)]">
                          Base: {shapData.base_value} pts
                        </span>
                        <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[var(--text-secondary)]">
                          Predicted: {shapData.prediction} pts
                        </span>
                        <span className="rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-0.5 font-bold text-[var(--accent-primary)] uppercase">
                          {shapData.method === 'shap_tree_explainer'
                            ? 'TreeExplainer SHAP'
                            : 'Tree Path SHAP'}
                        </span>
                      </div>
                    )}
                  </div>

                  {hasShap ? (
                    <>
                      {/* Plain-Language Explanation Callout Banner */}
                      {shapData.summary && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-4 text-xs text-[var(--text-primary)] leading-relaxed shadow-xs">
                          <Sparkles
                            size={16}
                            className="mt-0.5 text-[var(--accent-primary)] shrink-0"
                          />
                          <div>
                            <span className="font-mono font-bold uppercase text-[var(--accent-primary)] mr-1.5">
                              AI Explanation:
                            </span>
                            <span>{shapData.summary}</span>
                          </div>
                        </div>
                      )}

                      {/* Horizontal Attribution Bar Chart */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-mono text-xs text-[var(--text-secondary)]">
                          <span className="font-bold uppercase tracking-wider">
                            Attribution Impact by Feature (pts)
                          </span>
                          <div className="flex items-center gap-4 text-[11px]">
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block size-2.5 rounded-full bg-emerald-500" />
                              <span>Increases Focus (+)</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block size-2.5 rounded-full bg-red-500" />
                              <span>Decreases Focus (-)</span>
                            </span>
                          </div>
                        </div>

                        <div className="h-80 w-full pt-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              layout="vertical"
                              data={shapChartData}
                              margin={{ top: 8, right: 24, left: 24, bottom: 8 }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke={gridColor}
                                horizontal={false}
                              />
                              <XAxis
                                type="number"
                                stroke={axisColor}
                                fontSize={11}
                                fontFamily="monospace"
                                tickLine={false}
                                domain={['auto', 'auto']}
                              />
                              <YAxis
                                type="category"
                                dataKey="name"
                                stroke={axisColor}
                                fontSize={11}
                                fontFamily="monospace"
                                tickLine={false}
                                width={160}
                              />
                              <Tooltip content={<ShapChartTooltip />} />
                              <ReferenceLine x={0} stroke={axisColor} strokeWidth={1.5} />
                              <Bar dataKey="attribution" radius={[4, 4, 4, 4]}>
                                {shapChartData.map((entry, index) => (
                                  <Cell
                                    key={`shap-cell-${index}`}
                                    fill={
                                      Number(entry.attribution) >= 0
                                        ? shapPositiveColor
                                        : shapNegativeColor
                                    }
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Detailed Feature Breakdown Grid */}
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 font-mono text-xs">
                        {shapChartData.map((item, idx) => {
                          const isPos = Number(item.attribution) >= 0
                          return (
                            <div
                              key={`attr-card-${idx}`}
                              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 flex items-center justify-between"
                            >
                              <div className="min-w-0 pr-2">
                                <span className="block font-bold text-[var(--text-primary)] truncate">
                                  {item.displayName}
                                </span>
                                <span className="block text-[11px] text-[var(--text-muted)] truncate">
                                  Observed: {item.formattedValue}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span
                                  className={`inline-block font-bold text-xs ${
                                    isPos
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-red-600 dark:text-red-400'
                                  }`}
                                >
                                  {isPos ? '+' : ''}
                                  {item.attribution} pts
                                </span>
                                <span className="block text-[9px] uppercase tracking-wider text-[var(--text-secondary)]">
                                  {isPos ? 'Positive Driver' : 'Negative Driver'}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Technical Explainability Transparency Note */}
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-xs text-[var(--text-secondary)] flex items-start gap-2.5">
                        <Info size={15} className="mt-0.5 text-[var(--accent-primary)] shrink-0" />
                        <div>
                          <span className="font-bold text-[var(--text-primary)]">
                            SHAP / Attribution Methodology:{' '}
                          </span>
                          Feature attributions compute the exact marginal contribution of each input variable to the focus score model prediction relative to the training population expected value ({shapData.base_value} pts). The sum of all feature attributions plus the baseline exactly matches the model prediction.
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-8 text-center">
                      <Brain size={32} className="mx-auto text-[var(--text-muted)]" />
                      <h4 className="mt-3 text-sm font-bold text-[var(--text-primary)]">
                        Feature Attribution Unavailable
                      </h4>
                      <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                        SHAP explanations require completed session telemetry data. Once activities are logged and analyzed, feature contributions will automatically render here.
                      </p>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* --------------------------------------------------------------------------- */}
              {/* SECTION 4: INTERACTIVE COUNTERFACTUAL EXPLORER ("WHAT-IF" SIMULATION) */}
              {/* --------------------------------------------------------------------------- */}
              <SectionCard
                title='4. Interactive Counterfactual Explorer ("What-If" Simulation)'
                subtitle="Explore how bounded hypothetical changes to session telemetry affect AI model predictions without altering recorded session data"
                icon={Sliders}
              >
                <div className="space-y-6">
                  {/* Prominent Hypothetical Simulation Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                    <div className="flex items-center gap-2 font-mono font-bold uppercase tracking-wider">
                      <Sparkles size={14} className="text-amber-600 dark:text-amber-400" />
                      <span>Hypothetical What-If Simulation</span>
                    </div>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Original session telemetry and stored AI predictions remain untouched.
                    </span>
                  </div>

                  {/* Interactive Adjustment Controls */}
                  <form onSubmit={handleRunSimulation} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5 font-mono text-xs">
                      <label className="block rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                        <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                          Productive Time (min)
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="1440"
                          step="0.5"
                          value={simInputs.productiveMinutes}
                          onChange={(e) =>
                            setSimInputs((prev) => ({ ...prev, productiveMinutes: e.target.value }))
                          }
                          className="mt-1.5 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-mono text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        />
                        <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                          Baseline: {formatSeconds(features.productive_duration)}
                        </span>
                      </label>

                      <label className="block rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                        <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                          Distraction Time (min)
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="1440"
                          step="0.5"
                          value={simInputs.distractionMinutes}
                          onChange={(e) =>
                            setSimInputs((prev) => ({
                              ...prev,
                              distractionMinutes: e.target.value,
                            }))
                          }
                          className="mt-1.5 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-mono text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        />
                        <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                          Baseline: {formatSeconds(features.distraction_duration)}
                        </span>
                      </label>

                      <label className="block rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                        <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                          Break Time (min)
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="1440"
                          step="0.5"
                          value={simInputs.breakMinutes}
                          onChange={(e) =>
                            setSimInputs((prev) => ({ ...prev, breakMinutes: e.target.value }))
                          }
                          className="mt-1.5 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-mono text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        />
                        <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                          Baseline: {formatSeconds(features.break_duration)}
                        </span>
                      </label>

                      <label className="block rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                        <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                          Activity Switches
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="500"
                          step="1"
                          value={simInputs.activitySwitchCount}
                          onChange={(e) =>
                            setSimInputs((prev) => ({
                              ...prev,
                              activitySwitchCount: e.target.value,
                            }))
                          }
                          className="mt-1.5 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-mono text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        />
                        <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                          Baseline: {features.activity_switch_count ?? 0}
                        </span>
                      </label>

                      <label className="block rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                        <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                          Unique Applications
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={simInputs.uniqueApplicationCount}
                          onChange={(e) =>
                            setSimInputs((prev) => ({
                              ...prev,
                              uniqueApplicationCount: e.target.value,
                            }))
                          }
                          className="mt-1.5 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-mono text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        />
                        <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                          Baseline: {features.unique_application_count ?? 1}
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={simLoading}
                        className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2 font-mono text-xs font-bold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] transition disabled:opacity-50 shadow-xs"
                      >
                        {simLoading ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Running Model Simulation...</span>
                          </>
                        ) : (
                          <>
                            <Sliders size={14} />
                            <span>Simulate What-If Scenario</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleResetSimulation}
                        disabled={simLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 font-mono text-xs font-bold text-[var(--text-primary)] hover:border-[var(--border-strong)] transition"
                      >
                        <RotateCcw size={13} />
                        <span>Reset to Observed Baseline</span>
                      </button>
                    </div>
                  </form>

                  {/* Simulation Error */}
                  {simError && (
                    <div className="flex items-center gap-2 rounded-lg border border-[var(--status-danger)]/40 bg-[var(--status-danger)]/10 p-3 text-xs text-[var(--text-primary)]">
                      <AlertCircle size={15} className="text-[var(--status-danger)] shrink-0" />
                      <span>{simError}</span>
                    </div>
                  )}

                  {/* Simulation Comparison Results */}
                  {simResult && (
                    <div className="space-y-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                            Hypothetical Projection
                          </span>
                          <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                            Observed Session vs. Simulated Counterfactual
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                          Simulated Total Duration:{' '}
                          {formatSeconds(simResult.modified_features?.total_session_duration)} |
                          Productive Ratio:{' '}
                          {(
                            (simResult.modified_features?.productive_activity_ratio || 0) * 100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {/* Focus Score Comparison */}
                        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                          <span className="font-mono text-[11px] font-bold text-[var(--text-secondary)] uppercase">
                            Focus Score (Observed → Simulated)
                          </span>
                          <div className="mt-2 flex items-baseline justify-between">
                            <div>
                              <span className="font-mono text-xs text-[var(--text-muted)] line-through mr-2">
                                {simResult.baseline_predictions?.focus_score}
                              </span>
                              <span className="text-2xl font-bold text-[var(--text-primary)]">
                                {simResult.simulated_predictions?.focus_score} / 100
                              </span>
                            </div>
                            <span
                              className={`rounded-md border px-2 py-0.5 font-mono text-xs font-bold ${getDeltaBadgeStyle(
                                simResult.deltas?.focus_score_delta
                              )}`}
                            >
                              {formatDelta(simResult.deltas?.focus_score_delta, ' pts')}
                            </span>
                          </div>
                        </div>

                        {/* Distraction Level Comparison */}
                        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                          <span className="font-mono text-[11px] font-bold text-[var(--text-secondary)] uppercase">
                            Distraction Level (Observed → Simulated)
                          </span>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 font-mono text-xs">
                              <span
                                className={`rounded-md border px-2 py-0.5 font-bold uppercase ${getDistractionBadgeStyle(
                                  simResult.baseline_predictions?.distraction_level
                                )}`}
                              >
                                {simResult.baseline_predictions?.distraction_level}
                              </span>
                              <span className="text-[var(--text-muted)]">→</span>
                              <span
                                className={`rounded-md border px-2.5 py-0.5 text-sm font-bold uppercase ${getDistractionBadgeStyle(
                                  simResult.simulated_predictions?.distraction_level
                                )}`}
                              >
                                {simResult.simulated_predictions?.distraction_level}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                              {simResult.deltas?.distraction_level_changed ? 'Shifted' : 'Unchanged'}
                            </span>
                          </div>
                        </div>

                        {/* Performance Prediction Comparison */}
                        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                          <span className="font-mono text-[11px] font-bold text-[var(--text-secondary)] uppercase">
                            Performance Estimate (Observed → Simulated)
                          </span>
                          <div className="mt-2 flex items-baseline justify-between">
                            <div>
                              <span className="font-mono text-xs text-[var(--text-muted)] line-through mr-2">
                                {simResult.baseline_predictions?.performance_prediction}%
                              </span>
                              <span className="text-2xl font-bold text-[var(--text-primary)]">
                                {simResult.simulated_predictions?.performance_prediction}%
                              </span>
                            </div>
                            <span
                              className={`rounded-md border px-2 py-0.5 font-mono text-xs font-bold ${getDeltaBadgeStyle(
                                simResult.deltas?.performance_prediction_delta
                              )}`}
                            >
                              {formatDelta(simResult.deltas?.performance_prediction_delta, '%')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Plain-Language Counterfactual Explanation */}
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-xs text-[var(--text-primary)] leading-relaxed">
                        <span className="font-mono font-bold uppercase text-[var(--accent-primary)] mr-1.5">
                          Counterfactual Summary:
                        </span>
                        {simResult.explanation_summary}
                      </div>
                    </div>
                  )}

                  {/* Counterfactual Safeguard Disclaimer */}
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-xs text-[var(--text-secondary)] flex items-start gap-2.5">
                    <AlertCircle
                      size={15}
                      className="mt-0.5 text-[var(--accent-primary)] shrink-0"
                    />
                    <div>
                      <span className="font-bold text-[var(--text-primary)]">
                        Counterfactual Interpretation Notice:{' '}
                      </span>
                      Simulated values represent hypothetical model projections computed by
                      re-evaluating the trained scikit-learn pipeline on modified feature vectors.
                      They do not represent measured outcomes or causal guarantees.
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : (
            <SectionCard
              title="AI Behavioural Analysis Flow"
              subtitle="Model predictions derived from completed study session telemetry"
              icon={Sparkles}
            >
              <EmptyState
                icon={Activity}
                title="Not enough activity data to generate an AI analysis yet"
                description="Start a study session and log session activities. The AI/ML pipeline will process your feature vector and generate predictions."
                actionText="Go to Study Sessions"
                actionLink="/app/student/sessions"
              />
            </SectionCard>
          )}
        </>
      )}

      {/* Historical Telemetry & Trend Trajectory */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Telemetry Trajectory"
          subtitle="Observed productive vs distraction ratio across analyzed sessions"
          icon={TrendingUp}
        >
          {trendChartData.length > 0 ? (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData}>
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
                    width={32}
                  />
                  <Tooltip content={<BehaviourChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '8px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="focusScore"
                    name="Focus Score"
                    stroke={focusColor}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="productiveRatio"
                    name="Productive %"
                    stroke={productiveColor}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="distractionRatio"
                    name="Distraction %"
                    stroke={distractionColor}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="No trajectory data available"
              description="Historical telemetry trends will plot your productive and distraction ratios over time as sessions are completed."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Context Switching Dynamics"
          subtitle="Window switches and task interruption telemetry"
          icon={RefreshCw}
        >
          {latestAnalysis?.feature_snapshot?.activity_switch_count !== undefined ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-center">
                <span className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase">
                  Session Activity Switches
                </span>
                <div className="mt-2 text-4xl font-extrabold text-[var(--text-primary)]">
                  {latestAnalysis.feature_snapshot.activity_switch_count}
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Context transitions recorded across {latestAnalysis.feature_snapshot.unique_application_count || 1} distinct tools.
                </p>
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-xs text-[var(--text-secondary)]">
                <span className="font-mono font-bold text-[var(--text-primary)] uppercase">
                  Attention Recovery Impact:{' '}
                </span>
                Frequent application switches increase cognitive recovery lag and reduce session focus score predictions.
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Layers}
              title="No switching telemetry"
              description="Measures how often your active window shifts between tools to evaluate fragmentation and attention recovery lag."
            />
          )}
        </SectionCard>
      </div>
    </div>
  )
}
