import { Activity, AlertCircle, Brain, Calendar, Clock, Layers, Link as LinkIcon, Orbit, PieChart, RefreshCw, Sparkles, Tag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SectionCard } from '../../components/dashboard/SectionCard'
import { EmptyState } from '../../components/dashboard/EmptyState'
import { getStudentBehaviour } from '../../lib/api'

export function Behaviour() {
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchBehaviour = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getStudentBehaviour({ limit: 20 })
      setAnalyses(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch behavioural analysis:', err)
      setError('Unable to load behavioural analysis. Please check network connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBehaviour()
  }, [])

  const latestAnalysis = analyses.length > 0 ? analyses[0] : null
  const features = latestAnalysis?.feature_snapshot || {}

  const getDistractionBadgeStyle = (level) => {
    switch ((level || '').toUpperCase()) {
      case 'LOW':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300'
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-300'
      case 'HIGH':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const formatSeconds = (sec) => {
    if (sec === undefined || sec === null) return '—'
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    if (m === 0) return `${s}s`
    return `${m}m ${s}s`
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header */}
      <section className="rounded-2xl border border-[#17221c]/15 bg-white p-6 sm:p-8 shadow-xs">
        <span className="font-mono text-xs font-bold tracking-widest text-[#4e6656] uppercase">
          Student Insights & Behaviour Pipeline
        </span>
        <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#17221c]">
          Behavioural Telemetry & AI Predictions
        </h2>
        <p className="mt-2 text-sm text-[#405047] max-w-2xl leading-relaxed">
          Review observed study session measurements alongside AI model predictions. Telemetry features are aggregated deterministically from your session activity.
        </p>
      </section>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center rounded-xl border border-[#17221c]/15 bg-white p-8">
          <RefreshCw className="mr-2 size-5 animate-spin text-[#4e6656]" />
          <span className="font-mono text-xs font-semibold text-[#4e6656]">Loading AI analysis flow...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <div className="flex items-center gap-2 text-xs font-medium">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchBehaviour}
            className="rounded-md bg-red-100 px-3 py-1 font-mono text-xs font-bold hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {latestAnalysis ? (
            <div className="space-y-8">
              {/* Session-to-Analysis Linking Badge */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#17221c]/15 bg-[#fbf9f4] p-4 text-xs font-mono">
                <div className="flex items-center gap-2 text-[#17221c]">
                  <LinkIcon size={14} className="text-[#4e6656]" />
                  <span className="font-bold">Source Session:</span>
                  <span>{latestAnalysis.study_session_id}</span>
                  {latestAnalysis.subject_name && (
                    <span className="rounded bg-[#17221c] px-2 py-0.5 text-[10px] font-bold text-[#f5f1e8] uppercase">
                      {latestAnalysis.subject_name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-[#405047]">
                  {latestAnalysis.session_started_at && (
                    <div className="flex items-center gap-1">
                      <Calendar size={13} />
                      <span>Session: {new Date(latestAnalysis.session_started_at).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock size={13} />
                    <span>Analyzed: {new Date(latestAnalysis.analyzed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 font-mono text-xs">
                  <div className="rounded-lg bg-[#fbf9f4] p-3.5 border border-[#17221c]/10">
                    <span className="block text-[10px] font-bold text-[#4e6656] uppercase">Total Duration</span>
                    <span className="block font-serif text-lg font-bold text-[#17221c]">
                      {formatSeconds(features.total_session_duration)}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#fbf9f4] p-3.5 border border-[#17221c]/10">
                    <span className="block text-[10px] font-bold text-[#4e6656] uppercase">Productive Time</span>
                    <span className="block font-serif text-lg font-bold text-[#17221c]">
                      {formatSeconds(features.productive_duration)}
                    </span>
                    <span className="text-[10px] text-[#405047]">
                      {features.productive_activity_ratio !== undefined ? `(${(features.productive_activity_ratio * 100).toFixed(1)}% ratio)` : ''}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#fbf9f4] p-3.5 border border-[#17221c]/10">
                    <span className="block text-[10px] font-bold text-[#4e6656] uppercase">Distraction Time</span>
                    <span className="block font-serif text-lg font-bold text-[#17221c]">
                      {formatSeconds(features.distraction_duration)}
                    </span>
                    <span className="text-[10px] text-[#405047]">
                      {features.distraction_activity_ratio !== undefined ? `(${(features.distraction_activity_ratio * 100).toFixed(1)}% ratio)` : ''}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#fbf9f4] p-3.5 border border-[#17221c]/10">
                    <span className="block text-[10px] font-bold text-[#4e6656] uppercase">Break Time</span>
                    <span className="block font-serif text-lg font-bold text-[#17221c]">
                      {formatSeconds(features.break_duration)}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#fbf9f4] p-3.5 border border-[#17221c]/10">
                    <span className="block text-[10px] font-bold text-[#4e6656] uppercase">Activity Switches</span>
                    <span className="block font-serif text-lg font-bold text-[#17221c]">
                      {features.activity_switch_count ?? '—'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#fbf9f4] p-3.5 border border-[#17221c]/10">
                    <span className="block text-[10px] font-bold text-[#4e6656] uppercase">Recorded Activities</span>
                    <span className="block font-serif text-lg font-bold text-[#17221c]">
                      {features.activity_count ?? '—'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#fbf9f4] p-3.5 border border-[#17221c]/10">
                    <span className="block text-[10px] font-bold text-[#4e6656] uppercase">Unique Applications</span>
                    <span className="block font-serif text-lg font-bold text-[#17221c]">
                      {features.unique_application_count ?? '—'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#fbf9f4] p-3.5 border border-[#17221c]/10">
                    <span className="block text-[10px] font-bold text-[#4e6656] uppercase">Enriched Quiz Score</span>
                    <span className="block font-serif text-lg font-bold text-[#17221c]">
                      {features.quiz_score !== null && features.quiz_score !== undefined ? `${features.quiz_score}%` : 'Unrecorded (Imputed)'}
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
                  <div className="flex items-center justify-between border-b border-[#17221c]/10 pb-3">
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-[#4e6656]" />
                      <span className="font-mono text-xs font-bold text-[#17221c] uppercase tracking-wider">
                        AI-generated predictions
                      </span>
                    </div>
                    <span className="rounded bg-[#17221c] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#f5f1e8]">
                      Model Pipeline {latestAnalysis.model_version || 'v1.0'}
                    </span>
                  </div>

                  {/* AI Prediction Cards Grid */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {/* Focus Score Model Prediction */}
                    <div className="rounded-xl border border-[#17221c]/15 bg-white p-5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[#4e6656] uppercase tracking-wider">
                          AI Focus Score
                        </span>
                        <div className="grid size-8 place-items-center rounded-lg bg-[#f5f1e8] text-[#17221c]">
                          <Orbit size={18} />
                        </div>
                      </div>
                      <div className="mt-3 font-serif text-3xl font-bold text-[#17221c]">
                        {latestAnalysis.focus_score !== null ? `${latestAnalysis.focus_score} / 100` : '—'}
                      </div>
                      <p className="mt-1 text-[11px] text-[#405047]">
                        RandomForestRegressor estimate based on productive ratio & switch telemetry.
                      </p>
                      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-[#405047]">
                        <span>Model: {latestAnalysis.model_version || 'v1.0'}</span>
                        <span className="rounded bg-emerald-50 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold uppercase border border-emerald-200">
                          AI Predicted
                        </span>
                      </div>
                    </div>

                    {/* Distraction Level Model Classification */}
                    <div className="rounded-xl border border-[#17221c]/15 bg-white p-5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[#4e6656] uppercase tracking-wider">
                          AI Distraction Level
                        </span>
                        <div className="grid size-8 place-items-center rounded-lg bg-[#f5f1e8] text-[#17221c]">
                          <Activity size={18} />
                        </div>
                      </div>
                      <div className="mt-3">
                        {latestAnalysis.distraction_level ? (
                          <span className={`inline-block rounded-md border px-3 py-1 font-mono text-base font-bold uppercase ${getDistractionBadgeStyle(latestAnalysis.distraction_level)}`}>
                            {latestAnalysis.distraction_level}
                          </span>
                        ) : (
                          <span className="font-serif text-xl text-[#17221c]/40">—</span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-[#405047]">
                        RandomForestClassifier rating derived from distraction ratio & window switching.
                      </p>
                      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-[#405047]">
                        <span>Model: {latestAnalysis.model_version || 'v1.0'}</span>
                        <span className="rounded bg-emerald-50 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold uppercase border border-emerald-200">
                          AI Classifier
                        </span>
                      </div>
                    </div>

                    {/* Performance Model Prediction */}
                    <div className="rounded-xl border border-[#17221c]/15 bg-white p-5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[#4e6656] uppercase tracking-wider">
                          AI Performance Score
                        </span>
                        <div className="grid size-8 place-items-center rounded-lg bg-[#f5f1e8] text-[#17221c]">
                          <Brain size={18} />
                        </div>
                      </div>
                      <div className="mt-3 font-serif text-3xl font-bold text-[#17221c]">
                        {latestAnalysis.performance_prediction !== null ? `${latestAnalysis.performance_prediction}%` : '—'}
                      </div>
                      <p className="mt-1 text-[11px] text-[#405047]">
                        GradientBoostingRegressor prediction derived from attention stability & quiz history.
                      </p>
                      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-[#405047]">
                        <span>Model: {latestAnalysis.model_version || 'v1.0'}</span>
                        <span className="rounded bg-emerald-50 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold uppercase border border-emerald-200">
                          AI Regressor
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ethical & Development Disclaimer */}
                  <div className="mt-4 rounded-lg bg-[#fbf9f4] p-3.5 border border-[#17221c]/10 text-xs text-[#405047] flex items-start gap-2">
                    <AlertCircle size={15} className="mt-0.5 text-[#4e6656] shrink-0" />
                    <div>
                      <span className="font-bold text-[#17221c]">Development Initial Model Disclaimer: </span>
                      AI predictions are generated by scikit-learn models trained on an initial synthetic benchmark dataset. Predictions are provided for educational reference only and are not clinically or academically validated ground truth.
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

      {/* Additional Analytics Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Application Distribution"
          subtitle="Time split by category (Productive, Distraction, Neutral)"
          icon={PieChart}
        >
          <EmptyState
            icon={PieChart}
            title="No application data"
            description="Visual breakdowns of time spent in IDEs, browser research, documentation, and distracting domains will display here."
          />
        </SectionCard>

        <SectionCard
          title="Context Switching Dynamics"
          subtitle="Window switches and task interruption rate"
          icon={RefreshCw}
        >
          <EmptyState
            icon={Layers}
            title="No switching telemetry"
            description="Measures how often your active window shifts between tools to evaluate fragmentation and attention recovery lag."
          />
        </SectionCard>
      </div>
    </div>
  )
}
