# Task 7 — Backend REST API Foundation

## 1. Overview & Objectives

Task 7 implements the Backend REST API Foundation for **FocusSense AI – AI Study Behaviour Analyzer**. It bridges the Task 2 SQLAlchemy database entities and the Task 3–5 Supabase authentication layer to a clean, type-safe FastAPI service layer that will power the Student Dashboard and study workflows.

### Strict Scope Boundaries
- **No Mock or Fake Data**: If the database contains no records for a student, endpoints return real empty collections (`[]`), zero counts (`0`), or `null` values.
- **No Premature ML Logic**: Model inference (focus regression, distraction classification, grade prediction), SHAP values, counterfactual algorithms, and causal uplift computations are strictly deferred to subsequent ML-focused tasks.
- **No Automated Activity Monitoring Daemons**: Activity records are created via REST endpoints.
- **Strict Role & Resource Isolation**: Authenticated identity is resolved strictly from the verified Supabase JWT (`current_user.student_id`). A parent token receives `403 Forbidden`. Requests targeting resources owned by other students return `404 Not Found`.

---

## 2. API Endpoint Specification

All student endpoints are mounted under `/api/v1/student` and require a valid Bearer JWT with an associated `student` profile.

### 2.1 Student Dashboard Summary
- **Endpoint**: `GET /api/v1/student/dashboard`
- **Description**: Returns aggregated metrics (total sessions, total study minutes, average focus score), active session (if any), recent completed sessions, recent behaviour records, performance reports, and latest recommendations.
- **Response**: `StudentDashboardResponse`
  - Empty database returns `{ "total_sessions": 0, "total_study_minutes": 0, "avg_focus_score": null, "active_session": null, "recent_sessions": [], "recent_behaviour": [], "performance_reports": [], "recommendations": [] }`.

### 2.2 Study Sessions
- **`GET /api/v1/student/sessions`**: List study sessions for the authenticated student.
  - Query Params: `limit` (default 20, max 100), `offset` (default 0), `subject_id` (optional).
  - Response: `List[StudySessionResponse]`
- **`POST /api/v1/student/sessions`**: Create a new study session.
  - Body: `StudySessionCreate` (`subject_id`, `start_time`, `end_time` [optional], `session_type` [default "study"]).
  - Response: `StudySessionResponse` (status 201).
- **`GET /api/v1/student/sessions/{session_id}`**: Retrieve a single session by UUID.
  - Ownership: Enforces `session.student_id == current_user.student_id`. Returns 404 if not found or belongs to another student.
  - Response: `StudySessionResponse`
- **`PATCH /api/v1/student/sessions/{session_id}`**: Update or conclude a study session.
  - Body: `StudySessionUpdate` (`end_time`, `session_type`, `final_focus_score`).
  - Response: `StudySessionResponse`

### 2.3 Study Activities
- **`GET /api/v1/student/sessions/{session_id}/activities`**: List all raw activity events recorded during a session.
  - Ownership: Validates parent session ownership before retrieving activities.
  - Response: `List[StudyActivityResponse]`
- **`POST /api/v1/student/sessions/{session_id}/activities`**: Record a new activity event (keystrokes, active window, tab switches, idle periods).
  - Body: `StudyActivityCreate` (`timestamp`, `activity_type`, `window_title`, `url`, `duration_seconds`, `keystroke_count`, `mouse_movement_count`, `is_productive_app`).
  - Response: `StudyActivityResponse` (status 201).

### 2.4 Behavioural Analysis
- **`GET /api/v1/student/behaviour`**: List behaviour records (focus score, distraction level, productive percentage, tab switch rate) for the student.
  - Query Params: `limit` (default 30), `offset` (default 0).
  - Response: `List[BehaviourRecordResponse]`
- **`GET /api/v1/student/behaviour/analysis`**: List high-level behaviour analysis summaries (aggregate focus score, detected distraction patterns, behavioural persona).
  - Query Params: `limit` (default 30), `offset` (default 0).
  - Response: `List[BehaviourAnalysisResponse]`

### 2.5 Academic Performance & Quizzes
- **`GET /api/v1/student/performance`**: List periodic academic performance evaluation reports.
  - Query Params: `limit` (default 30), `offset` (default 0).
  - Response: `List[PerformanceReportResponse]`
- **`GET /api/v1/student/subjects`**: List enrolled subjects for the authenticated student.
  - Response: `List[SubjectResponse]`
- **`GET /api/v1/student/quizzes`**: List quizzes belonging to the student's subjects.
  - Query Params: `subject_id` (optional), `limit` (default 50), `offset` (default 0).
  - Response: `List[QuizResponse]`
- **`POST /api/v1/student/quizzes`**: Create a quiz record under an enrolled subject.
  - Body: `QuizCreate` (`subject_id`, `score`, `total_questions`, `quiz_date`).
  - Ownership: Verifies that `subject_id` belongs to `current_user.student_id`. Returns 404 if invalid.
  - Response: `QuizResponse` (status 201).

### 2.6 Causal / Intervention Feedback Layer
- **`GET /api/v1/student/recommendations`**: Fetch recommendations assigned to the student.
  - Query Params: `limit` (default 20), `offset` (default 0).
  - Response: `List[RecommendationResponse]`
- **`POST /api/v1/student/recommendations/events`**: Record a recommendation presentation event linked to a study session.
  - Body: `RecommendationEventCreate` (`recommendation_id`, `study_session_id`, `presented_at`, `student_acknowledged`).
  - Validation: Verifies both recommendation and session belong to the student.
  - Response: `RecommendationEventResponse` (status 201).
- **`POST /api/v1/student/recommendations/events/{event_id}/outcomes`**: Record the post-intervention outcome of a recommendation.
  - Body: `RecommendationOutcomeCreate` (`recommendation_followed`, `delta_focus_next_session`, `next_focus_score`, `outcome_status`).
  - Validation: Verifies event exists, belongs to the student's recommendation, and prevents duplicate outcomes on the same event.
  - Response: `RecommendationOutcomeResponse` (status 201).

---

## 3. Architecture & Implementation Details

```
backend/
├── app/
│   ├── api/
│   │   ├── auth_routes.py        # Task 4/5 Authentication & Provisioning
│   │   ├── student_routes.py     # Task 7 Student REST endpoints
│   │   └── routes.py             # Router aggregation (/api/v1)
│   ├── schemas/
│   │   ├── auth.py               # Auth & Profile Pydantic schemas
│   │   └── student.py            # Task 7 Pydantic schemas
│   ├── services/
│   │   ├── auth_service.py       # Supabase token & profile resolution
│   │   └── student_service.py    # Student business logic & queries
│   └── models/
│       └── entities.py           # SQLAlchemy database tables
```

### Authentication & Authorization Flow
1. Client sends request with `Authorization: Bearer <supabase_jwt>`.
2. `require_student` dependency calls `get_current_user`:
   - Verifies JWT with Supabase Auth API (`GET /auth/v1/user`).
   - Looks up `auth_user_id` in `students` table.
   - If found, binds `AuthenticatedUser(auth_user_id, email, role="student", student_id=...)`.
   - If user is a parent, role is `"parent"`; `require_student` raises `HTTPException(403, "Access forbidden: student role required")`.
   - If unauthenticated, raises `HTTPException(401, "Authentication required")`.

### Data Isolation
- Client cannot specify `student_id` in request payloads or query params to impersonate another user.
- Every read, create, and update derives `student_id = current_user.student_id`.
- Foreign key relations (e.g. `subject_id` on quiz, `session_id` on activity, `event_id` on outcome) verify parent ownership before processing.

---

## 4. Frontend Integration (`frontend/src/lib/api.js`)

Centralized asynchronous helper functions exported for UI consumption:
- `getStudentDashboard()`
- `getStudySessions(params)`
- `createStudySession(sessionData)`
- `getStudySession(sessionId)`
- `updateStudySession(sessionId, sessionData)`
- `getSessionActivities(sessionId)`
- `createSessionActivity(sessionId, activityData)`
- `getStudentBehaviour(params)`
- `getStudentBehaviourAnalysis(params)`
- `getStudentPerformance(params)`
- `getStudentSubjects()`
- `getStudentQuizzes(params)`
- `createStudentQuiz(quizData)`
- `getStudentRecommendations(params)`
- `createRecommendationEvent(eventData)`
- `recordRecommendationOutcome(eventId, outcomeData)`

The Axios instance automatically intercepts requests to inject verified Supabase access tokens and handles 401/403 states.

---

## 5. Verification & Test Suite

The test suite in `backend/tests/test_student_api.py` covers 9 automated test scenarios with SQLite in-memory database:
1. `test_dashboard_unauthenticated_returns_401`
2. `test_dashboard_parent_role_forbidden` (verifies 403 on parent role)
3. `test_dashboard_empty_database_returns_null_and_empty` (verifies zero-fake-data policy)
4. `test_dashboard_reflects_real_student_data_and_isolates_others` (verifies metric aggregation and cross-student isolation)
5. `test_study_session_crud_and_ownership` (create, get, patch, and foreign student 404)
6. `test_study_activities_under_session` (create and list session activities)
7. `test_behavioural_analysis_endpoints` (behaviour records and aggregate analysis)
8. `test_subjects_and_quizzes` (subjects and quiz creation with subject ownership verification)
9. `test_recommendations_and_interventions` (recommendations, presentation events, and causal outcome tracking)

All 21 backend tests (12 auth + 9 student API) passed with 100% success rate. Frontend build and lint checks pass cleanly.

