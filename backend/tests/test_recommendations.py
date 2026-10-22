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


# ---------------------------------------------------------------------------
# 6. Tasks 17 & 19 Adaptive Recommendation Feedback Loop Tests
# ---------------------------------------------------------------------------
def test_task17_19_baseline_no_history_preserves_default_selection(
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
):
    """When a student has no prior outcomes, the default persona recommendation is selected."""
    stu_a, _ = student_a

    # No history signals
    signals = recommendation_service.compute_student_recommendation_signals(stu_a.id, db_session)
    assert signals == {}

    # Verify each persona selects its default recommendation
    rec_distracted, score, is_adapted, _ = (
        recommendation_service.select_adaptive_recommendation("HIGHLY_DISTRACTED", stu_a.id, db_session)
    )
    assert rec_distracted.recommendation_type == "REDUCE_DISTRACTION"
    assert is_adapted is False
    assert score == 10.0

    rec_switcher, _, is_adapted, _ = (
        recommendation_service.select_adaptive_recommendation("CONTEXT_SWITCHER", stu_a.id, db_session)
    )
    assert rec_switcher.recommendation_type == "REDUCE_CONTEXT_SWITCHING"
    assert is_adapted is False

    rec_fatigued, _, is_adapted, _ = (
        recommendation_service.select_adaptive_recommendation("FATIGUED_STUDIER", stu_a.id, db_session)
    )
    assert rec_fatigued.recommendation_type == "STRUCTURED_BREAKS"
    assert is_adapted is False


def test_task17_19_conservative_small_sample_and_shrinkage(
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
):
    """A single minor negative outcome should be dampened by Bayesian shrinkage and NOT prematurely flip ranking."""
    stu_a, _ = student_a
    recommendation_service.ensure_default_recommendation_catalog(db_session)

    # Create 1 session with an outcome having a minor negative delta (-1.0 pt)
    rec_dist = db_session.scalar(
        select(Recommendation).where(Recommendation.recommendation_type == "REDUCE_DISTRACTION")
    )
    assert rec_dist is not None

    sess = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc),
        status="completed",
    )
    db_session.add(sess)
    db_session.commit()

    ev = RecommendationEvent(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        source_session_id=sess.id,
        recommendation_id=rec_dist.id,
        selection_reason="Initial event",
        selector_version="v1.0",
        behavioural_persona="HIGHLY_DISTRACTED",
        selection_context={},
    )
    db_session.add(ev)
    db_session.commit()

    out = RecommendationOutcome(
        id=uuid.uuid4(),
        recommendation_event_id=ev.id,
        recommendation_followed=True,
        delta_focus_next_session=-1.0,
        outcome_status="measured",
    )
    db_session.add(out)
    db_session.commit()

    # Signals calculation: shrinkage weight for N=1 is 1 / (1 + 2) = 0.33
    # delta_signal = 0.33 * -1.0 = -0.33; adherence = +0.5; total_adj is positive or slightly dampened
    signals = recommendation_service.compute_student_recommendation_signals(stu_a.id, db_session)
    dist_signal = signals["REDUCE_DISTRACTION"]
    assert dist_signal["measured_count"] == 1
    assert abs(dist_signal["delta_signal"]) < 1.0  # Conservative shrinkage

    # Primary recommendation remains REDUCE_DISTRACTION (base 10.0 + adj > secondary 8.0)
    best_rec, score, is_adapted, _ = (
        recommendation_service.select_adaptive_recommendation("HIGHLY_DISTRACTED", stu_a.id, db_session)
    )
    assert best_rec.recommendation_type == "REDUCE_DISTRACTION"
    assert is_adapted is False


def test_task17_19_positive_outcomes_boost_recommendation_ranking(
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
):
    """Demonstrated positive focus deltas increase rank score and reinforce intervention."""
    stu_a, _ = student_a
    recommendation_service.ensure_default_recommendation_catalog(db_session)

    rec_breaks = db_session.scalar(
        select(Recommendation).where(Recommendation.recommendation_type == "STRUCTURED_BREAKS")
    )
    assert rec_breaks is not None

    for i in range(2):
        sess = StudySession(
            id=uuid.uuid4(),
            student_id=stu_a.id,
            started_at=datetime(2026, 10, i + 1, 10, 0, tzinfo=timezone.utc),
            status="completed",
        )
        db_session.add(sess)
        db_session.commit()

        ev = RecommendationEvent(
            id=uuid.uuid4(),
            student_id=stu_a.id,
            source_session_id=sess.id,
            recommendation_id=rec_breaks.id,
            selection_reason="Test event",
            selector_version="v1.0",
            behavioural_persona="FATIGUED_STUDIER",
            selection_context={},
        )
        db_session.add(ev)
        db_session.commit()

        out = RecommendationOutcome(
            id=uuid.uuid4(),
            recommendation_event_id=ev.id,
            recommendation_followed=True,
            delta_focus_next_session=7.5,
            outcome_status="measured",
        )
        db_session.add(out)
        db_session.commit()

    signals = recommendation_service.compute_student_recommendation_signals(stu_a.id, db_session)
    breaks_signal = signals["STRUCTURED_BREAKS"]
    assert breaks_signal["measured_count"] == 2
    assert breaks_signal["average_delta"] == 7.5
    assert breaks_signal["adjustment"] > 0
    assert breaks_signal["effectiveness_rating"] == "positive"

    best_rec, score, is_adapted, sig_info = (
        recommendation_service.select_adaptive_recommendation("FATIGUED_STUDIER", stu_a.id, db_session)
    )
    assert best_rec.recommendation_type == "STRUCTURED_BREAKS"
    assert score > 10.0  # Base 10.0 + positive adjustment


def test_task17_19_negative_outcomes_promote_alternative_intervention(
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
):
    """Repeated negative outcomes on default recommendation cause the adaptive selector to promote an effective alternative."""
    stu_a, _ = student_a
    recommendation_service.ensure_default_recommendation_catalog(db_session)

    rec_dist = db_session.scalar(
        select(Recommendation).where(Recommendation.recommendation_type == "REDUCE_DISTRACTION")
    )
    rec_switch = db_session.scalar(
        select(Recommendation).where(Recommendation.recommendation_type == "REDUCE_CONTEXT_SWITCHING")
    )

    # 1. Primary intervention REDUCE_DISTRACTION repeatedly fails (-10 pts, followed=False)
    for i in range(3):
        sess = StudySession(
            id=uuid.uuid4(),
            student_id=stu_a.id,
            started_at=datetime(2026, 10, i + 1, 10, 0, tzinfo=timezone.utc),
            status="completed",
        )
        db_session.add(sess)
        db_session.commit()

        ev = RecommendationEvent(
            id=uuid.uuid4(),
            student_id=stu_a.id,
            source_session_id=sess.id,
            recommendation_id=rec_dist.id,
            selection_reason="Failed test event",
            selector_version="v1.0",
            behavioural_persona="HIGHLY_DISTRACTED",
            selection_context={},
        )
        db_session.add(ev)
        db_session.commit()

        out = RecommendationOutcome(
            id=uuid.uuid4(),
            recommendation_event_id=ev.id,
            recommendation_followed=False,
            delta_focus_next_session=-10.0,
            outcome_status="measured",
        )
        db_session.add(out)
        db_session.commit()

    # 2. Alternative intervention REDUCE_CONTEXT_SWITCHING succeeds (+8 pts, followed=True)
    sess_alt = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime(2026, 10, 5, 10, 0, tzinfo=timezone.utc),
        status="completed",
    )
    db_session.add(sess_alt)
    db_session.commit()

    ev_alt = RecommendationEvent(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        source_session_id=sess_alt.id,
        recommendation_id=rec_switch.id,
        selection_reason="Alt event",
        selector_version="v1.0",
        behavioural_persona="HIGHLY_DISTRACTED",
        selection_context={},
    )
    db_session.add(ev_alt)
    db_session.commit()

    out_alt = RecommendationOutcome(
        id=uuid.uuid4(),
        recommendation_event_id=ev_alt.id,
        recommendation_followed=True,
        delta_focus_next_session=8.0,
        outcome_status="measured",
    )
    db_session.add(out_alt)
    db_session.commit()

    # 3. For HIGHLY_DISTRACTED, REDUCE_CONTEXT_SWITCHING is now promoted over REDUCE_DISTRACTION!
    best_rec, score, is_adapted, _ = (
        recommendation_service.select_adaptive_recommendation("HIGHLY_DISTRACTED", stu_a.id, db_session)
    )
    assert best_rec.recommendation_type == "REDUCE_CONTEXT_SWITCHING"
    assert is_adapted is True

    # 4. End-to-end generate_student_recommendation uses the adaptive selector
    sess_test = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime(2026, 10, 6, 10, 0, tzinfo=timezone.utc),
        status="completed",
    )
    db_session.add(sess_test)
    db_session.commit()

    # Add activity telemetry with high distraction so persona evaluates to HIGHLY_DISTRACTED
    act = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=sess_test.id,
        activity_type="distraction",
        occurred_at=datetime(2026, 10, 6, 10, 5, tzinfo=timezone.utc),
        numeric_value=1200.0,
    )
    act2 = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=sess_test.id,
        activity_type="productive",
        occurred_at=datetime(2026, 10, 6, 10, 15, tzinfo=timezone.utc),
        numeric_value=600.0,
    )
    db_session.add_all([act, act2])
    db_session.commit()

    adapted_event = recommendation_service.generate_student_recommendation(
        stu_a.id, sess_test.id, db_session
    )
    assert adapted_event.selector_version == "v1.1-adaptive"
    adapted_rec = db_session.get(Recommendation, adapted_event.recommendation_id)
    assert adapted_rec is not None
    assert adapted_rec.recommendation_type == "REDUCE_CONTEXT_SWITCHING"
    assert "via adaptive feedback" in adapted_event.selection_reason
    assert adapted_event.selection_context["adaptive_feedback"]["is_adapted"] is True


def test_task17_19_student_isolation_in_feedback_loop(
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    db_session: Session,
):
    """Student B's negative outcomes must NOT alter Student A's recommendation ranking."""
    stu_a, _ = student_a
    stu_b, _ = student_b
    recommendation_service.ensure_default_recommendation_catalog(db_session)

    rec_dist = db_session.scalar(
        select(Recommendation).where(Recommendation.recommendation_type == "REDUCE_DISTRACTION")
    )

    # Student B has strong negative outcomes on REDUCE_DISTRACTION
    sess_b = StudySession(
        id=uuid.uuid4(),
        student_id=stu_b.id,
        started_at=datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc),
        status="completed",
    )
    db_session.add(sess_b)
    db_session.commit()

    ev_b = RecommendationEvent(
        id=uuid.uuid4(),
        student_id=stu_b.id,
        source_session_id=sess_b.id,
        recommendation_id=rec_dist.id,
        selection_reason="B event",
        selector_version="v1.0",
        behavioural_persona="HIGHLY_DISTRACTED",
        selection_context={},
    )
    db_session.add(ev_b)
    db_session.commit()

    out_b = RecommendationOutcome(
        id=uuid.uuid4(),
        recommendation_event_id=ev_b.id,
        recommendation_followed=False,
        delta_focus_next_session=-15.0,
        outcome_status="measured",
    )
    db_session.add(out_b)
    db_session.commit()

    # Student A has NO history -> signals must be empty
    signals_a = recommendation_service.compute_student_recommendation_signals(stu_a.id, db_session)
    assert signals_a == {}

    # Student A still gets un-adapted default REDUCE_DISTRACTION
    rec_a, score_a, is_adapted_a, _ = (
        recommendation_service.select_adaptive_recommendation("HIGHLY_DISTRACTED", stu_a.id, db_session)
    )
    assert rec_a.recommendation_type == "REDUCE_DISTRACTION"
    assert is_adapted_a is False
    assert score_a == 10.0


def test_task17_19_recommendations_effectiveness_api(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Test the /api/v1/student/recommendations/effectiveness endpoint and tenant isolation."""
    stu_a, auth_a = student_a
    _, auth_b = student_b
    setup_token_mock(monkeypatch, auth_a)
    recommendation_service.ensure_default_recommendation_catalog(db_session)

    # 1. Fetch effectiveness with no history -> clean zeroed state
    resp = client.get(
        "/api/v1/student/recommendations/effectiveness",
        headers={"Authorization": "Bearer token-a"},
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["student_id"] == str(stu_a.id)
    assert data["total_recommendations_issued"] == 0
    assert data["total_measured_deltas"] == 0
    assert len(data["type_breakdown"]) >= 6

    # 2. Add an outcome with positive delta for Student A
    rec_pom = db_session.scalar(
        select(Recommendation).where(Recommendation.recommendation_type == "STRUCTURED_BREAKS")
    )
    sess = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc),
        status="completed",
    )
    db_session.add(sess)
    db_session.commit()

    ev = RecommendationEvent(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        source_session_id=sess.id,
        recommendation_id=rec_pom.id,
        selection_reason="Test event",
        selector_version="v1.0",
        behavioural_persona="FATIGUED_STUDIER",
        selection_context={},
    )
    db_session.add(ev)
    db_session.commit()

    out = RecommendationOutcome(
        id=uuid.uuid4(),
        recommendation_event_id=ev.id,
        recommendation_followed=True,
        delta_focus_next_session=5.0,
        outcome_status="measured",
    )
    db_session.add(out)
    db_session.commit()

    # 3. Fetch again -> reflects measured outcomes
    resp2 = client.get(
        "/api/v1/student/recommendations/effectiveness",
        headers={"Authorization": "Bearer token-a"},
    )
    assert resp2.status_code == status.HTTP_200_OK
    data2 = resp2.json()
    assert data2["total_recommendations_issued"] == 1
    assert data2["total_measured_deltas"] == 1
    assert data2["average_overall_focus_delta"] == 5.0
    assert data2["positive_outcomes_count"] == 1

    # 4. Cross-student isolation: Student B gets clean 0 metrics
    setup_token_mock(monkeypatch, auth_b)
    resp_b = client.get(
        "/api/v1/student/recommendations/effectiveness",
        headers={"Authorization": "Bearer token-b"},
    )
    assert resp_b.status_code == status.HTTP_200_OK
    assert resp_b.json()["total_recommendations_issued"] == 0
    assert resp_b.json()["total_measured_deltas"] == 0


def test_recommendation_generation_idempotency_and_distinct_sessions(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that multiple generation calls for the same session are strictly idempotent,

    while distinct sessions generate separate legitimate recommendation events.
    """
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)

    now = datetime.now(timezone.utc)
    sess1 = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=now,
        status="completed",
    )
    sess2 = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=now,
        status="completed",
    )
    db_session.add_all([sess1, sess2])
    db_session.commit()

    act1 = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=sess1.id,
        activity_type="productive",
        occurred_at=now,
        numeric_value=1200.0,
        metadata_json={"application_name": "IDE"},
    )
    act2 = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=sess2.id,
        activity_type="productive",
        occurred_at=now,
        numeric_value=1200.0,
        metadata_json={"application_name": "IDE"},
    )
    db_session.add_all([act1, act2])
    db_session.commit()

    # 1. Generate for session 1 twice
    ev1_first = recommendation_service.generate_student_recommendation(stu_a.id, sess1.id, db_session)
    ev1_second = recommendation_service.generate_student_recommendation(stu_a.id, sess1.id, db_session)
    assert ev1_first.id == ev1_second.id, "Duplicate generation must return identical event"

    # 2. Generate for session 2 -> distinct event
    ev2 = recommendation_service.generate_student_recommendation(stu_a.id, sess2.id, db_session)
    assert ev2.id != ev1_first.id, "Separate sessions must generate distinct recommendation events"
    assert ev2.source_session_id == sess2.id


def test_outcome_recording_endpoints_and_honest_measurement(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify both /outcome and /outcomes endpoints, and ensure status is pending/unmeasured

    without fabricating focus deltas when comparison windows are absent.
    """
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)

    t0 = datetime(2026, 10, 15, 10, 0, tzinfo=timezone.utc)
    sess = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=t0,
        status="completed",
    )
    db_session.add(sess)
    db_session.commit()

    act = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=sess.id,
        activity_type="productive",
        occurred_at=t0,
        numeric_value=1500.0,
        metadata_json={"application_name": "IDE"},
    )
    db_session.add(act)
    db_session.commit()

    event = recommendation_service.generate_student_recommendation(stu_a.id, sess.id, db_session)

    # Initially, history reports unmeasured with no focus delta
    hist_resp = client.get(
        "/api/v1/student/recommendations/history",
        headers={"Authorization": "Bearer token-a"},
    )
    assert hist_resp.status_code == status.HTTP_200_OK
    items = hist_resp.json()
    assert len(items) == 1
    assert items[0]["outcome_status"] == "unmeasured"
    assert items[0]["recommendation_followed"] is None
    assert items[0]["delta_focus_next_session"] is None

    # Test /outcomes plural alias compatibility
    out_resp = client.post(
        f"/api/v1/student/recommendations/events/{event.id}/outcomes",
        json={"recommendation_followed": True},
        headers={"Authorization": "Bearer token-a"},
    )
    assert out_resp.status_code == status.HTTP_200_OK
    data = out_resp.json()
    assert data["recommendation_followed"] is True
    assert data["outcome_status"] == "pending"
    assert data["delta_focus_next_session"] is None, "Never fabricate delta when no next session exists"

    # Verify history now reflects pending status without fabricated metrics
    hist_resp2 = client.get(
        "/api/v1/student/recommendations/history",
        headers={"Authorization": "Bearer token-a"},
    )
    item2 = hist_resp2.json()[0]
    assert item2["outcome_status"] == "pending"
    assert item2["recommendation_followed"] is True
    assert item2["delta_focus_next_session"] is None




