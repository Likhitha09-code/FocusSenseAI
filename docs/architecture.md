# FocusSense AI Architecture

## Scope

The system analyzes study behaviour across sessions and preserves the link between a recommendation, whether it was followed, and the next measurable outcome. The first release stays feasible by using interpretable classical models and a lightweight adaptive recommendation strategy.

## System architecture

```text
React/Vite client
        |
        v
FastAPI API  ---- Supabase Auth token verification
        |
        +---- SQLAlchemy repositories ---- PostgreSQL (Supabase)
        +---- ML service boundary
                    +---- focus score model
                    +---- distraction classifier
                    +---- performance model
                    +---- SHAP explainability
                    +---- counterfactual analysis
                    +---- adaptive recommendation selector
```

The frontend owns presentation and user interactions. FastAPI owns authenticated request handling, orchestration, validation, and persistence boundaries. ML modules remain independently testable and do not own database or HTTP concerns.

Supabase Auth owns authentication credentials. A verified Auth user UUID is mapped to exactly one application profile in `students` or `parents` through `auth_user_id`; profile IDs remain separate database identities. The backend derives the role from that profile lookup and does not trust client-provided role or user IDs. The frontend uses only the Supabase URL and anon key. The service-role key is backend-only.

## Data flow

1. A student starts a study session for a subject.
2. Behavioural activities are collected during the session.
3. Feature engineering converts session activities and context into model inputs.
4. The ML service produces focus score, distraction level, and performance predictions.
5. SHAP values and counterfactual analysis explain the predictions.
6. The recommendation engine selects a recommendation using the student's history and current behavioural persona.
7. The recommendation event is stored before the student acts on it.
8. Follow-through is recorded, followed by the next-session outcome and `delta_focus_next_session`.

## ML pipeline

The three prediction tasks use lightweight, interpretable scikit-learn models where appropriate. Training and evaluation code will be separated from inference code. No sequential deep-learning model is required for the architecture.

Feature engineering must produce a versioned feature set so that explanations and later evaluation can identify which inputs produced a prediction. SHAP is the standard explanation path. Counterfactual analysis changes selected behavioural features within valid bounds, reruns the actual model, and returns the changed prediction plus a concise explanation.

## Causal/intervention feedback loop

Every recommendation is an intervention record linked to a student and source session. The record stores its content, selection reason, timestamp, and model/persona context. A separate outcome record stores `recommendation_followed`, the next-session result, and `delta_focus_next_session`.

Early analysis will report within-student before/after comparisons and uplift-style summaries grouped by recommendation type and behavioural persona. These are estimates, not claims of randomized causality; confounders and sample size must be shown with the result.

## Adaptive recommendation loop

The initial selector combines behavioural personas with rules and historical outcome rates. It starts with safe exploration among eligible recommendations, then gives more weight to recommendations that improved the same student's subsequent outcome. History is per student and recommendation type, so personalization is based on observed follow-through and results rather than generic productivity assumptions.

## Counterfactual explanation flow

```text
current session features
        -> prediction
        -> SHAP contributions
        -> user changes selected features
        -> bounded/validated feature vector
        -> same model prediction
        -> delta + natural-language explanation
```

Counterfactuals are interactive what-if analyses, not recommendations by themselves. The API must expose allowed feature bounds and preserve the original feature vector for auditability.

## Delivery boundaries

Authentication, route handlers, repositories, model services, recommendation services, and intervention analysis should be separate modules. Supabase credentials are supplied through environment variables and are never embedded in source code.

## REST API Layer (Task 7)

The backend provides a type-safe FastAPI REST API mounted under `/api/v1`:

- `/api/v1/auth`: Token verification (`/me`) and initial profile provisioning (`/provision/student`, `/provision/parent`).
- `/api/v1/student`: Protected student-scoped endpoints guarded by `require_student`:
  - `/dashboard`: Real-time summary metrics, active session, recent sessions, behaviour, performance, and recommendations.
  - `/sessions`: Study session management (list, create, get, patch).
  - `/sessions/{id}/activities`: Raw behavioural activity telemetry events.
  - `/behaviour` & `/behaviour/analysis`: Fine-grained session behaviour records and aggregate behaviour analysis.
  - `/performance`: Periodic academic performance reports.
  - `/subjects` & `/quizzes`: Subject enrollments and quiz progress logs with strict ownership verification.
  - `/recommendations`: Intervention recommendations, presentation events (`/events`), and causal outcome records (`/events/{id}/outcomes`).

All endpoints strictly enforce student ownership, return real zero/empty/null structures when no data exists (no mock data), and protect cross-tenant privacy by returning `404 Not Found` for unowned resources.

## Activity Collection & Behaviour Feature Pipeline (Task 10)

The activity telemetry and feature extraction pipeline connects student session logging to future ML model consumption:

```text
Study Session
      ↓
Study Activity Records (POST/GET /api/v1/student/sessions/{id}/activities)
      ↓
Activity Aggregation (GET /api/v1/student/sessions/{id}/activities/summary)
      ↓
Behavioural Feature Vector (extract_session_behaviour_features)
      ↓
[Future Stage: ML Focus Score Model & Distraction Classifier]
Behavioural Feature Vector (extract_session_behaviour_features)
      ↓
Academic Enrichment (enrich_features_with_academic_data -> quiz_score)
      ↓
Real-Data Gate (activity_count >= 1 & total_duration_seconds > 0)
      ↓
ML Service Boundary (predict_behaviour -> Preprocessor + 3 joblib artifacts)
      ↓
Model Inferences: Focus Score (0-100), Distraction Level (LOW/MEDIUM/HIGH), Performance Score (0-100)
      ↓
Persistence (behavioural_analyses DB table) & Student UI Presentation
```

Feature extraction generates a deterministic, reproducible input vector (`total_session_duration`, `productive_duration`, `distraction_duration`, `break_duration`, `productive_activity_ratio`, `distraction_activity_ratio`, `activity_switch_count`, `activity_count`, `unique_application_count`). The ML prediction models remain intentionally deferred to subsequent ML-focused tasks.
## AI/ML Behaviour Analysis Pipeline (Task 11)

Task 11 implements the scikit-learn ML inference pipeline for FocusSense AI:

1. **Feature Engineering & Enrichment**: Combines 9 deterministic activity telemetry features with student academic records (`quiz_score`) via `enrich_features_with_academic_data()`. If no quiz score is available, `SimpleImputer(strategy="median")` handles imputation cleanly.
2. **Real-Data Gate**: ML inference runs **only** when `activity_count >= 1` and `total_duration_seconds > 0`. If a session lacks activity telemetry, the backend returns an explicit `400 Bad Request` and the frontend displays `"Not enough activity data to generate an AI analysis yet"`. Fake/random predictions are strictly prohibited.
3. **Artifact Persistence & Prediction Service**: Scikit-learn models (`focus_regressor.joblib`, `distraction_classifier.joblib`, `performance_regressor.joblib`, `preprocessor.joblib`) are persisted in `ml/models/artifacts/` and loaded as singleton models in `backend/app/services/ml_service.py`.
4. **Target Leakage Prevention**: Input feature set (`FEATURE_NAMES`) is strictly separated from target outputs (`focus_score`, `distraction_level`, `performance_score`). Verified via unit test suite (`verify_no_target_leakage()`).
5. **Synthetic Development Disclaimer**: Initial models are trained on a reproducible 10,000-session synthetic dataset (`random_state=42`) for offline benchmarking. Models are clearly labeled as development initial models in API responses (`model_version: "v1.0"`).

## Behaviour Analysis Integration & Student Insight Flow (Task 12)

Task 12 integrates the Task 11 ML inference pipeline into a student-facing insight flow:

1. **Session-to-Analysis Linking**: Each `BehaviouralAnalysis` is linked directly to its source `StudySession` (including `session_started_at` and `subject_name`), preventing record duplication and enabling clear tracking.
2. **Clear Separation of Telemetry vs Predictions**: The UI strictly separates observed telemetry measurements (productive/distraction time, switch frequency, app counts) from AI model predictions (focus score, distraction rating, performance prediction).
3. **Empty & Error Handling**: Gracefully handles unanalyzed sessions, zero activity telemetry, and missing quiz data without generating fake scores.
4. **Student Privacy Isolation**: Enforces student ownership at the DB query level using `StudySession.student_id == current_user.student_id`, rejecting cross-student access ($404$) and unauthorized parent roles ($403$).

## Focus & Distraction Scoring (Task 13)

Task 13 implements a clean student-facing Focus and Distraction scoring presentation layer:

1. **Focus Score Bounding**: `focus_score` predicted by the existing `RandomForestRegressor` is safely bounded to $[0.0, 100.0]$ at the inference layer (`ml_service.py`) via `np.clip(raw_focus, 0.0, 100.0)`.
2. **Explicit Distraction Class Validation**: Distraction levels remain strictly `LOW`, `MEDIUM`, or `HIGH`. If an unexpected class string is produced, `ml_service.py` raises an explicit `ValueError` rather than masking the issue.
3. **Model Reuse**: Reuses existing Task 11 model artifacts (`focus_regressor.joblib` & `distraction_classifier.joblib`) without retraining or modifying model weights.
4. **Real-Data Gate Preservation**: Inference runs strictly when `activity_count >= 1` and `total_duration_seconds > 0.0`, preventing fake score generation for empty sessions.

## Performance Prediction & Analysis (Task 14)

Task 14 implements the student-facing Performance Prediction & Analysis presentation layer:

1. **Model Reuse**: Reuses the Task 11 `performance_regressor.joblib` (`GradientBoostingRegressor`) served by `backend/app/services/ml_service.py` without retraining or creating secondary models.
2. **AI vs. Actual Distinction**: Clearly separates AI Predicted Performance (continuous $0.0 - 100.0$ ML regressor estimate) from Actual Academic Performance (`Quiz` & `PerformanceReport` records).
3. **Telemetry Interpretation Limits**: Displays observed feature values alongside predictions with explicit disclaimers that observed telemetry represents model input associations rather than causal claims. Excludes SHAP, feature-importance metrics, and external explainability libraries.
4. **Bounds & Zero-Schema Impact**: Bounds performance prediction outputs to $[0.0, 100.0]$ via `np.clip(raw_perf, 0.0, 100.0)`. Performs zero database schema modifications.

## Lightweight Adaptive Recommendation Engine (Task 15)

Task 15 implements the personalized recommendation and habit adjustment layer:

1. **Deterministic Persona Classification**: Maps telemetry and ML predictions into non-clinical project personas (`HIGHLY_DISTRACTED`, `CONTEXT_SWITCHER`, `FATIGUED_STUDIER`, `LOW_ACADEMIC_RETENTION`, `HIGH_PERFORMER`, `BALANCED_STUDIER`) using transparent rule thresholds.
2. **Context Snapshot Persistence**: Stores `RecommendationEvent` records capturing a frozen snapshot of feature inputs (`selection_context`), `selector_version="v1.0"`, and `behavioural_persona`.
3. **Outcome Integrity**: Prevents premature or fake outcome creation. Outcome fields remain unset (`None`) until real follow-through events are recorded.
4. **History Stream & Zero-Schema Alterations**: Exposes student-isolated recommendation history streams without modifying database schemas.

## Intervention / Recommendation Outcome Tracking (Task 16)

Task 16 implements recommendation outcome tracking and next-session focus delta measurement:

1. **Idempotent Outcome Updates**: Each `RecommendationEvent` has at most one `RecommendationOutcome` record. Subsequent updates overwrite existing outcome fields without duplicating records.
2. **Immediate Next-Session Selection Rule**: Automatic next-session evaluation selects strictly the immediate next completed session (`started_at > source_session.started_at ORDER BY started_at ASC LIMIT 1`) without skipping unanalyzed sessions.
3. **Synchronous Re-evaluability**: Re-evaluation occurs via endpoint invocation without requiring background workers, Celery, or scheduled jobs. Unanalyzed sessions remain `outcome_status="pending"` until ML analysis completes.
4. **Non-Causal Observational Framing**: UI badges and documentation label focus changes as `"Observed next-session focus delta"` to prevent unfounded causal claims.





