import { Award, BookOpen, Brain, GraduationCap, RefreshCw, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SectionCard } from '../../components/dashboard/SectionCard'
import { EmptyState } from '../../components/dashboard/EmptyState'
import { getStudentBehaviour, getStudentPerformance } from '../../lib/api'

export function Performance() {
  const [analyses, setAnalyses] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [behData, perfData] = await Promise.all([
          getStudentBehaviour({ limit: 10 }),
          getStudentPerformance({ limit: 10 }),
        ])
        setAnalyses(Array.isArray(behData) ? behData : [])
        setReports(Array.isArray(perfData) ? perfData : [])
      } catch (err) {
        console.error('Failed to load performance data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const latestAnalysis = analyses.length > 0 ? analyses[0] : null

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header */}
      <section className="rounded-2xl border border-[#17221c]/15 bg-white p-6 sm:p-8 shadow-xs">
        <span className="font-mono text-xs font-bold tracking-widest text-[#4e6656] uppercase">
          Academic Correlation
        </span>
        <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#17221c]">
          Performance Analytics & AI Grade Prediction
        </h2>
        <p className="mt-2 text-sm text-[#405047] max-w-2xl leading-relaxed">
          Correlate your measured study patterns with academic outcomes and AI regressor predictions to identify study habits that maximize score retention.
        </p>
      </section>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-[#17221c]/15 bg-white p-8">
          <RefreshCw className="mr-2 size-5 animate-spin text-[#4e6656]" />
          <span className="font-mono text-xs font-semibold text-[#4e6656]">Loading performance analytics...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* AI Predicted Performance Card */}
          <SectionCard
            title="AI Predicted Performance Score"
            subtitle="Gradient Boosting Regressor estimate derived from session telemetry and quiz indicators"
            icon={Brain}
          >
            {latestAnalysis && latestAnalysis.performance_prediction !== null ? (
              <div className="rounded-xl border border-[#17221c]/15 bg-[#fbf9f4] p-6 text-center space-y-4">
                <div>
                  <span className="inline-block rounded-full bg-[#4e6656]/10 px-3 py-1 font-mono text-xs font-bold text-[#4e6656] uppercase tracking-wider">
                    AI MODEL PREDICTION
                  </span>
                  <div className="mt-2 font-serif text-4xl font-extrabold text-[#17221c]">
                    {latestAnalysis.performance_prediction}%
                  </div>
                  <p className="mt-1 text-xs text-[#405047] max-w-md mx-auto">
                    Estimated academic performance capacity based on your session telemetry and historical quiz baseline.
                  </p>
                </div>

                {/* Observed Telemetry Inputs Used by Model */}
                {latestAnalysis.feature_snapshot && (
                  <div className="rounded-lg border border-[#17221c]/10 bg-white p-4 text-left">
                    <div className="font-mono text-[11px] font-bold text-[#17221c] uppercase tracking-wide mb-2">
                      Observed Feature Inputs (Model Telemetry Context)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                      <div className="rounded bg-[#fbf9f4] p-2 border border-[#17221c]/5">
                        <span className="text-[#405047] block text-[10px] uppercase">Productive Ratio</span>
                        <span className="font-bold text-[#17221c]">
                          {Math.round((latestAnalysis.feature_snapshot.productive_activity_ratio || 0) * 100)}%
                        </span>
                      </div>
                      <div className="rounded bg-[#fbf9f4] p-2 border border-[#17221c]/5">
                        <span className="text-[#405047] block text-[10px] uppercase">Distraction Ratio</span>
                        <span className="font-bold text-[#17221c]">
                          {Math.round((latestAnalysis.feature_snapshot.distraction_activity_ratio || 0) * 100)}%
                        </span>
                      </div>
                      <div className="rounded bg-[#fbf9f4] p-2 border border-[#17221c]/5">
                        <span className="text-[#405047] block text-[10px] uppercase">Context Switches</span>
                        <span className="font-bold text-[#17221c]">
                          {latestAnalysis.feature_snapshot.activity_switch_count ?? 0}
                        </span>
                      </div>
                      <div className="rounded bg-[#fbf9f4] p-2 border border-[#17221c]/5">
                        <span className="text-[#405047] block text-[10px] uppercase">Quiz Baseline</span>
                        <span className="font-bold text-[#17221c]">
                          {latestAnalysis.feature_snapshot.quiz_score !== null && latestAnalysis.feature_snapshot.quiz_score !== undefined
                            ? `${latestAnalysis.feature_snapshot.quiz_score}%`
                            : 'Median Imputed'}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-[#405047] italic">
                      Note: These observed feature metrics represent model inputs and statistical associations, not direct causal guarantees.
                    </p>
                  </div>
                )}

                <div className="inline-flex items-center gap-2 rounded-md bg-[#17221c] px-3 py-1 font-mono text-[11px] font-bold text-[#f5f1e8] uppercase">
                  <span>Model: {latestAnalysis.model_version || 'v1.0'}</span>
                  <span>•</span>
                  <span>Analyzed: {new Date(latestAnalysis.analyzed_at).toLocaleDateString()}</span>
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard
              title="Subject Mastery Overview"
              subtitle="Progress and retention across enrolled subjects"
              icon={BookOpen}
            >
              <EmptyState
                icon={BookOpen}
                title="No subjects evaluated"
                description="Enrolled subjects, difficulty ratings, and quiz score averages will be organized here."
              />
            </SectionCard>

            <SectionCard
              title="Focus vs. Score Correlation"
              subtitle="Interpreting the impact of sustained attention"
              icon={TrendingUp}
            >
              <EmptyState
                icon={Award}
                title="Correlation data unavailable"
                description="Statistical correlation between session focus scores and test results will be plotted here."
              />
            </SectionCard>
          </div>

          <SectionCard
            title="Performance Assessment History"
            subtitle="Historical reports and quiz logs"
            icon={GraduationCap}
          >
            {reports.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-[#17221c]/10 bg-white">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-[#fbf9f4] text-[#4e6656] uppercase border-b border-[#17221c]/10">
                    <tr>
                      <th className="px-4 py-2.5 font-bold">Metric</th>
                      <th className="px-4 py-2.5 font-bold">Score</th>
                      <th className="px-4 py-2.5 font-bold">Max Score</th>
                      <th className="px-4 py-2.5 font-bold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#17221c]/10">
                    {reports.map((rep) => (
                      <tr key={rep.id}>
                        <td className="px-4 py-2.5 font-semibold text-[#17221c]">{rep.performance_metric}</td>
                        <td className="px-4 py-2.5 font-bold text-emerald-800">{rep.score ?? '—'}</td>
                        <td className="px-4 py-2.5 text-[#405047]">{rep.max_score ?? '100'}</td>
                        <td className="px-4 py-2.5 text-[#405047]">{new Date(rep.measured_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={GraduationCap}
                title="No assessment reports recorded yet"
                description="Reports capturing average focus, quiz scores, and performance tiers will list chronologically."
              />
            )}
          </SectionCard>
        </div>
      )}
    </div>
  )
}
