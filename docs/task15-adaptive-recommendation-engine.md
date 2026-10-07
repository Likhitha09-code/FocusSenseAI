# Task 15 — Lightweight Adaptive Recommendation Engine

## Overview

Task 15 implements a personalized, explainable, lightweight recommendation engine within FocusSense AI. It analyzes student session telemetry and Task 11–14 ML predictions (Focus Score, Distraction Rating, Performance Prediction) to classify study session habits into non-clinical project personas, select targeted recommendations, store selection context snapshots, and maintain chronological recommendation event streams.

---

## System Architecture & Flow

```text
Study Session Telemetry & Task 11–14 Model Predictions
       ↓
Real-Data Gate (activity_count >= 1 & total_duration_seconds > 0)
       ↓
Behavioural Persona Evaluation (evaluate_behavioural_persona)
       ↓
Catalog Selection (generate_student_recommendation -> Catalog Entry)
       ↓
Persistence (RecommendationEvent record with selection_context)
       ↓
Frontend Presentation (Active Recommendation Card & History Stream)
```

---

## Non-Clinical Project Personas & Selection Rules

Personas are lightweight, rule-based engineering heuristics for habit classification within the application. They are **NOT** scientifically validated psychological diagnostic categories or medical claims.

| Persona Name | Rule Criteria / Threshold | Matched Recommendation Type | Selection Objective |
| :--- | :--- | :--- | :--- |
| `HIGHLY_DISTRACTED` | `distraction_level == "HIGH"` OR `distraction_ratio > 0.35` | `REDUCE_DISTRACTION` | Minimize non-essential app usage |
| `CONTEXT_SWITCHER` | `activity_switch_count > 15` | `REDUCE_CONTEXT_SWITCHING` | Single-task focus blocks |
| `FATIGUED_STUDIER` | `total_duration > 3600` AND `break_duration == 0` | `STRUCTURED_BREAKS` | Schedule micro-breaks |
| `LOW_ACADEMIC_RETENTION` | `quiz_score` baseline $< 60.0$ | `ACADEMIC_REVIEW` | Review low-scoring quiz topics |
| `HIGH_PERFORMER` | `focus_score >= 80.0` | `MAINTAIN_PRODUCTIVE_HABIT` | Sustain high-focus routine |
| `BALANCED_STUDIER` | Default fallback | `SUSTAINED_FOCUS_BUILDING` | Extend focus block length |

---

## Recommendation Outcome Integrity Principles

1. **No Premature Outcomes**:
   - Creating a `RecommendationEvent` does **NOT** generate a premature or fake `RecommendationOutcome` entity.
   - Outcome fields (`recommendation_followed`, `delta_focus_next_session`, `next_focus_score`, `next_session_id`, `outcome_status`) remain unset (`None`/null) until an actual follow-through or outcome measurement event occurs with real data.

2. **Selection Context Snapshot**:
   - Each `RecommendationEvent` captures a frozen snapshot (`selection_context`) of session metrics (`focus_score`, `distraction_level`, `performance_prediction`, `productive_activity_ratio`, `distraction_activity_ratio`, `activity_switch_count`, `total_session_duration`, `quiz_score`, `model_version`).

---

## Data Isolation & Role Permissions

1. **Student Isolation**:
   - `RecommendationEvent` queries filter strictly by `student_id == current_user.student_id`.
   - Cross-student recommendation event access returns `HTTP 404 Not Found`.

2. **Parent Access Restrictions**:
   - Parent accounts attempting to generate or list student recommendations receive `HTTP 403 Forbidden`.

---

## Zero Database Schema Modifications

- Reuses existing tables: `recommendations`, `recommendation_events`, and `recommendation_outcomes`.
- No database schema alterations or migrations were required or performed.

