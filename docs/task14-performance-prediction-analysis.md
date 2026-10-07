# Task 14 — Performance Prediction & Analysis

## Overview

Task 14 integrates and refines the **Performance Prediction & Analysis** layer within FocusSense AI. It uses the existing Task 11 `performance_regressor.joblib` (`GradientBoostingRegressor`) model served by `backend/app/services/ml_service.py` to estimate academic performance capacity derived from observed session activity telemetry and historical quiz baselines.

---

## Model Architecture & Ingestion

1. **Model Reuse**:
   - Reuses the `performance_regressor.joblib` artifact trained in Task 11 (`GradientBoostingRegressor`).
   - No second performance model is created, and no retraining or parameter modification is performed.
   - Prediction logic remains strictly centralized in `backend/app/services/ml_service.py`.

2. **Feature Input Vector**:
   - Consumes 10 structured feature inputs prepared via `ml/features/feature_pipeline.py`:
     - `total_session_duration` (seconds)
     - `productive_duration` (seconds)
     - `distraction_duration` (seconds)
     - `break_duration` (seconds)
     - `productive_activity_ratio` ($0.0 - 1.0$)
     - `distraction_activity_ratio` ($0.0 - 1.0$)
     - `activity_switch_count`
     - `activity_count`
     - `unique_application_count`
     - `quiz_score` (historical quiz average baseline)

---

## Separation of AI Predicted Performance vs. Actual Academic Records

The application explicitly distinguishes between measured academic performance and model-generated predictions:

| Dimension | AI Predicted Performance Score | Actual Academic Performance |
| :--- | :--- | :--- |
| **Source** | ML Regressor (`performance_regressor.joblib`) | Database records (`Quiz` & `PerformanceReport` tables) |
| **Type** | Model estimate ($0.0 - 100.0$) | Measured score & max scale (e.g. $88.5 / 100.0$) |
| **Purpose** | Continuous capacity estimate based on study patterns | Official historical grade or test metric |
| **UI Labeling** | `AI MODEL PREDICTION` | `ACTUAL ACADEMIC RECORD` |

---

## Telemetry Interpretation Rules & Limitations

1. **Association, Not Causality**:
   - Displays observed telemetry feature values (Productive Ratio, Distraction Ratio, Switching Frequency, Quiz Baseline) directly alongside model predictions.
   - Explicitly clarifies that displayed telemetry inputs represent **statistical model inputs and associations**, NOT causal claims.
   - Fixed causal statements such as *"higher focus ratio causes higher performance"* are strictly prohibited.

2. **Zero Explainability Libraries**:
   - No SHAP values, feature-importance matrices, heuristic coefficients, or external explainability engines are introduced.
   - All displayed feature values use deterministic calculations already present in `ml/features/feature_pipeline.py`.

---

## Bounding & Data Integrity Rules

1. **Output Clipping**:
   - Model predictions are safely bounded to $[0.0, 100.0]$ using `np.clip(raw_perf, 0.0, 100.0)` in `ml_service.predict_behaviour`.

2. **Missing Quiz Baseline Safeguard**:
   - Missing historical quiz scores are imputed via `SimpleImputer(strategy="median")` during feature preprocessing without inventing synthetic quiz records.

3. **Real-Data Gate**:
   - Performance predictions require `activity_count >= 1` and `total_duration_seconds > 0.0`. Sessions lacking activity telemetry return empty state UI notifications rather than fake predictions.

---

## Data Isolation & Role Permissions

1. **Student Isolation**:
   - Query filters strictly enforce `StudySession.student_id == current_user.student_id`.
   - Cross-student access attempts return `HTTP 404 Not Found`.

2. **Role Restrictions**:
   - Parent accounts are restricted per API authorization design (`HTTP 403 Forbidden` on student-scoped endpoints).

---

## Zero Database Schema Modifications

- The existing `BehaviouralAnalysis` SQLAlchemy entity already contains `performance_prediction` (`Float`), `feature_snapshot` (`JSON`), and `model_version` (`String`).
- No database schema alterations or migrations were required or performed for Task 14.

