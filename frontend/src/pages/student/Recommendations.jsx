import { CheckCircle2, History, Lightbulb, RefreshCw, Sparkles, TrendingUp, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EmptyState } from '../../components/dashboard/EmptyState'
import { SectionCard } from '../../components/dashboard/SectionCard'
import {
  getStudentRecommendationEffectiveness,
  getStudentRecommendationHistory,
  recordRecommendationOutcome,
} from '../../lib/api'

export function Recommendations() {
  const [history, setHistory] = useState([])
  const [effectiveness, setEffectiveness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recordingId, setRecordingId] = useState(null)

  const loadRecommendations = async () => {
    try {
      const [histData, effData] = await Promise.all([
        getStudentRecommendationHistory({ limit: 20 }),
        getStudentRecommendationEffectiveness().catch(() => null),
      ])
      setHistory(Array.isArray(histData) ? histData : [])
      if (effData) setEffectiveness(effData)
    } catch (err) {
      console.error('Failed to load recommendation data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    async function initialFetch() {
      try {
        const [histData, effData] = await Promise.all([
          getStudentRecommendationHistory({ limit: 20 }),
          getStudentRecommendationEffectiveness().catch(() => null),
        ])
        if (!ignore) {
          setHistory(Array.isArray(histData) ? histData : [])
          if (effData) setEffectiveness(effData)
          setLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load recommendation data:', err)
          setLoading(false)
        }
      }
    }
    initialFetch()
    return () => {
      ignore = true
    }
  }, [])

  const handleRecordFollowed = async (eventId, followed) => {
    setRecordingId(eventId)
    try {
      await recordRecommendationOutcome(eventId, { recommendation_followed: followed })
      await loadRecommendations()
    } catch (err) {
      console.error('Failed to record recommendation outcome:', err)
    } finally {
      setRecordingId(null)
    }
  }

  const activeRecommendation = history.length > 0 ? history[0] : null

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-0.5 font-mono text-[11px] font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
              Intervention Engine
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              AI Recommendations & Interventions
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              Actionable habit adjustments personalized to your behavioural profile. Track your follow-through
              and view observed next-session focus delta measurements.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={loadRecommendations}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2 font-mono text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-50 shadow-xs"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10">
          <RefreshCw className="mr-2.5 size-5 animate-spin text-[var(--accent-primary)]" />
          <span className="font-mono text-xs font-semibold text-[var(--text-secondary)]">Loading recommendations...</span>
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
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 space-y-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                  <div>
                    {activeRecommendation.selector_version === 'onboarding-baseline' ? (
                      <span className="inline-block rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        Onboarding Habit Guide
                      </span>
                    ) : (
                      <span className="inline-block rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[var(--accent-primary)] uppercase tracking-wider">
                        {activeRecommendation.recommendation_type}
                      </span>
                    )}
                    <h3 className="mt-2 text-xl font-bold text-[var(--text-primary)]">
                      {activeRecommendation.title}
                    </h3>
                  </div>
                  {activeRecommendation.behavioural_persona && (
                    <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 font-mono text-xs font-semibold text-[var(--text-secondary)]">
                      Persona: {activeRecommendation.behavioural_persona}
                    </span>
                  )}
                </div>

                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {activeRecommendation.content}
                </p>

                {activeRecommendation.selection_reason && (
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 font-mono text-xs text-[var(--text-primary)]">
                    <span className="font-bold text-[var(--accent-primary)] uppercase block text-[10px] mb-1">
                      Selection Rationale
                    </span>
                    {activeRecommendation.selection_reason}
                  </div>
                )}

                {/* Follow-through action buttons */}
                {activeRecommendation.selector_version === 'onboarding-baseline' ? (
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-xs text-[var(--text-secondary)] leading-relaxed">
                    <span className="font-mono font-bold text-[var(--text-primary)] block uppercase text-[11px] mb-1">
                      Getting Started
                    </span>
                    Complete your first study session to generate telemetry-driven recommendations and unlock empirical focus delta tracking.
                  </div>
                ) : (
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
                    <div className="font-mono text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">
                      Record Recommendation Follow-Through
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleRecordFollowed(activeRecommendation.id, true)}
                        disabled={recordingId === activeRecommendation.id}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-mono text-xs font-bold tracking-wider uppercase transition shadow-xs ${
                          activeRecommendation.recommendation_followed === true
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]'
                        }`}
                      >
                        <CheckCircle2 size={14} />
                        <span>{activeRecommendation.recommendation_followed === true ? 'Followed' : 'I Followed This'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRecordFollowed(activeRecommendation.id, false)}
                        disabled={recordingId === activeRecommendation.id}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-mono text-xs font-bold tracking-wider uppercase transition border border-[var(--border-subtle)] bg-[var(--bg-elevated)] ${
                          activeRecommendation.recommendation_followed === false
                            ? 'bg-red-600 text-white border-red-600'
                            : 'text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <XCircle size={14} />
                        <span>{activeRecommendation.recommendation_followed === false ? 'Not Followed' : 'Did Not Follow'}</span>
                      </button>

                      {activeRecommendation.outcome_status === 'measured' && activeRecommendation.delta_focus_next_session !== null && (
                        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-md border border-emerald-500/20">
                          Observed next-session focus change:{' '}
                          {activeRecommendation.delta_focus_next_session >= 0 ? `+${activeRecommendation.delta_focus_next_session}` : activeRecommendation.delta_focus_next_session} pts
                        </span>
                      )}
                    </div>
                    {activeRecommendation.outcome_status === 'measured' && (
                      <p className="text-[10px] text-[var(--text-muted)] italic">
                        Note: Focus delta values are observational comparisons across consecutive study sessions, not causal claims.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs font-mono text-[var(--text-muted)]">
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

          {/* Adaptive Feedback & Effectiveness Insights Card */}
          {effectiveness && effectiveness.total_recommendations_issued > 0 && (
            <SectionCard
              title="Adaptive Feedback & Intervention Effectiveness"
              subtitle="Closed-loop habit learning: future recommendation rankings adapt based on empirical focus shifts"
              icon={TrendingUp}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3.5 border border-[var(--border-subtle)]">
                    <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      Interventions Measured
                    </span>
                    <span className="block text-xl font-bold text-[var(--text-primary)]">
                      {effectiveness.total_measured_deltas}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {effectiveness.total_recommendations_issued} total issued
                    </span>
                  </div>

                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3.5 border border-[var(--border-subtle)]">
                    <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      Positive Focus Shifts
                    </span>
                    <span className="block text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {effectiveness.positive_outcomes_count}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {effectiveness.total_measured_deltas > 0
                        ? `${Math.round((effectiveness.positive_outcomes_count / effectiveness.total_measured_deltas) * 100)}% shift rate`
                        : 'Awaiting comparisons'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3.5 border border-[var(--border-subtle)]">
                    <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      Avg Focus Delta
                    </span>
                    <span
                      className={`block text-xl font-bold ${
                        (effectiveness.average_overall_focus_delta || 0) >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {effectiveness.average_overall_focus_delta !== null
                        ? `${effectiveness.average_overall_focus_delta >= 0 ? '+' : ''}${effectiveness.average_overall_focus_delta} pts`
                        : '—'}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">Across consecutive sessions</span>
                  </div>

                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3.5 border border-[var(--border-subtle)]">
                    <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      Feedback Loop Status
                    </span>
                    <span className="inline-block mt-1 rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-0.5 font-bold text-[11px] text-[var(--accent-primary)] uppercase">
                      {effectiveness.total_measured_deltas >= 1 ? 'Adaptive Active' : 'Learning Baseline'}
                    </span>
                    <span className="block text-[10px] text-[var(--text-muted)] mt-1">
                      {effectiveness.total_measured_deltas >= 1
                        ? 'Empirical adjustments active'
                        : 'Collecting telemetry'}
                    </span>
                  </div>
                </div>

                {/* Categorical Effectiveness Track Record */}
                {effectiveness.type_breakdown && effectiveness.type_breakdown.some((t) => t.measured_outcomes_count > 0) && (
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-2">
                    <span className="block font-mono text-[10px] font-bold uppercase text-[var(--text-secondary)]">
                      Empirical Intervention Track Record & Score Adjustments
                    </span>
                    <div className="flex flex-wrap gap-2 font-mono text-xs">
                      {effectiveness.type_breakdown
                        .filter((t) => t.total_issued > 0)
                        .map((item) => (
                          <div
                            key={item.recommendation_type}
                            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 flex items-center gap-2"
                          >
                            <span className="font-semibold text-[var(--text-primary)]">{item.title}</span>
                            <span
                              className={`font-bold text-[11px] ${
                                item.score_adjustment > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : item.score_adjustment < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-[var(--text-muted)]'
                              }`}
                            >
                              {item.score_adjustment > 0 ? `+${item.score_adjustment}` : item.score_adjustment} pts
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Recommendation History Stream */}
          <SectionCard
            title="Recommendation History & Follow-Through Stream"
            subtitle="Chronological log of issued recommendations, recorded follow-through, and focus changes"
            icon={History}
          >
            {history.length > 0 ? (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-[var(--bg-elevated)] text-[var(--text-secondary)] uppercase border-b border-[var(--border-subtle)]">
                      <tr>
                        <th className="px-4 py-2.5 font-bold">Session / Date</th>
                        <th className="px-4 py-2.5 font-bold">Recommendation</th>
                        <th className="px-4 py-2.5 font-bold">Persona</th>
                        <th className="px-4 py-2.5 font-bold">Follow-Through</th>
                        <th className="px-4 py-2.5 font-bold">Observed Focus Delta</th>
                        <th className="px-4 py-2.5 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {history.map((item) => (
                        <tr key={item.id} className="hover:bg-[var(--bg-elevated)]/60 transition">
                          <td className="px-4 py-3 whitespace-nowrap text-[var(--text-secondary)]">
                            <div className="font-semibold text-[var(--text-primary)]">
                              {item.issued_at
                                ? new Date(item.issued_at).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </div>
                            {item.source_session_id && (
                              <div className="text-[10px] text-[var(--text-muted)]">
                                Sess: {item.source_session_id.slice(0, 8)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-[var(--text-primary)]">{item.title}</div>
                            <div className="text-[11px] text-[var(--text-secondary)] line-clamp-1">{item.content}</div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-[var(--text-secondary)] whitespace-nowrap">
                            {item.behavioural_persona || '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRecordFollowed(item.id, true)}
                                disabled={recordingId === item.id}
                                title="Mark as followed"
                                className={`rounded px-2 py-1 text-[11px] font-bold transition ${
                                  item.recommendation_followed === true
                                    ? 'bg-emerald-600 text-white'
                                    : 'border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-emerald-500 hover:text-emerald-500'
                                }`}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRecordFollowed(item.id, false)}
                                disabled={recordingId === item.id}
                                title="Mark as not followed"
                                className={`rounded px-2 py-1 text-[11px] font-bold transition ${
                                  item.recommendation_followed === false
                                    ? 'bg-red-600 text-white'
                                    : 'border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-red-500 hover:text-red-500'
                                }`}
                              >
                                No
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-[var(--text-primary)] whitespace-nowrap">
                            {item.delta_focus_next_session !== null && item.delta_focus_next_session !== undefined
                              ? `${item.delta_focus_next_session >= 0 ? '+' : ''}${item.delta_focus_next_session} pts`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                item.outcome_status === 'measured'
                                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : item.outcome_status === 'pending'
                                  ? 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : 'border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                              }`}
                              title={
                                item.outcome_status === 'measured'
                                  ? 'Focus delta calculated from consecutive study session telemetry'
                                  : item.outcome_status === 'pending'
                                  ? 'Follow-through recorded; awaiting next completed study session to evaluate focus shift'
                                  : 'Follow-through unrecorded'
                              }
                            >
                              {item.outcome_status || 'unmeasured'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 p-3 text-[11px] text-[var(--text-muted)] leading-relaxed">
                  <span className="font-bold text-[var(--text-secondary)]">Observational Verification Note:</span> Each entry corresponds to an intervention issued for a specific completed study session. Focus deltas are strictly empirical comparisons across consecutive sessions with real telemetry, never fabricated or extrapolated.
                </div>
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
