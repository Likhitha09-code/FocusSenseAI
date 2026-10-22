# FocusSense AI — Final Project Presentation & Defense Outline

---

## Slide 1: Title & Executive Summary
- **Project Title:** FocusSense AI — Adaptive Behaviour Analysis & Interpretable Study Interventions
- **Tagline:** Measurable study habit analysis powered by explainable AI, interactive counterfactual simulations, and closed-loop adaptive recommendations.
- **Presenter:** Engineering Team
- **Core Value Proposition:** Unlike generic productivity timers or black-box classifiers, FocusSense AI links observed study telemetry directly to transparent feature attributions, bounded what-if exploration, and empirically validated habit recommendations that adapt to what actually improves each student's focus.

---

## Slide 2: Problem Statement & Motivation
- **The Modern Study Challenge:**
  - Students face intense digital fragmentation: frequent application switching, passive distractions, and study fatigue degrade retention and academic outcomes.
  - Conventional screen-time trackers (e.g., Apple Screen Time, Forest) only report descriptive aggregate hours without actionable pedagogical insights.
  - Traditional educational recommendation systems are static: they offer generic tips (e.g., "Take breaks") without verifying whether the student followed the advice or whether their focus actually improved.
- **The Explainability Void:**
  - Standard ML classifiers output opaque scores (e.g., "Focus: 68%") without explaining *why* the score was awarded or *how* the student can tangibly change their behavior to improve.

---

## Slide 3: Project Objectives
1. **Deterministic Telemetry Aggregation:** Ingest granular activity logs during study sessions and calculate verified behavioral metrics (productive ratio, distraction ratio, switch count).
2. **Interpretable ML Inferences:** Predict real-time Focus Scores, Distraction Levels, and Academic Performance using lightweight, rigorously evaluated models.
3. **Transparent Explainability:** Deliver signed feature attributions explaining the exact marginal impact of each telemetry variable on the focus score.
4. **Interactive Counterfactual Explorer:** Provide an exploratory "What-If" simulation allowing students to test hypothetical telemetry adjustments without mutating historical data.
5. **Closed-Loop Adaptive Feedback:** Track intervention follow-through and next-session focus deltas to personalize recommendation rankings using conservative Bayesian shrinkage.
6. **Privacy-Preserving Parent Supervision:** Enable high-level parental monitoring strictly bound by explicit, student-revocable consent.

---

## Slide 4: Existing Systems vs. FocusSense AI

| Feature / Dimension | Traditional Time Trackers | Generic Productivity Apps | FocusSense AI |
|---|---|---|---|
| **Measurement Approach** | Total clock time | Self-reported Pomodoros | Granular telemetry (switches, ratios, apps) |
| **AI / ML Intelligence** | None (Static rules) | Heuristic badges | Trained ensemble models (Random Forest, GBR) |
| **Model Explainability** | N/A | None | Signed SHAP / tree decision path attribution |
| **Interactive Simulation** | None | None | Bounded What-If counterfactual explorer |
| **Recommendation Engine** | Static generic tips | Pre-scripted reminders | Closed-loop adaptive feedback with Bayesian shrinkage |
| **Outcome Verification** | Unverified | User checkmark only | Next-session empirical focus delta tracking |
| **Parental Oversight** | Intrusive surveillance | None | Student-consented high-level progress tracking |

---

## Slide 5: System Architecture & Data Flow

```text
+------------------------------------------------------------------------+
|                          React / Vite Client                           |
|  [Student Dashboard] [Sessions] [Behaviour & SHAP] [Recommendations]   |
|  [Parent Dashboard & Consent] [Theme Tokens & Recharts Visualizations] |
+-----------------------------------+------------------------------------+
                                    | HTTPS / Bearer JWT
                                    v
+------------------------------------------------------------------------+
|                         FastAPI Backend API                            |
|    - Dependency Injection Gating (require_student, require_parent)     |
|    - Supabase Auth JWT Verification                                    |
|    - Real-Data Gating (>0 activity duration required)                  |
+-------------------+--------------------------------+-------------------+
                    |                                |
                    v                                v
+-------------------------------------+  +-------------------------------+
|         SQLAlchemy Repositories     |  |          ML Service           |
|  PostgreSQL / Supabase (12 Entities)|  | - Focus Regressor (RF)        |
|  - students, parents, student_links |  | - Distraction Classifier (RF) |
|  - study_sessions, study_activities |  | - Performance Regressor (GBR) |
|  - behavioural_analyses             |  | - Tree Attribution Engine     |
|  - recommendations, events, outcomes|  | - Counterfactual Simulator    |
+-------------------------------------+  +-------------------------------+
```

---

## Slide 6: Technology Stack

- **Frontend:**
  - Framework: React 19, Vite 8, Tailwind CSS 4
  - State & Routing: React Router 7, AuthContext, ThemeContext (Dark/Light mode)
  - Visualizations: Recharts 3 (interactive time-series, signed horizontal bar charts)
  - Icons & Styling: Lucide-react, CSS design tokens (`--bg-surface`, `--accent-primary`)
- **Backend:**
  - Framework: FastAPI (Python 3.11+ / 3.14 compatible)
  - ORM & Persistence: SQLAlchemy 2.0 (UUID primary keys, full relational mapping)
  - Database Driver: `psycopg` (v3 binary)
  - Data Validation: Pydantic v2 schemas
- **Machine Learning & Explainability:**
  - Libraries: scikit-learn, NumPy, Pandas, Joblib
  - Explainability: Dual-engine architecture (SHAP `TreeExplainer` with native tree decision path attribution engine fallback)
- **Database & Identity:**
  - Supabase PostgreSQL with Supabase Auth (row-level security and foreign key cascading)

---

## Slide 7: Machine Learning Approach & Pipeline

FocusSense AI employs three targeted, lightweight scikit-learn models trained on an offline behavioral dataset:

1. **Focus Score Regressor (`RandomForestRegressor`):**
   - 100 estimators, max depth 12.
   - Predicts a continuous focus rating ($0.0 - 100.0$) from 10 behavioral and academic features.
   - Validation Metrics: $R^2 = 0.864$, $\text{RMSE} = 6.11$, $\text{MAE} = 4.84$.
2. **Distraction Level Classifier (`RandomForestClassifier`):**
   - 100 estimators, max depth 10.
   - Predicts ordinal category (`LOW`, `MEDIUM`, `HIGH`).
   - Validation Metrics: Accuracy = $93.0\%$, Macro $F_1 = 0.817$.
3. **Academic Performance Regressor (`GradientBoostingRegressor`):**
   - 100 estimators, learning rate 0.08, max depth 5.
   - Predicts estimated subject mastery ($0.0 - 100.0\%$).
   - Validation Metrics: $R^2 = 0.770$, $\text{MAE} = 4.66$.

**Feature Inputs (10 dimensions):**
- Durations: `total_session_duration`, `productive_duration`, `distraction_duration`, `break_duration`.
- Ratios: `productive_activity_ratio`, `distraction_activity_ratio`.
- Context & Focus Stability: `activity_switch_count`, `activity_count`, `unique_application_count`.
- Academic Baseline: `quiz_score` (imputed safely when unrecorded).

---

## Slide 8: Explainable AI & Feature Attribution

### Mathematical Efficiency Guarantee
Feature attributions provide an exact additive decomposition of the model prediction:
$$\text{Base Value} + \sum_{i=1}^{10} \phi_i = \text{Predicted Focus Score}$$
Evaluated on the Focus Score model, this equality holds within $< 10^{-14}$ floating-point precision.

### Dual-Engine Explainability Architecture
1. **Primary SHAP Engine:**
   - If the `shap` package is present, the service initializes `shap.TreeExplainer(model)` to compute tree Shapley values.
2. **Native Tree Decision Path Engine (Fallback):**
   - If running in environments where binary wheels for external C-extensions are unavailable (e.g. Python 3.14 pre-release on Windows), the service executes an internal, mathematical tree traversal algorithm (`_tree_path_attribution_forest`).
   - Traverses each decision tree's decision path from root to leaf, accumulating marginal conditional expectation shifts $\Delta v = v_{\text{child}} - v_{\text{parent}}$ across all estimators.
   - **Zero Fabrication:** Neither empty nor simulated values are used; the attribution reflects the exact tree splits of the model artifact.

### User Interface Presentation
- **Signed Horizontal Bar Chart:** Green bars indicate positive focus contributors; red bars indicate negative drivers.
- **Interactive Tooltip:** Shows the exact observed telemetry value alongside its point attribution.
- **Plain-Language AI Summary:** Synthesizes the primary positive and negative factors into conversational insights.

---

## Slide 9: Interactive Counterfactual Explorer ("What-If" Simulation)

- **Purpose:** Bridges predictive analytics and behavioral change by allowing students to explore the impact of potential habit improvements before adopting them.
- **Mechanism:**
  - Student adjusts 5 bounded sliders: Productive Time ($0 - 1,440$ min), Distraction Time ($0 - 1,440$ min), Break Time ($0 - 1,440$ min), Switches ($0 - 500$), Unique Apps ($1 - 100$).
  - Service deterministically recalculates total duration and activity ratios to ensure mathematical consistency.
  - Re-evaluates the trained scikit-learn pipeline in real time.
- **Key Safeguards:**
  - **Non-Mutation:** Original session records, actual focus scores, and PostgreSQL rows remain 100% immutable.
  - **Explicit Framing:** Responses carry `is_hypothetical: true` with a clear disclaimer that projections are model estimations rather than causal guarantees.

---

## Slide 10: Adaptive Recommendation Closed-Loop Feedback

### How the Feedback Loop Closes
1. **Recommendation Event:** An intervention (e.g., `"Minimize Distraction Traps"`) is selected based on behavioral persona and stored in `recommendation_events`.
2. **Follow-Through Recording:** The student logs whether they followed the recommendation (`recommendation_followed: true/false`).
3. **Outcome Evaluation:** When the student completes their next study session, the system automatically computes:
   $$\Delta \text{Focus} = \text{Focus}_{\text{next}} - \text{Focus}_{\text{source}}$$
4. **Adaptive Candidate Re-Ranking:**
   $$\text{Rank Score} = \text{Base Score}(\text{Persona}) + \text{Adjustment}$$
   - **Bayesian Shrinkage:** Dampens small sample sizes with prior pseudo-count $K = 2.0$:
     $$w = \frac{N}{N + 2.0}, \quad \text{Delta Signal} = \text{clip}(w \cdot \bar{\Delta}, -5.0, +5.0)$$
   - Repeatedly ineffective interventions drop in ranking; secondary alternatives with positive track records are promoted (`selector_version="v1.1-adaptive"`).
5. **Student-Level Isolation:** All outcome queries filter strictly by `student_id`. One student's results never bias another student's recommendations.

---

## Slide 11: Privacy, Security & Parental Consent

- **Role-Based Access Control (RBAC):**
  - Managed via FastAPI dependency injection: `require_student` and `require_parent`.
  - Roles are verified from verified database profile bindings, never trusted from client payloads.
- **Opt-In Student Consent Model:**
  - Parents cannot view student telemetry by simply entering a Student ID.
  - Linking initiates a `pending` consent state.
  - The student must explicitly review and grant consent from their profile.
  - If consent is `revoked`, all parent progress endpoints return `HTTP 403 Forbidden` with zero information leakage.
- **Database Identity Decoupling:**
  - Supabase Auth UUIDs are kept distinct from application profile UUIDs (`auth_user_id` mapping).
  - All foreign keys enforce cascading deletes or set-null constraints to prevent orphaned telemetry.

---

## Slide 12: Testing & Verification Summary

The codebase has undergone automated testing against an isolated test harness (zero test writes to live production Supabase):

- **Backend Test Suite (Pytest):**
  - **Total Tests:** **63 passing tests** (0 failures, 5 non-blocking deprecation warnings).
  - Execution Time: ~9.0 seconds.
  - Coverage Areas:
    - `test_auth.py` (18 tests): Authentication, profile provisioning, token extraction, role isolation.
    - `test_ml_pipeline.py` (13 tests): Preprocessor transformations, leakage checks, SHAP efficiency, counterfactual immutability.
    - `test_recommendations.py` (13 tests): Catalog seeding, persona rules, Bayesian shrinkage, positive/negative adaptation, student isolation.
    - `test_student_api.py` (10 tests): Activity lifecycle, telemetry summaries, subject and quiz progress.
    - `test_parent_portal.py` (4 tests): Consent states (`pending`, `active`, `revoked`), multi-student management.
    - `test_study_workflow_e2e.py` (5 tests): Full session lifecycle, ML inference, and dashboard synchronization.
- **Frontend Code Quality & Production Build:**
  - `npm run lint` (`oxlint`): **0 errors** across all React components.
  - `npm run build` (`vite build`): Production bundle compiled cleanly in $< 1$ second.

---

## Slide 13: Technical Limitations & Transparent Disclaimers

1. **Synthetic Training Baseline:**
   - The current model weights were trained on a controlled 10,000-sample synthetic dataset for offline benchmarking. Predictions are for educational guidance and do not represent clinically diagnostic instruments.
2. **Observational vs. Randomized Causality:**
   - Next-session focus deltas reflect chronological observational comparisons across consecutive sessions rather than randomized controlled trials. Confounding variables (sleep, subject difficulty) may influence focus shifts.
3. **Desktop Activity Boundary:**
   - Current telemetry relies on application session logging rather than an active background operating system daemon or kernel-level window hook.
4. **Network & Pre-compiled Wheels:**
   - In environments without binary wheels for Python 3.14, the native tree path attribution engine operates as an exact, mathematically faithful substitute for external compiled SHAP libraries.

---

## Slide 14: Future Scope & Roadmap

1. **Lightweight Desktop Agent / Window Tracker:**
   - Implement a cross-platform background daemon (using `pygetwindow` or native OS APIs) to record active window switches and application focus automatically.
2. **Multi-Session Contextual Deep Learning:**
   - Train sequential models (LSTM or Transformer-based) to capture circadian rhythms, optimal time-of-day study slots, and cumulative study fatigue across multi-week periods.
3. **Hierarchical Bayesian Adaptive Bandits:**
   - Upgrade the current heuristic shrinkage selector to a multi-armed contextual bandit (e.g. Thompson Sampling or LinUCB) for optimal exploration-exploitation trade-offs.
4. **Mobile Companion Application:**
   - Expand the React frontend into a cross-platform Flutter or React Native mobile client for on-the-go study session tracking and push notifications.

---

## Slide 15: Conclusion & Demonstration Q&A

- **Key Takeaways:**
  - FocusSense AI is a complete, full-stack educational AI system with working authentication, telemetry collection, machine learning inferences, and privacy guards.
  - Solves the black-box AI dilemma through **additive SHAP tree attribution** and **counterfactual what-if simulations**.
  - Closes the pedagogical intervention loop by testing, adapting, and ranking recommendations based on **measured student focus deltas**.
  - Backed by **63 automated tests** and a clean production build.
- **Thank you! We welcome questions and live demonstration requests.**

