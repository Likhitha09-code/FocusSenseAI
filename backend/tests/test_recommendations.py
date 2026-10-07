"""Task 15 Unit & Integration Tests: Lightweight Adaptive Recommendation Engine.

Verifies default catalog seeding, deterministic non-clinical persona classification rules,
real-data gating, recommendation event generation with context snapshots, recommendation outcome
integrity (no premature outcomes created), history retrieval, student isolation, and role security.
"""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    BehaviouralAnalysis,
    Parent,
    Recommendation,
    RecommendationEvent,
    RecommendationOutcome,
    StudyActivity,
    StudySession,
    Student,
)
from app.services import recommendation_service, student_service, supabase


def setup_token_mock(monkeypatch: pytest.MonkeyPatch, auth_user_id: uuid.UUID):
    def mock_verify(token: str):
        return {"id": str(auth_user_id), "email": "student@focussense.ai"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify)


# ---------------------------------------------------------------------------
# 1. Catalog Seeding & Retrieval Tests
# ---------------------------------------------------------------------------
def test_ensure_default_recommendation_catalog(db_session: Session):
    catalog = recommendation_service.ensure_default_recommendation_catalog(db_session)
    assert len(catalog) >= 6

    types = [r.recommendation_type for r in catalog]
    assert "REDUCE_DISTRACTION" in types
    assert "REDUCE_CONTEXT_SWITCHING" in types
    assert "STRUCTURED_BREAKS" in types
    assert "SUSTAINED_FOCUS_BUILDING" in types
    assert "ACADEMIC_REVIEW" in types
    assert "MAINTAIN_PRODUCTIVE_HABIT" in types


# ---------------------------------------------------------------------------
# 2. Deterministic Persona Evaluation Tests (Non-Clinical Rules)
# ---------------------------------------------------------------------------
def test_evaluate_behavioural_persona_rules():
    # 1. HIGHLY_DISTRACTED persona rule
    analysis_distraction = BehaviouralAnalysis(
        distraction_level="HIGH",
        focus_score=40.0,
        feature_snapshot={"distraction_activity_ratio": 0.40, "activity_switch_count": 5},
    )
    assert recommendation_service.evaluate_behavioural_persona(analysis_distraction) == "HIGHLY_DISTRACTED"

    # 2. CONTEXT_SWITCHER persona rule
    analysis_switcher = BehaviouralAnalysis(
        distraction_level="MEDIUM",
        focus_score=60.0,
        feature_snapshot={"distraction_activity_ratio": 0.10, "activity_switch_count": 22},
    )
    assert recommendation_service.evaluate_behavioural_persona(analysis_switcher) == "CONTEXT_SWITCHER"

    # 3. FATIGUED_STUDIER persona rule
    analysis_fatigued = BehaviouralAnalysis(
        distraction_level="LOW",
        focus_score=65.0,
        feature_snapshot={
            "distraction_activity_ratio": 0.05,
            "activity_switch_count": 3,
            "total_session_duration": 4500.0,
            "break_duration": 0.0,
        },
    )
    assert recommendation_service.evaluate_behavioural_persona(analysis_fatigued) == "FATIGUED_STUDIER"

    # 4. LOW_ACADEMIC_RETENTION persona rule
    analysis_low_quiz = BehaviouralAnalysis(
        distraction_level="LOW",
        focus_score=70.0,
        feature_snapshot={
            "distraction_activity_ratio": 0.05,
            "activity_switch_count": 3,
            "total_session_duration": 1800.0,
            "break_duration": 0.0,
            "quiz_score": 45.0,
        },
    )
    assert recommendation_service.evaluate_behavioural_persona(analysis_low_quiz) == "LOW_ACADEMIC_RETENTION"

    # 5. HIGH_PERFORMER persona rule
    analysis_performer = BehaviouralAnalysis(
        distraction_level="LOW",
        focus_score=92.0,
        feature_snapshot={
            "distraction_activity_ratio": 0.02,
            "activity_switch_count": 2,
            "total_session_duration": 1800.0,
            "break_duration": 0.0,
            "quiz_score": 90.0,
        },
    )
    assert recommendation_service.evaluate_behavioural_persona(analysis_performer) == "HIGH_PERFORMER"

    # 6. BALANCED_STUDIER fallback
    analysis_balanced = BehaviouralAnalysis(
        distraction_level="LOW",
        focus_score=75.0,
        feature_snapshot={
            "distraction_activity_ratio": 0.05,
            "activity_switch_count": 4,
            "total_session_duration": 1800.0,
            "break_duration": 0.0,
            "quiz_score": 75.0,
        },
    )
    assert recommendation_service.evaluate_behavioural_persona(analysis_balanced) == "BALANCED_STUDIER"


# ---------------------------------------------------------------------------
# 3. Real Data Gate & Recommendation Event Generation Tests
# ---------------------------------------------------------------------------
def test_recommendation_event_generation_and_outcome_integrity(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)

    # 1. Create empty session -> Real-data gate blocks recommendation generation
    empty_session = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime.now(timezone.utc),
        status="active",
    )
    db_session.add(empty_session)
    db_session.commit()

    with pytest.raises(Exception) as exc_info:
        recommendation_service.generate_student_recommendation(
            stu_a.id, empty_session.id, db_session
        )
    assert "Insufficient activity telemetry data" in str(exc_info.value)

    # 2. Create active session with activity telemetry
    valid_session = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime.now(timezone.utc),
        status="completed",
    )
    db_session.add(valid_session)
    db_session.commit()

    activity = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=valid_session.id,
        activity_type="productive",
        occurred_at=datetime.now(timezone.utc),
        numeric_value=2400.0,
        metadata_json={"application_name": "IDE"},
    )
    db_session.add(activity)
    db_session.commit()

    # 3. Generate recommendation event
    event = recommendation_service.generate_student_recommendation(
        stu_a.id, valid_session.id, db_session
    )

    assert event.student_id == stu_a.id
    assert event.source_session_id == valid_session.id
    assert event.selector_version == "v1.0"
    assert event.behavioural_persona in (
        "HIGHLY_DISTRACTED",
        "CONTEXT_SWITCHER",
        "FATIGUED_STUDIER",
        "LOW_ACADEMIC_RETENTION",
        "HIGH_PERFORMER",
        "BALANCED_STUDIER",
    )
    assert "focus_score" in event.selection_context

    # 4. RECOMMENDATION OUTCOME INTEGRITY CHECK:
    # Ensure NO premature RecommendationOutcome entity was created for this event
    outcome = db_session.scalar(
        select(RecommendationOutcome).where(
            RecommendationOutcome.recommendation_event_id == event.id
        )
    )
    assert outcome is None  # Outcome MUST remain absent/null until real outcome measurement occurs!


# ---------------------------------------------------------------------------
# 4. API Endpoint, History & Ownership Security Tests
# ---------------------------------------------------------------------------
def test_recommendation_history_api_and_student_isolation(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    parent_user: tuple[Parent, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    stu_a, auth_a = student_a
    _, auth_b = student_b
    _, auth_parent = parent_user

    setup_token_mock(monkeypatch, auth_a)

    # 1. Student A generates a recommendation event
    session = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime.now(timezone.utc),
        status="completed",
    )
    db_session.add(session)
    db_session.commit()

    activity = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=session.id,
        activity_type="productive",
        occurred_at=datetime.now(timezone.utc),
        numeric_value=1800.0,
        metadata_json={"application_name": "Editor"},
    )
    db_session.add(activity)
    db_session.commit()

    gen_resp = client.post(
        "/api/v1/student/recommendations/generate",
        json={"session_id": str(session.id)},
        headers={"Authorization": "Bearer token-a"},
    )
    assert gen_resp.status_code == status.HTTP_201_CREATED
    gen_data = gen_resp.json()
    assert gen_data["source_session_id"] == str(session.id)

    # 2. Student A lists recommendation history -> 1 item returned
    hist_resp = client.get(
        "/api/v1/student/recommendations/history",
        headers={"Authorization": "Bearer token-a"},
    )
    assert hist_resp.status_code == status.HTTP_200_OK
    hist_items = hist_resp.json()
    assert len(hist_items) == 1
    assert hist_items[0]["outcome_status"] == "unmeasured"

    # 3. Student B lists recommendation history -> 0 items returned (strict student isolation)
    setup_token_mock(monkeypatch, auth_b)
    b_hist_resp = client.get(
        "/api/v1/student/recommendations/history",
        headers={"Authorization": "Bearer token-b"},
    )
    assert b_hist_resp.status_code == status.HTTP_200_OK
    assert b_hist_resp.json() == []

    # 4. Parent role is forbidden
    setup_token_mock(monkeypatch, auth_parent)
    parent_resp = client.get(
        "/api/v1/student/recommendations/history",
        headers={"Authorization": "Bearer parent-token"},
    )
    assert parent_resp.status_code == status.HTTP_403_FORBIDDEN

