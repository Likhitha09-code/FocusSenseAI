# Task 16 — Intervention / Recommendation Outcome Tracking

## Overview

Task 16 implements the **Intervention / Recommendation Outcome Tracking** layer for FocusSense AI. It records explicit student follow-through on issued recommendations and evaluates subsequent study session focus changes (`delta_focus_next_session`), strictly adhering to observational framing, outcome idempotency, immediate next-session selection rules, and data integrity.

---

## System Architecture & Outcome Lifecycle

```text
[1. RecommendationEvent Issued]
       ↓ (Outcome record is NOT created; status: "unmeasured")
[2. Student Records Follow-Through (POST /recommendations/events/{id}/outcome)]
       ↓ (Idempotent: updates existing outcome if present)
[3. Immediate Next-Session Selection (ORDER BY started_at ASC LIMIT 1)]
       ↓
[4. Delta Evaluation (delta_focus_next_session = next_focus_score - source_focus_score)]
       ↓ (If next session has valid ML analysis -> status: "measured")
       ↓ (If next session is unanalyzed -> status: "pending", delta: null)
[5. Non-Causal UI Presentation ("Observed next-session focus change")]
```

---

## Key Outcome Rules & Constraints

1. **Idempotent Updates (At Most One Outcome Per Event)**:
   - Each `RecommendationEvent` has at most one `RecommendationOutcome` entity (enforced via database unique constraint on `recommendation_event_id`).
   - Subsequent calls to the outcome endpoint update the existing outcome record rather than creating duplicates.

2. **Immediate Next-Session Selection**:
   - When `next_session_id` is omitted in the request, the engine automatically selects ONLY the **immediate next completed study session** for the same student:
     `StudySession.student_id == student_id AND StudySession.started_at > source_session.started_at ORDER BY started_at ASC LIMIT 1`
   - The engine **never skips over** the immediate next session to hunt for a later session that happens to have ML analysis.

3. **Unanalyzed Immediate Next Session Handling**:
   - If the immediate next completed session exists but lacks valid ML focus analysis:
     - `delta_focus_next_session` remains `None`/null
     - `outcome_status` remains `"pending"`
     - Re-evaluating the outcome endpoint after next-session analysis completes safely updates `outcome_status = "measured"` and populates `delta_focus_next_session`.

4. **Zero Premature Outcomes**:
   - `RecommendationOutcome` entities are created **only** upon explicit student follow-through or outcome recording requests. Generating a `RecommendationEvent` does not create an outcome record.

5. **Observational Framing (No Causal Claims)**:
   - All frontend labels and documentation explicitly state `"Observed change after recommendation"` or `"Observed next-session focus delta"`, NEVER claiming direct causality (e.g., no *"improvement caused by recommendation"*).

---

## Data Isolation & Security

1. **Student Isolation**:
   - `RecommendationEvent` and `RecommendationOutcome` queries strictly scope to `event.student_id == current_user.student_id`.
   - Attempting to record an outcome for another student's event returns `HTTP 404 Not Found`.
   - Linking another student's session as `next_session_id` returns `HTTP 404 Not Found`.

2. **Chronological Validation**:
   - `next_session.started_at > source_session.started_at`. Linking a prior or concurrent session returns `HTTP 400 Bad Request`.

3. **Parent Access Restrictions**:
   - Parent accounts attempting to post to student outcome endpoints receive `HTTP 403 Forbidden`.

---

## Zero Database Schema Modifications

- Reuses the existing `RecommendationOutcome` entity (`backend/app/models/entities.py`).
- No database schema modifications or migrations were created.

