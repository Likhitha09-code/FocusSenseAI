# Task 17: Interactive Counterfactual Explanations

## Overview
Task 17 introduces an **Interactive Counterfactual Explorer ("What-If" Simulation)** for FocusSense AI. It enables authenticated students to explore how bounded, hypothetical adjustments to their recorded study session telemetry affect the predictions produced by the Task 11 scikit-learn models (`focus_regressor.joblib`, `distraction_classifier.joblib`, and `performance_regressor.joblib`).

## Key Capabilities & Safeguards

1. **Bounded Telemetry Adjustments & Mathematical Consistency**:
   - Students can adjust five session telemetry inputs within validated bounds:
     - `productive_duration` ($0 - 86,400$ seconds / $0 - 1,440$ minutes)
     - `distraction_duration` ($0 - 86,400$ seconds / $0 - 1,440$ minutes)
     - `break_duration` ($0 - 86,400$ seconds / $0 - 1,440$ minutes)
     - `activity_switch_count` ($0 - 500$)
     - `unique_application_count` ($1 - 100$)
   - Derived features (`total_session_duration`, `productive_activity_ratio`, and `distraction_activity_ratio`) are recomputed deterministically so the modified feature vector remains mathematically consistent before running model inference.
   - Simulations resulting in `total_session_duration <= 0` are rejected with `400 Bad Request`.

2. **Immutability of Recorded Data & Baseline Predictions**:
   - Counterfactual simulations are strictly read-only with respect to stored `StudySession`, `StudyActivity`, and `BehaviouralAnalysis` records.
   - Original `focus_score`, `distraction_level`, `performance_prediction`, and `feature_snapshot` values in PostgreSQL are never overwritten by a simulation.

3. **Explicit Hypothetical Framing**:
   - API responses include `is_hypothetical: true` and a non-causal `explanation_summary`.
   - The frontend UI displays a prominent `HYPOTHETICAL WHAT-IF SIMULATION` banner, side-by-side baseline vs. simulated comparisons, signed deltas, a **"Reset to Observed Baseline"** action, and an interpretation disclaimer stating that simulated outputs are model projections rather than measured outcomes or causal guarantees.

4. **Authorization & Privacy Isolation**:
   - `POST /api/v1/student/behaviour/counterfactual` requires `require_student`.
   - Students can only simulate analyses belonging to their own study sessions (`404 Not Found` for other students' analyses; `403 Forbidden` for parent accounts).

