import { CheckCircle2, GitBranch, Lightbulb, Sparkles } from 'lucide-react'
import { SectionCard } from '../../components/dashboard/SectionCard'
import { EmptyState } from '../../components/dashboard/EmptyState'

export function Recommendations() {
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
          Actionable habit adjustments personalized to your behavioural profile. The causal tracking
          engine measures whether recommendations were followed and quantifies subsequent focus uplift.
        </p>
      </section>

      {/* Novelty Layer 1 & 3: Active Interventions */}
      <SectionCard
        title="Active Interventions"
        subtitle="Current targeted recommendations and follow-through tracking"
        icon={Sparkles}
      >
        <EmptyState
          icon={Lightbulb}
          title="No recommendations generated yet"
          description="Personalized study suggestions (e.g., reducing context switching, scheduling focused blocks, or taking micro-breaks) will appear here after multiple recorded sessions."
        />
      </SectionCard>

      {/* Novelty Layer 2: Counterfactual Explanations Preview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Counterfactual Explanations"
          subtitle="Simulate behavioural changes and projected outcomes"
          icon={GitBranch}
        >
          <div className="rounded-xl border border-[#17221c]/10 bg-[#fbf9f4] p-5">
            <span className="font-mono text-[10px] font-bold text-[#4e6656] uppercase">
              What-If Analysis Preview
            </span>
            <p className="mt-1 text-xs text-[#405047] leading-relaxed">
              When study sessions are analyzed, you will be able to test scenarios such as:
            </p>
            <div className="mt-3 rounded-lg border border-[#17221c]/15 bg-white p-3 font-mono text-xs text-[#17221c]">
              "If interruptions were reduced from 7 to 2, predicted focus could increase from 64 to 81."
            </div>
            <p className="mt-3 text-[11px] text-[#405047]">
              Counterfactual models will evaluate SHAP feature importances to calculate bounded estimates.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Intervention Outcome Tracking"
          subtitle="Before/after delta focus measurement"
          icon={CheckCircle2}
        >
          <EmptyState
            icon={CheckCircle2}
            title="No intervention outcomes recorded"
            description="Tracks whether a recommended action was adopted and measures delta_focus_next_session to verify habit efficacy."
          />
        </SectionCard>
      </div>
    </div>
  )
}

