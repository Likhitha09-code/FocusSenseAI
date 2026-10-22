import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Brain,
  Clock,
  GitBranch,
  Lock,
  LogIn,
  Moon,
  Orbit,
  Sparkles,
  Sun,
  TrendingUp,
  UserCheck,
  UserPlus,
  Zap,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export function Landing() {
  const { user, profile } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const destinationPortal =
    profile?.role === 'student' ? '/app/student/dashboard' : '/app'

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] antialiased transition-colors">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 transition hover:opacity-90">
            <div className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent-primary)] shadow-sm">
              <Brain size={22} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-sm font-extrabold tracking-widest text-[var(--text-primary)] uppercase">
                FocusSense AI
              </span>
              <span className="text-[10px] font-medium tracking-wider text-[var(--text-muted)] uppercase">
                Study Intelligence
              </span>
            </div>
          </Link>

          {/* Nav Links / Actions */}
          <nav className="flex items-center gap-2.5 sm:gap-4">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-mono text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            >
              {theme === 'dark' ? (
                <>
                  <Sun size={14} className="text-[var(--status-warning)]" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon size={14} className="text-[var(--accent-primary)]" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {user && profile ? (
              <Link
                to={destinationPortal}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2 font-mono text-xs font-bold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)] shadow-sm"
              >
                <UserCheck size={14} />
                <span>Open {profile.role === 'student' ? 'Student' : 'Parent'} Portal</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-1.5 font-mono text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]"
                >
                  <LogIn size={14} />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 py-1.5 font-mono text-xs font-bold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)] shadow-sm"
                >
                  <UserPlus size={14} />
                  <span>Get Started</span>
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        {/* Subtle background glow */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-full max-w-4xl -translate-x-1/2 rounded-full bg-[var(--accent-soft)] blur-3xl opacity-50" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Column: Headlines & CTA */}
            <div className="lg:col-span-7">
              {/* Status Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3.5 py-1.5 text-xs font-semibold text-[var(--accent-primary)] shadow-sm">
                <Sparkles size={14} />
                <span>Explainable AI & Counterfactual Habit Modeling</span>
              </div>

              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-6xl sm:leading-[1.1]">
                Master your focus with{' '}
                <span className="bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-ai)] bg-clip-text text-transparent">
                  verifiable data.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
                FocusSense AI transforms raw study telemetry into interpretable behavioural insights.
                Discover which habits maximize productivity, explore counterfactual what-if scenarios,
                and receive adaptive intervention recommendations.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-6 py-3.5 font-mono text-xs font-bold text-[var(--accent-contrast)] uppercase tracking-wider transition hover:bg-[var(--accent-hover)] shadow-md"
                >
                  <span>Start Free Study Tracking</span>
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-3.5 font-mono text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider transition hover:bg-[var(--bg-elevated)]"
                >
                  <span>Log Into Portal</span>
                </Link>
              </div>

              {/* Quick Proof Pillars */}
              <div className="mt-12 grid grid-cols-3 gap-4 border-t border-[var(--border-subtle)] pt-8">
                <div>
                  <div className="font-mono text-xl font-extrabold text-[var(--text-primary)] sm:text-2xl">
                    100%
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">Interpretable Insights</div>
                </div>
                <div>
                  <div className="font-mono text-xl font-extrabold text-[var(--status-success)] sm:text-2xl">
                    SHAP
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">Feature Attributions</div>
                </div>
                <div>
                  <div className="font-mono text-xl font-extrabold text-[var(--accent-ai)] sm:text-2xl">
                    Task 17
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">What-If Simulation</div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Product Mockup */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-xl">
                {/* Mock Card Header */}
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="size-3 rounded-full bg-[var(--status-success)]" />
                    <span className="font-mono text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Live Session Analysis
                    </span>
                  </div>
                  <span className="rounded-md bg-[var(--status-success-soft)] border border-[var(--status-success-border)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--status-success)]">
                    Model v1.2 Active
                  </span>
                </div>

                {/* Score Showcase */}
                <div className="mt-6 flex items-center justify-between rounded-xl bg-[var(--bg-elevated)] p-4 border border-[var(--border-subtle)]">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                      Calculated Focus Index
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-mono text-3xl font-extrabold text-[var(--text-primary)]">
                        88.4
                      </span>
                      <span className="text-xs font-semibold text-[var(--status-success)]">
                        +6.2% vs avg
                      </span>
                    </div>
                  </div>
                  <div className="grid size-12 place-items-center rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent-primary)]">
                    <TrendingUp size={22} />
                  </div>
                </div>

                {/* Simulated Counterfactual Prediction */}
                <div className="mt-4 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-primary)] uppercase tracking-wider font-mono">
                    <Zap size={14} />
                    <span>Counterfactual What-If</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                    Reducing activity switches from <strong className="text-[var(--text-primary)]">14</strong> to{' '}
                    <strong className="text-[var(--text-primary)]">4</strong> elevates predicted focus score to{' '}
                    <strong className="text-[var(--status-success)]">94.8%</strong>.
                  </p>
                </div>

                {/* Simulated Telemetry Feed */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>Study Session Telemetry</span>
                    <span className="font-mono text-[11px]">45m logged</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-elevated)] p-2.5 text-xs text-[var(--text-secondary)]">
                    <Clock size={14} className="text-[var(--accent-primary)]" />
                    <span>Deep Work: 38 mins uninterrupted</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-elevated)] p-2.5 text-xs text-[var(--text-secondary)]">
                    <Activity size={14} className="text-[var(--status-success)]" />
                    <span>Distraction Index: Low (1 switch detected)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--accent-primary)]">
              Core Capabilities
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              Engineered for academic momentum.
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-base text-[var(--text-secondary)]">
              FocusSense AI combines non-intrusive session tracking, explainable ML models, and
              interactive simulations to optimize your learning velocity.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Feature 1 */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 transition hover:border-[var(--border-strong)] hover:shadow-md">
              <div className="grid size-11 place-items-center rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent-primary)]">
                <Activity size={20} />
              </div>
              <h3 className="mt-5 text-base font-bold text-[var(--text-primary)]">
                Session Telemetry
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                Log productive focus, idle pauses, and tab switches in real time. Maintain continuous
                session history without intrusive screen capture.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 transition hover:border-[var(--border-strong)] hover:shadow-md">
              <div className="grid size-11 place-items-center rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent-primary)]">
                <Orbit size={20} />
              </div>
              <h3 className="mt-5 text-base font-bold text-[var(--text-primary)]">
                SHAP Explainability
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                Understand why a session received its focus score. Transparent Shapley feature values
                identify exact contributing factors.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 transition hover:border-[var(--border-strong)] hover:shadow-md">
              <div className="grid size-11 place-items-center rounded-xl bg-[var(--accent-ai-soft)] border border-[var(--accent-ai-border)] text-[var(--accent-ai)]">
                <GitBranch size={20} />
              </div>
              <h3 className="mt-5 text-base font-bold text-[var(--text-primary)]">
                What-If Simulation
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                Interactively adjust distraction minutes and activity switch counts to see how small
                habit improvements lift predicted performance.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 transition hover:border-[var(--border-strong)] hover:shadow-md">
              <div className="grid size-11 place-items-center rounded-xl bg-[var(--status-success-soft)] border border-[var(--status-success-border)] text-[var(--status-success)]">
                <Lock size={20} />
              </div>
              <h3 className="mt-5 text-base font-bold text-[var(--text-primary)]">
                Privacy-First Consent
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                Role-based architecture with consent-driven links. Students maintain privacy while
                parents stay informed on academic milestones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Parent Portal Section */}
      <section className="border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
            <div className="space-y-1.5 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-0.5 font-mono text-[11px] font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
                Parental Supervision Portal
              </span>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">
                Supervise Study Progress with Verified Student Consent
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Parents and guardians can review study durations, focus stability indices, and subject-level performance summaries. Access is role-protected and strictly requires student authorization.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                to="/register"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 font-mono text-xs font-bold text-[var(--accent-contrast)] uppercase tracking-wider transition hover:bg-[var(--accent-hover)] shadow-xs"
              >
                <span>Register Parent Account</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture & Tech Trust Section */}
      <section className="border-t border-[var(--border-subtle)] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 sm:flex-row">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Modern Full-Stack Foundation
              </span>
              <h3 className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                FastAPI • Scikit-Learn • Supabase Auth • React & Tailwind CSS
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 font-mono text-xs font-bold text-[var(--accent-contrast)] uppercase tracking-wider transition hover:bg-[var(--accent-hover)] shadow-sm"
              >
                <span>Create Account</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-8 text-xs text-[var(--text-secondary)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-[var(--accent-primary)]" />
            <span className="font-mono font-bold text-[var(--text-primary)] uppercase">
              FocusSense AI
            </span>
            <span>— Intelligent Study Behaviour Platform</span>
          </div>
          <div className="flex items-center gap-4 text-[var(--text-muted)] font-mono text-[11px]">
            <span>Task 17 Counterfactual Engine</span>
            <span>•</span>
            <span>FastAPI Backend Active</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
