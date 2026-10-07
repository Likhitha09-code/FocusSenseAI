import { Activity, AlertCircle, Brain, Layers, Orbit, PieChart, RefreshCw, Sparkles } from 'lucide-react'
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
      setError('Unable to load behavioural analysis.')
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

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header */}
      <section className="rounded-2xl border border-[#17221c]/15 bg-white p-6 sm:p-8 shadow-xs">
        <span className="font-mono text-xs font-bold tracking-widest text-[#4e6656] uppercase">
          AI Behaviour Analysis
        </span>
        <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#17221c]">
          Behavioural Feature Extraction & Predictions
        </h2>
        <p className="mt-2 text-sm text-[#405047] max-w-2xl leading-relaxed">
          Real scikit-learn model predictions trained on behavioural feature vectors. Predictions are derived strictly from your logged study session activity.
        </p>
      </section>

      {/* Loading & Error States */}
      {loading && (
        <div className="flex items-center justify-center rounded-xl border border-[#17221c]/15 bg-white p-8">
          <RefreshCw className="mr-2 size-5 animate-spin text-[#4e6656]" />
          <span className="font-mono text-xs font-semibold text-[#4e6656]">Loading AI analysis...</span>
        </div>
      )}

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
            <div className="space-y-6">
              {/* AI Prediction Cards */}
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
                  <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-[#405047]">
                    <span>Model: {latestAnalysis.model_version || 'v1.0'}</span>
                    <span className="rounded bg-[#f5f1e8] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#17221c]">
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
                  <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-[#405047]">
                    <span>Model: {latestAnalysis.model_version || 'v1.0'}</span>
                    <span className="rounded bg-[#f5f1e8] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#17221c]">
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
                  <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-[#405047]">
                    <span>Model: {latestAnalysis.model_version || 'v1.0'}</span>
                    <span className="rounded bg-[#f5f1e8] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#17221c]">
                      AI Regressor
                    </span>
                  </div>
                </div>
              </div>

              {/* Observed Telemetry Feature Snapshot */}
              <SectionCard
                title="Observed Telemetry Input Vector"
                subtitle="Real activity features passed to the ML models (Task 10 Data Pipeline)"
                icon={Layers}
              >
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 font-mono text-xs">
                  <div className="rounded-lg bg-[#fbf9f4] p-3 border border-[#17221c]/10">
                    <span className="block text-[10px] font-bold text-[#4e6656] uppercase">Productive Ratio</span>
                    <span className="block font-serif text-lg font-bold text-[#17221c]">
                      {features.productive_activity_ratio !== undefined ? `${(features.productive_activity_ratio * 100).toFixed(1)}%` : '—'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#fbf9f4] p-3 border border-[#17221c]/10">
                    <span className="block text-[10px] font-bold text-[#4e6656] uppercase">Distraction Ratio</span>
                    <span className="block font-serif text-lg font-bold text-[#17221c]">
                      {features.distraction_activity_ratio !== undefined ? `${(features.distraction_activity_ratio * 100).toFixed(1)}%` : '—'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#fbf9f4] p-3 border border-[#17221c]/10">
                    <span className="block text-[10px] font-bold text-[#4e6656] uppercase">Context Switches</span>
                    <span className="block font-serif text-lg font-bold text-[#17221c]">
                      {features.activity_switch_count ?? '—'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#fbf9f4] p-3 border border-[#17221c]/10">
                    <span className="block text-[10px] font-bold text-[#4e6656] uppercase">Enriched Quiz Score</span>
                    <span className="block font-serif text-lg font-bold text-[#17221c]">
                      {features.quiz_score !== null && features.quiz_score !== undefined ? `${features.quiz_score}%` : 'Unrecorded (Imputed)'}
                    </span>
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : (
            <SectionCard
              title="AI Behavioural Analysis"
              subtitle="Model predictions derived from study session telemetry"
              icon={Sparkles}
            >
              <EmptyState
                icon={Activity}
                title="Not enough activity data to generate an AI analysis yet"
                description="Start a study session and log session activities. The real AI/ML pipeline will process your feature vector and generate predictions."
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
