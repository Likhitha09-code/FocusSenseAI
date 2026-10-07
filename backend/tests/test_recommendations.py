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


# ---------------------------------------------------------------------------
# 5. Task 16 Intervention Outcome Tracking Tests
# ---------------------------------------------------------------------------
def test_task16_outcome_idempotency_and_duplicate_prevention(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)

    # Create session & activity
    session1 = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc),
        status="completed",
    )
    db_session.add(session1)
    db_session.commit()

    act1 = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=session1.id,
        activity_type="productive",
        occurred_at=datetime(2026, 10, 1, 10, 5, tzinfo=timezone.utc),
        numeric_value=1800.0,
    )
    db_session.add(act1)
    db_session.commit()

    event = recommendation_service.generate_student_recommendation(stu_a.id, session1.id, db_session)

    # 1. First call to outcome endpoint creates outcome
    out1_resp = client.post(
        f"/api/v1/student/recommendations/events/{event.id}/outcome",
        json={"recommendation_followed": True, "notes": "Initial follow"},
        headers={"Authorization": "Bearer token-a"},
    )
    assert out1_resp.status_code == status.HTTP_200_OK
    out1_data = out1_resp.json()
    assert out1_data["recommendation_followed"] is True
    first_outcome_id = out1_data["id"]

    # 2. Second call updates existing outcome (does NOT create duplicate record)
    out2_resp = client.post(
        f"/api/v1/student/recommendations/events/{event.id}/outcome",
        json={"recommendation_followed": False, "notes": "Updated note"},
        headers={"Authorization": "Bearer token-a"},
    )
    assert out2_resp.status_code == status.HTTP_200_OK
    out2_data = out2_resp.json()
    assert out2_data["id"] == first_outcome_id
    assert out2_data["recommendation_followed"] is False
    assert out2_data["notes"] == "Updated note"

    # Verify database contains exactly 1 outcome for this event
    outcomes = db_session.scalars(
        select(RecommendationOutcome).where(
            RecommendationOutcome.recommendation_event_id == event.id
        )
    ).all()
    assert len(outcomes) == 1


def test_task16_immediate_next_session_selection_and_no_skipping(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)

    # Source Session at 10:00
    s_source = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc),
        status="completed",
    )
    db_session.add(s_source)
    db_session.commit()
    act_s = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=s_source.id,
        activity_type="productive",
        occurred_at=datetime(2026, 10, 1, 10, 5, tzinfo=timezone.utc),
        numeric_value=1800.0,
    )
    db_session.add(act_s)
    db_session.commit()
    student_service.generate_session_behaviour_analysis(s_source.id, stu_a.id, db_session)
    event = recommendation_service.generate_student_recommendation(stu_a.id, s_source.id, db_session)

    # Immediate Next Session 2 at 12:00 (HAS TELEMETRY BUT UNANALYZED)
    s_next_immediate = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc),
        status="completed",
    )
    db_session.add(s_next_immediate)
    db_session.commit()
    act2 = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=s_next_immediate.id,
        activity_type="productive",
        occurred_at=datetime(2026, 10, 1, 12, 5, tzinfo=timezone.utc),
        numeric_value=1800.0,
    )
    db_session.add(act2)
    db_session.commit()

    # Later Session 3 at 14:00 (ANALYZED)
    s_later = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime(2026, 10, 1, 14, 0, tzinfo=timezone.utc),
        status="completed",
    )
    db_session.add(s_later)
    db_session.commit()
    act3 = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=s_later.id,
        activity_type="productive",
        occurred_at=datetime(2026, 10, 1, 14, 5, tzinfo=timezone.utc),
        numeric_value=1800.0,
    )
    db_session.add(act3)
    db_session.commit()
    student_service.generate_session_behaviour_analysis(s_later.id, stu_a.id, db_session)

    # Call outcome endpoint without specifying next_session_id -> MUST select immediate Session 2 (12:00)
    res1 = client.post(
        f"/api/v1/student/recommendations/events/{event.id}/outcome",
        json={"recommendation_followed": True},
        headers={"Authorization": "Bearer token-a"},
    )
    assert res1.status_code == status.HTTP_200_OK
    d1 = res1.json()

    # Immediate session 2 was not yet analyzed -> outcome_status="pending", delta_focus_next_session=None
    # Engine MUST NOT skip over Session 2 to select Session 3!
    assert d1["next_session_id"] == str(s_next_immediate.id)
    assert d1["outcome_status"] == "pending"
    assert d1["delta_focus_next_session"] is None

    # NOW analyze immediate Session 2
    student_service.generate_session_behaviour_analysis(s_next_immediate.id, stu_a.id, db_session)

    # Re-evaluate outcome endpoint -> MUST update existing outcome to measured and compute delta!
    res2 = client.post(
        f"/api/v1/student/recommendations/events/{event.id}/outcome",
        json={"recommendation_followed": True},
        headers={"Authorization": "Bearer token-a"},
    )
    assert res2.status_code == status.HTTP_200_OK
    d2 = res2.json()
    assert d2["next_session_id"] == str(s_next_immediate.id)
    assert d2["outcome_status"] == "measured"
    assert d2["delta_focus_next_session"] is not None


def test_task16_chronological_validation_and_security(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    parent_user: tuple[Parent, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    stu_a, auth_a = student_a
    stu_b, auth_b = student_b
    _, auth_parent = parent_user

    setup_token_mock(monkeypatch, auth_a)

    s1 = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc),
        status="completed",
    )
    s_prior = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime(2026, 10, 1, 8, 0, tzinfo=timezone.utc),  # Prior session!
        status="completed",
    )
    db_session.add_all([s1, s_prior])
    db_session.commit()

    act1 = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=s1.id,
        activity_type="productive",
        occurred_at=datetime(2026, 10, 1, 10, 5, tzinfo=timezone.utc),
        numeric_value=1800.0,
    )
    db_session.add(act1)
    db_session.commit()
    event = recommendation_service.generate_student_recommendation(stu_a.id, s1.id, db_session)

    # 1. Linking a prior session returns 400 Bad Request
    prior_resp = client.post(
        f"/api/v1/student/recommendations/events/{event.id}/outcome",
        json={"next_session_id": str(s_prior.id)},
        headers={"Authorization": "Bearer token-a"},
    )
    assert prior_resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "Next study session must occur after" in prior_resp.json()["detail"]

    # 2. Student B attempting to record outcome for Student A's event returns 404 Not Found
    setup_token_mock(monkeypatch, auth_b)
    b_resp = client.post(
        f"/api/v1/student/recommendations/events/{event.id}/outcome",
        json={"recommendation_followed": True},
        headers={"Authorization": "Bearer token-b"},
    )
    assert b_resp.status_code == status.HTTP_404_NOT_FOUND

    # 3. Parent role returns 403 Forbidden
    setup_token_mock(monkeypatch, auth_parent)
    parent_resp = client.post(
        f"/api/v1/student/recommendations/events/{event.id}/outcome",
        json={"recommendation_followed": True},
        headers={"Authorization": "Bearer parent-token"},
    )
    assert parent_resp.status_code == status.HTTP_403_FORBIDDEN


