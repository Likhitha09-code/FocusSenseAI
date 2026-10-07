# Task 12 — Behaviour Analysis Integration & Student Insight Flow Technical Documentation

## 1. Objective

Task 12 integrates the existing Task 11 scikit-learn ML behaviour-analysis pipeline into a clean student-facing behaviour insight flow. The implementation connects completed study sessions, activity telemetry aggregation, feature extraction, academic quiz score enrichment, ML model inference, analysis persistence, and student UI presentation.

Strict scope boundaries were enforced:
- **No new ML models**: Reused existing Task 11 scikit-learn artifacts (`focus_regressor.joblib`, `distraction_classifier.joblib`, `performance_regressor.joblib`, `preprocessor.joblib`).
- **No SHAP or Counterfactuals**: Deferred strictly to future tasks.
- **No Recommendation Engine or Causal Analysis**: Deferred strictly to future tasks.
- **No OS Monitoring / Keyloggers**: Kept within existing in-app telemetry logging.

---

## 2. End-to-End Insight Pipeline Architecture

```text
Completed Study Session
        ↓
Activity Summary (aggregate_session_activities)
        ↓
Feature Vector Extraction (extract_session_behaviour_features)
        ↓
Academic Enrichment (enrich_features_with_academic_data -> quiz_score)
        ↓
Real-Data Gate Verification (activity_count >= 1 & total_duration_seconds > 0)
        ↓
Existing ML Service Boundary (predict_behaviour)
        ↓
Behavioural Analysis DB Record (BehaviouralAnalysis)
        ↓
Student Insight Flow & Presentation (Behaviour.jsx / StudentDashboard.jsx)
```

---

## 3. Separation of Observed Metrics vs. AI Predictions

To maintain scientific transparency and prevent misleading presentation:

### A. Observed Telemetry Metrics (Measurements)
Extracted directly from recorded in-app session activity:
- `total_session_duration` (Total elapsed time)
- `productive_duration` & `productive_activity_ratio`
- `distraction_duration` & `distraction_activity_ratio`
- `break_duration`
- `activity_switch_count` (Window switch frequency)
- `activity_count` (Total logged activities)
- `unique_application_count` (Distinct tools/apps used)
- `quiz_score` (Enriched academic quiz average or `None` if unrecorded)

### B. AI Model Predictions (Inferences)
Generated strictly by ML models loaded from `ml/models/artifacts/`:
- `focus_score` (RandomForestRegressor estimate, 0.0 – 100.0)
- `distraction_level` (RandomForestClassifier rating: `LOW`, `MEDIUM`, `HIGH`)
- `performance_prediction` (GradientBoostingRegressor estimate, 0.0 – 100.0)
- `model_version` (Version `v1.0`)
- `analyzed_at` (UTC timestamp)

---

## 4. Session-to-Analysis Linking & Schema Extensions

The `BehaviourAnalysisResponse` Pydantic schema and `BehaviouralAnalysis` ORM model were extended to link each analysis directly to its source study session context:

- `study_session_id`: Source study session UUID.
- `session_started_at`: Timestamp when the study session was initiated.
- `subject_name`: Enrolled academic subject associated with the session (if enrolled).
- `analyzed_at`: Timestamp when the ML analysis was generated.

Queries in `student_service.py` (`list_behavioural_analyses`, `get_behavioural_analysis`) use `joinedload(BehaviouralAnalysis.study_session).joinedload(StudySession.subject)` for optimal single-query data loading without N+1 overhead.

---

## 5. Security & Ownership Protection

- **Role Protection**: All behaviour endpoints (`/api/v1/student/behaviour`) require authenticated users with the `student` role (`require_student`).
- **Student Ownership Isolation**: Students can only retrieve behavioural analyses linked to study sessions that they own (`StudySession.student_id == current_user.student_id`). Unowned analysis attempts return `HTTP 404 Not Found`.
- **Parent Access**: Parents are forbidden from student-scoped endpoints (`HTTP 403 Forbidden`).

---

## 6. Empty & Error States

The insight flow cleanly handles 6 boundary states without displaying fake zeros or fabricating default predictions:

1. **No Completed Sessions**: API returns an empty list `[]`. Frontend displays `"No behavioural analysis recorded yet"`.
2. **Session with Zero Telemetry**: Real-Data Gate rejects analysis generation (`HTTP 400 Bad Request` with message `"Insufficient activity telemetry data"`).
3. **Short Activity Duration**: Requires total duration > 0.0s.
4. **Missing Quiz Score**: `quiz_score` is set to `None` and imputed via `SimpleImputer(strategy="median")` in the ML preprocessor. Frontend displays `"Unrecorded (Imputed)"`.
5. **No Previous Analysis**: Student Dashboard metrics display `"No study data yet"` / `"Not evaluated yet"`.
6. **API Failure**: Displays a friendly error alert with an interactive "Retry" button.

---

## 7. Verification & Tests Performed

Backend tests in `backend/tests/test_ml_pipeline.py` (28/28 passed):
- Synthetic dataset reproducibility & leakage checks
- Feature DataFrame column ordering
- ML prediction bounds & validity ($0-100$ focus/performance, categorical distraction)
- Real-Data Gate rejection ($400$ state)
- Session-to-analysis linking (`study_session_id`, `session_started_at`, `subject_name`)
- Single-student ownership isolation & parent rejection ($404$ / $403$)
- Empty database state returning empty list `[]`

Frontend checks (`frontend/`):
- `npm run lint` $\rightarrow$ **0 ERRORS**
- `npm run build` $\rightarrow$ **Production build succeeded in 695ms**
- `GET /health` $\rightarrow$ **HTTP 200**
- `GET /docs` $\rightarrow$ **HTTP 200**
- `GET /openapi.json` $\rightarrow$ **HTTP 200**

---

## 8. Limitations & Initial Model Disclaimer

> [!IMPORTANT]
> All ML models were trained offline on an initial 10,000-sample synthetic benchmark dataset (`random_state=42`). Model predictions are presented in the user interface with clear `v1.0` version badges and development model disclaimers. They provide educational reference and are not presented as clinically or academically validated ground truth.

