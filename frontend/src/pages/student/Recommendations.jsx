import { CheckCircle2, History, Lightbulb, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EmptyState } from '../../components/dashboard/EmptyState'
import { SectionCard } from '../../components/dashboard/SectionCard'
import { getStudentRecommendationHistory } from '../../lib/api'

export function Recommendations() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadRecommendations() {
      setLoading(true)
      try {
        const data = await getStudentRecommendationHistory({ limit: 20 })
        setHistory(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Failed to load recommendation history:', err)
      } finally {
        setLoading(false)
      }
    }
    loadRecommendations()
  }, [])

  const activeRecommendation = history.length > 0 ? history[0] : null

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header */}
      <section className="rounded-2xl border border-[#17221c]/15 bg-white p-6 sm:p-8 shadow-xs">
        <span className="font-mono text-xs font-bold tracking-widest text-[#4e6656] uppercase">
          Intervention Engine
        </span>
        <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#17221c]">
          AI Recommendations & Interventions
        </h2>
        <p className="mt-2 text-sm text-[#405047] max-w-2xl leading-relaxed">
          Actionable habit adjustments personalized to your behavioural profile. The lightweight recommendation
          engine maps session telemetry to non-clinical study personas to select targeted habit recommendations.
        </p>
      </section>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-[#17221c]/15 bg-white p-8">
          <RefreshCw className="mr-2 size-5 animate-spin text-[#4e6656]" />
          <span className="font-mono text-xs font-semibold text-[#4e6656]">Loading recommendations...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Recommendation Card */}
          <SectionCard
            title="Active Targeted Recommendation"
            subtitle="Current habit adjustment selected based on your recent study session telemetry"
            icon={Sparkles}
          >
            {activeRecommendation ? (
              <div className="rounded-xl border border-[#17221c]/15 bg-[#fbf9f4] p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#17221c]/10 pb-3">
                  <div>
                    <span className="inline-block rounded-full bg-[#17221c] px-3 py-1 font-mono text-[10px] font-bold text-[#f5f1e8] uppercase tracking-wider">
                      {activeRecommendation.recommendation_type}
                    </span>
                    <h3 className="mt-2 font-serif text-xl font-bold text-[#17221c]">
                      {activeRecommendation.title}
                    </h3>
                  </div>
                  {activeRecommendation.behavioural_persona && (
                    <span className="rounded-md border border-[#4e6656]/30 bg-white px-2.5 py-1 font-mono text-xs font-semibold text-[#4e6656]">
                      Persona: {activeRecommendation.behavioural_persona}
                    </span>
                  )}
                </div>

                <p className="text-sm text-[#405047] leading-relaxed">
                  {activeRecommendation.content}
                </p>

                {activeRecommendation.selection_reason && (
                  <div className="rounded-lg border border-[#17221c]/10 bg-white p-3 font-mono text-xs text-[#17221c]">
                    <span className="font-bold text-[#4e6656] uppercase block text-[10px] mb-1">
                      Selection Rationale
                    </span>
                    {activeRecommendation.selection_reason}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs font-mono text-[#405047]">
                  <span>Selector Version: {activeRecommendation.selector_version || 'v1.0'}</span>
                  <span>Issued: {new Date(activeRecommendation.issued_at).toLocaleDateString()}</span>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Lightbulb}
                title="No recommendations generated yet"
                description="Personalized study suggestions will appear here after your study sessions are recorded and analyzed."
              />
            )}
          </SectionCard>

          {/* Recommendation History Stream */}
          <SectionCard
            title="Recommendation History & Follow-Through Stream"
            subtitle="Chronological log of issued recommendations and recorded outcome status"
            icon={History}
          >
            {history.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-[#17221c]/10 bg-white">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-[#fbf9f4] text-[#4e6656] uppercase border-b border-[#17221c]/10">
                    <tr>
                      <th className="px-4 py-2.5 font-bold">Recommendation</th>
                      <th className="px-4 py-2.5 font-bold">Persona</th>
                      <th className="px-4 py-2.5 font-bold">Issued Date</th>
                      <th className="px-4 py-2.5 font-bold">Outcome Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#17221c]/10">
                    {history.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-[#17221c]">{item.title}</div>
                          <div className="text-[11px] text-[#405047] line-clamp-1">{item.content}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#4e6656]">
                          {item.behavioural_persona || '—'}
                        </td>
                        <td className="px-4 py-3 text-[#405047]">
                          {new Date(item.issued_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                              item.outcome_status === 'measured'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                            }`}
                          >
                            {item.outcome_status || 'unmeasured'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title="No recommendation history recorded"
                description="Issued recommendations and outcome tracking logs will populate chronologically."
              />
            )}
          </SectionCard>
        </div>
      )}
    </div>
  )
}
