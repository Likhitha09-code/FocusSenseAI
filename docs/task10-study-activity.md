# Task 10 — Study Activity Data Collection & Behaviour Feature Foundation

## 1. Overview & Purpose

Task 10 establishes the data collection pipeline for recording transparent, session-bound study activity telemetry and extracting deterministic behavioural features for future ML model consumption in **FocusSense AI**.

```text
Study Session
      ↓
Study Activity Records (API Ingestion & Logging)
      ↓
Activity Aggregation (Deterministic Statistics)
      ↓
Behavioural Feature Extraction Foundation
      ↓
[Future ML Pipeline: Focus Score & Distraction Classifier]
```

### Strict Boundaries & Privacy Guarantees
- **No Stealth Monitoring**: Telemetry is logged explicitly and transparently through clean application REST APIs.
- **No Background OS Surveillance**: No OS keyloggers, mouse trackers, webcam/microphone access, desktop surveillance agents, or browser extensions are deployed.
- **Zero Fake ML Scores**: All activity summaries and feature vectors use pure, deterministic mathematical statistics (durations, ratios, switch counts). No fake focus scores, fake distraction scores, SHAP explanations, or ML predictions are fabricated.

---

## 2. Activity Data Contract & Validation

Study activities are recorded against an active study session.

### Schema: `StudyActivityCreate`
- `activity_type` (Required): Controlled classification regex `^(study|productive|distraction|break|other|coding|app_focus)$`.
- `application_name` (Optional): String up to 200 characters identifying the task or application (e.g. `"VS Code"`, `"Browser Research"`, `"Docs"`), merged into `metadata_json`.
- `duration_seconds` (Optional): Non-negative float (`ge=0.0`) representing activity duration.
- `occurred_at` (Optional): ISO datetime timestamp (defaults to server UTC time).
- `metadata_json` (Optional): Dictionary for supplementary telemetry attributes.

---

## 3. Backend Activity API Endpoints

All activity endpoints are mounted under `/api/v1/student/sessions/{session_id}/activities` and protected by the `require_student` security dependency.

### 3.1 `POST /api/v1/student/sessions/{session_id}/activities`
- **Summary**: Record a new study activity event under a session.
- **Ownership Verification**: Derived strictly from verified Supabase JWT (`current_user.student_id`). Unowned sessions return `404 Not Found`. Unauthenticated calls return `401`. Parent role tokens return `403`.
- **Lifecycle Validation**: Rejects activity creation if session status is `"completed"` or `"cancelled"` with `HTTP 400 Bad Request`.

### 3.2 `GET /api/v1/student/sessions/{session_id}/activities`
- **Summary**: Retrieve chronological activity records for an owned session.
- **Response**: `List[StudyActivityResponse]`.

### 3.3 `GET /api/v1/student/sessions/{session_id}/activities/summary`
- **Summary**: Retrieve aggregated session activity metrics.
- **Response**: `SessionActivitySummaryResponse`:
  - `total_duration_seconds`: Total cumulative activity time.
  - `productive_duration_seconds`: Duration spent on `study` or `productive` activities.
  - `distraction_duration_seconds`: Duration spent on `distraction` activities.
  - `break_duration_seconds`: Duration spent on `break` activities.
  - `productive_percentage`: `(productive_duration / total_duration) * 100`.
  - `distraction_percentage`: `(distraction_duration / total_duration) * 100`.
  - `activity_count`: Number of activity records logged.
  - `activity_switch_count`: Count of context shifts between distinct activity types or application names.
  - `unique_application_count`: Count of distinct applications logged.

---

## 4. Behavioural Feature Extraction Foundation

The service layer function `extract_session_behaviour_features(session_id, student_id, db)` computes a standardized feature vector dictionary ready for future ML ingestion:

```python
{
    "total_session_duration": 1800.0,
    "productive_duration": 1500.0,
    "distraction_duration": 300.0,
    "break_duration": 0.0,
    "productive_activity_ratio": 0.8333,
    "distraction_activity_ratio": 0.1667,
    "activity_switch_count": 1,
    "activity_count": 2,
    "unique_application_count": 2,
}
```

These features are deterministic, reproducible, and completely free of hardcoded heuristic scores.

---

## 5. Frontend UI Integration (`StudySessions.jsx`)

1. **Log Session Activity Form**: Rendered when a study session is active, allowing students to log activity events (`Activity Type`, `Application Name`, `Duration in Minutes`).
2. **Active Telemetry Breakdown**: Live summary cards showing Total Logged Time, Productive %, Distraction %, and Context Switch counts alongside a detailed activity event table.
3. **Historical Session Telemetry Inspector**: Allows inspecting recorded activities and aggregate metrics for completed sessions in session history.

---

## 6. Verification & Test Suite

- **Pytest Suite**: 22 automated tests in `backend/tests/test_student_api.py` passing 100%.
- **Frontend Lint & Build**: `npm run lint` (0 errors) and `npm run build` (`vite build` 0 errors, built in 590ms).
- **FastAPI OpenAPI Schema**: `/health` (HTTP 200), `/docs` (HTTP 200), `/openapi.json` (HTTP 200 with registered activity endpoints).

