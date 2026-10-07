# Supabase/PostgreSQL Schema Plan

The executable implementation is `migrations/001_initial_schema.sql`. All identifiers use PostgreSQL UUIDs and timestamps are timezone-aware. Row-level security policies will be added with authentication implementation.

## Core entities

- `students`: authenticated student profile and timezone.
- `parents`: optional parent profile linked to an authenticated account.
- `student_parent_links`: explicit relationship and consent/status metadata.
- `subjects`: subjects available to a student.
- `study_sessions`: one study interval with subject, start/end, and session status.
- `study_activities`: timestamped behavioural observations linked to a session (interruptions, task switches, breaks, and related measured activity).
- `quizzes`: quiz metadata linked to a subject.
- `performance_reports`: post-session or quiz outcomes that can be used as prediction targets.
- `behavioural_analyses`: feature snapshot, prediction outputs, model version, and explanation references for a session.

## Intervention and learning entities

- `recommendations`: recommendation catalog/type and rendered content.
- `recommendation_events`: every recommendation issued, linked to the student and source session, including selection context and model/persona metadata.
- `recommendation_outcomes`: follow-through and next-session outcome linked to a recommendation event. Required fields include `recommendation_followed` and `delta_focus_next_session`.

`recommendation_events` and `recommendation_outcomes` are separate so an issued recommendation is never lost when follow-through is unknown. The outcome record should also retain the next session identifier, follow-up measurement timestamp, next focus score, and an outcome quality/status field.

## Key relationships

```text
student -> study_sessions -> study_activities
student -> subjects -> quizzes -> performance_reports
study_session -> behavioural_analyses
study_session -> recommendation_events -> recommendation_outcomes -> next study_session
student -> recommendation_events (history for adaptive selection)
```

## Analysis requirements

Store the feature snapshot and model version used for each behavioural analysis. Store the recommendation selector version and persona at issue time. This supports reproducible explanations, before/after comparisons, and uplift-style summaries without overwriting historical decisions.

The backend mirrors this contract in `backend/app/models/entities.py`. `backend/app/db/session.py` creates sessions lazily from `DATABASE_URL`, so importing the API does not require live Supabase credentials.

## Supabase Auth identity mapping

Supabase Auth owns credentials and the authenticated user UUID. `students.auth_user_id` and `parents.auth_user_id` store that UUID as a unique external identity reference; the application table primary keys remain independent profile IDs. The backend verifies the Supabase access token first, then resolves exactly one application profile by matching the trusted Auth UUID. A user with both profiles is rejected as a data-integrity conflict, and a user with neither profile is forbidden from profile-protected operations.

Passwords are never stored in application tables. The role is derived from the matching profile table (`students` or `parents`), not accepted from a request body.