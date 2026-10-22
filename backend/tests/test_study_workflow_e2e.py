"""End-to-End Workflow & Tenant Isolation Tests for FocusSense AI.

Executed strictly in an isolated in-memory SQLite database environment.
Never connects to live Supabase or mutates production data.
"""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.entities import Student, StudySession
from app.services import ml_service, student_service
from tests.conftest import setup_token_mock


def _assert_isolated_test_db(db_session: Session) -> None:
    """Enforce fail-closed guard: ensure tests run strictly in-memory SQLite."""
    db_url = str(db_session.bind.url)
    assert db_url == "sqlite:///:memory:", f"CRITICAL SAFETY VIOLATION: Not using in-memory SQLite: {db_url}"


# ---------------------------------------------------------------------------
# Test Case A: Full Study Workflow Lifecycle
# ---------------------------------------------------------------------------
def test_full_study_workflow_lifecycle(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-student-a"}

    # 1. Create a Subject
    subj_resp = client.post(
        "/api/v1/student/subjects",
        json={"name": "Computer Science"},
        headers=headers,
    )
    assert subj_resp.status_code == status.HTTP_201_CREATED
    subj_data = subj_resp.json()
    subj_id = subj_data["id"]
    assert subj_data["name"] == "Computer Science"
    assert subj_data["student_id"] == str(stu_a.id)

    # 2. Start a Study Session linked to Subject
    start_time = datetime.now(timezone.utc)
    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={
            "subject_id": subj_id,
            "started_at": start_time.isoformat(),
            "status": "active",
        },
        headers=headers,
    )
    assert sess_resp.status_code == status.HTTP_201_CREATED
    sess_data = sess_resp.json()
    sess_id = sess_data["id"]
    assert sess_data["status"] == "active"
    assert sess_data["subject_id"] == subj_id
    assert sess_data["student_id"] == str(stu_a.id)
    assert sess_data["ended_at"] is None

    # 3. Log Productive Activity (25 minutes = 1500 seconds)
    act1_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "productive",
            "application_name": "VS Code",
            "duration_seconds": 1500.0,
        },
        headers=headers,
    )
    assert act1_resp.status_code == status.HTTP_201_CREATED
    act1_data = act1_resp.json()
    assert act1_data["activity_type"] == "productive"
    assert act1_data["metadata_json"]["application_name"] == "VS Code"

    # 4. Log Distraction Activity (5 minutes = 300 seconds)
    act2_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "distraction",
            "application_name": "Social Media",
            "duration_seconds": 300.0,
        },
        headers=headers,
    )
    assert act2_resp.status_code == status.HTTP_201_CREATED
    act2_data = act2_resp.json()
    assert act2_data["activity_type"] == "distraction"

    # 5. Verify Aggregated Activity Summary
    summary_resp = client.get(
        f"/api/v1/student/sessions/{sess_id}/activities/summary",
        headers=headers,
    )
    assert summary_resp.status_code == status.HTTP_200_OK
    summary = summary_resp.json()
    assert summary["total_duration_seconds"] == 1800.0  # 30 mins
    assert summary["productive_duration_seconds"] == 1500.0
    assert summary["distraction_duration_seconds"] == 300.0
    assert summary["productive_percentage"] == round((1500.0 / 1800.0) * 100.0, 1)
    assert summary["distraction_percentage"] == round((300.0 / 1800.0) * 100.0, 1)
    assert summary["activity_count"] == 2
    assert summary["activity_switch_count"] == 1
    assert summary["unique_application_count"] == 2

    # 6. Conclude Study Session (PATCH)
    end_time = datetime.now(timezone.utc)
    patch_resp = client.patch(
        f"/api/v1/student/sessions/{sess_id}",
        json={"status": "completed", "ended_at": end_time.isoformat()},
        headers=headers,
    )
    assert patch_resp.status_code == status.HTTP_200_OK
    assert patch_resp.json()["status"] == "completed"
    assert patch_resp.json()["ended_at"] is not None

    # 7. Trigger & Verify Behavioural Analysis Generation
    beh_resp = client.get("/api/v1/student/behaviour", headers=headers)
    assert beh_resp.status_code == status.HTTP_200_OK
    beh_list = beh_resp.json()
    assert len(beh_list) == 1
    analysis = beh_list[0]

    assert analysis["study_session_id"] == sess_id
    assert analysis["subject_name"] == "Computer Science"
    assert 0.0 <= analysis["focus_score"] <= 100.0
    assert analysis["distraction_level"] in ("LOW", "MEDIUM", "HIGH")
    assert 0.0 <= analysis["performance_prediction"] <= 100.0
    assert analysis["model_version"] == "v1.0"
    assert analysis["feature_snapshot"]["productive_activity_ratio"] == round(1500.0 / 1800.0, 4)

    # 8. Verify Dashboard KPI Aggregation
    dash_resp = client.get("/api/v1/student/dashboard", headers=headers)
    assert dash_resp.status_code == status.HTTP_200_OK
    dash = dash_resp.json()
    assert dash["focus_score"] == analysis["focus_score"]
    assert dash["distraction_level"] == analysis["distraction_level"]
    assert dash["study_time_minutes"] >= 0
    assert len(dash["recent_activity"]) == 2


# ---------------------------------------------------------------------------
# Test Case B: Tenant Isolation & Cross-Student Protection
# ---------------------------------------------------------------------------
def test_tenant_isolation_cross_student_protection(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    _, auth_b = student_b

    # Student A creates session and activity
    setup_token_mock(monkeypatch, auth_a)
    headers_a = {"Authorization": "Bearer token-a"}
    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={"status": "active"},
        headers=headers_a,
    )
    sess_id = sess_resp.json()["id"]

    act_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={"activity_type": "productive", "duration_seconds": 600.0},
        headers=headers_a,
    )
    assert act_resp.status_code == status.HTTP_201_CREATED

    # Complete session for Student A and generate analysis
    client.patch(
        f"/api/v1/student/sessions/{sess_id}",
        json={"status": "completed"},
        headers=headers_a,
    )
    analysis = student_service.generate_session_behaviour_analysis(
        uuid.UUID(sess_id), stu_a.id, db_session
    )

    # Switch identity to Student B
    setup_token_mock(monkeypatch, auth_b)
    headers_b = {"Authorization": "Bearer token-b"}

    # B cannot get A's session -> 404
    b_sess_get = client.get(f"/api/v1/student/sessions/{sess_id}", headers=headers_b)
    assert b_sess_get.status_code == status.HTTP_404_NOT_FOUND

    # B cannot patch A's session -> 404
    b_sess_patch = client.patch(
        f"/api/v1/student/sessions/{sess_id}",
        json={"status": "cancelled"},
        headers=headers_b,
    )
    assert b_sess_patch.status_code == status.HTTP_404_NOT_FOUND

    # B cannot log activity to A's session -> 404
    b_act_post = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={"activity_type": "distraction", "duration_seconds": 300.0},
        headers=headers_b,
    )
    assert b_act_post.status_code == status.HTTP_404_NOT_FOUND

    # B cannot view A's activities -> 404
    b_acts_get = client.get(f"/api/v1/student/sessions/{sess_id}/activities", headers=headers_b)
    assert b_acts_get.status_code == status.HTTP_404_NOT_FOUND

    # B cannot view A's behavioural analysis -> 404
    b_beh_get = client.get(f"/api/v1/student/behaviour/{analysis.id}", headers=headers_b)
    assert b_beh_get.status_code == status.HTTP_404_NOT_FOUND

    # B's dashboard has zero data from A
    b_dash_resp = client.get("/api/v1/student/dashboard", headers=headers_b)
    assert b_dash_resp.status_code == status.HTTP_200_OK
    b_dash = b_dash_resp.json()
    assert b_dash["focus_score"] is None
    assert b_dash["study_time_minutes"] == 0
    assert b_dash["recent_activity"] == []


# ---------------------------------------------------------------------------
# Test Case C: Empty-Session Real-Data Gate Safety
# ---------------------------------------------------------------------------
def test_empty_session_real_data_gate(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-a"}

    # 1. Student creates and immediately concludes a session without activities
    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={"status": "active"},
        headers=headers,
    )
    sess_id = sess_resp.json()["id"]

    client.patch(
        f"/api/v1/student/sessions/{sess_id}",
        json={"status": "completed"},
        headers=headers,
    )

    # 2. Direct service call raises 400 Bad Request (Real-Data Gate)
    with pytest.raises(Exception) as exc_info:
        student_service.generate_session_behaviour_analysis(
            uuid.UUID(sess_id), stu_a.id, db_session
        )
    assert "Insufficient activity telemetry data" in str(exc_info.value)

    # 3. List behaviour API returns empty list without inventing fake predictions
    beh_resp = client.get("/api/v1/student/behaviour", headers=headers)
    assert beh_resp.status_code == status.HTTP_200_OK
    assert beh_resp.json() == []


# ---------------------------------------------------------------------------
# Test Case D: Completed-Session Immutability
# ---------------------------------------------------------------------------
def test_completed_session_immutability(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-a"}

    # 1. Create and complete session
    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={"status": "active"},
        headers=headers,
    )
    sess_id = sess_resp.json()["id"]

    client.patch(
        f"/api/v1/student/sessions/{sess_id}",
        json={"status": "completed"},
        headers=headers,
    )

    # 2. Attempt to add new activity to completed session -> 400 Bad Request
    late_act_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={"activity_type": "productive", "duration_seconds": 300.0},
        headers=headers,
    )
    assert late_act_resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "Cannot record activity for a session with status 'completed'" in late_act_resp.json()["detail"]


# ---------------------------------------------------------------------------
# Test Case E: ML Model Loading & Prediction Bounds Verification
# ---------------------------------------------------------------------------
def test_ml_model_artifacts_loading_and_bounds():
    artifacts = ml_service.load_ml_artifacts()
    assert "focus_model" in artifacts
    assert "distraction_model" in artifacts
    assert "performance_model" in artifacts
    assert "preprocessor" in artifacts
    assert artifacts["model_version"] == "v1.0"

    # Extreme high productivity feature vector
    high_prod_sample = {
        "total_session_duration": 7200.0,
        "productive_duration": 6600.0,
        "distraction_duration": 300.0,
        "break_duration": 300.0,
        "productive_activity_ratio": round(6600.0 / 7200.0, 4),
        "distraction_activity_ratio": round(300.0 / 7200.0, 4),
        "activity_switch_count": 2,
        "activity_count": 6,
        "unique_application_count": 2,
        "quiz_score": 95.0,
    }
    preds_high = ml_service.predict_behaviour(high_prod_sample)
    assert 0.0 <= preds_high["focus_score"] <= 100.0
    assert preds_high["distraction_level"] in ("LOW", "MEDIUM", "HIGH")
    assert 0.0 <= preds_high["performance_prediction"] <= 100.0
    assert preds_high["model_version"] == "v1.0"

    # Extreme high distraction feature vector
    high_dist_sample = {
        "total_session_duration": 7200.0,
        "productive_duration": 600.0,
        "distraction_duration": 6000.0,
        "break_duration": 600.0,
        "productive_activity_ratio": round(600.0 / 7200.0, 4),
        "distraction_activity_ratio": round(6000.0 / 7200.0, 4),
        "activity_switch_count": 45,
        "activity_count": 45,
        "unique_application_count": 12,
        "quiz_score": 35.0,
    }
    preds_dist = ml_service.predict_behaviour(high_dist_sample)
    assert 0.0 <= preds_dist["focus_score"] <= 100.0
    assert preds_dist["distraction_level"] in ("LOW", "MEDIUM", "HIGH")
    assert 0.0 <= preds_dist["performance_prediction"] <= 100.0
    assert preds_dist["model_version"] == "v1.0"


# ---------------------------------------------------------------------------
# Test Case F: Focused Session Completion with Activity Recording & No-Activity Cases
# ---------------------------------------------------------------------------
def test_focused_session_completion_records_valid_activity(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that concluding a focused session with auto_record_activity=True records telemetry."""
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-a"}

    # 1. Start active session (simulating 15 minutes of study)
    from datetime import timedelta
    start_time = datetime.now(timezone.utc) - timedelta(minutes=15)
    end_time = datetime.now(timezone.utc)

    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={
            "started_at": start_time.isoformat(),
            "status": "active",
        },
        headers=headers,
    )
    assert sess_resp.status_code == status.HTTP_201_CREATED
    sess_id = sess_resp.json()["id"]

    # 2. Conclude session with auto_record_activity=True
    patch_resp = client.patch(
        f"/api/v1/student/sessions/{sess_id}",
        json={
            "ended_at": end_time.isoformat(),
            "status": "completed",
            "auto_record_activity": True,
        },
        headers=headers,
    )
    assert patch_resp.status_code == status.HTTP_200_OK

    # 3. Verify activity record is present and associated with this session and student
    acts_resp = client.get(
        f"/api/v1/student/sessions/{sess_id}/activities",
        headers=headers,
    )
    assert acts_resp.status_code == status.HTTP_200_OK
    acts = acts_resp.json()
    assert len(acts) == 1
    assert acts[0]["study_session_id"] == sess_id
    assert acts[0]["activity_type"] == "productive"
    assert acts[0]["metadata_json"]["application_name"] == "General Study"
    assert acts[0]["numeric_value"] >= 899.0  # ~900s (15 mins)

    # 4. Verify AI analysis can now be successfully generated from this telemetry
    analysis = student_service.generate_session_behaviour_analysis(
        uuid.UUID(sess_id), stu_a.id, db_session
    )
    assert analysis.focus_score is not None
    assert 0.0 <= analysis.focus_score <= 100.0


def test_session_completion_no_activity_preserves_safety_gate(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that concluding an empty session with 0s duration does not fabricate fake activities."""
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-a"}

    same_time = datetime.now(timezone.utc)
    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={
            "started_at": same_time.isoformat(),
            "status": "active",
        },
        headers=headers,
    )
    sess_id = sess_resp.json()["id"]

    # Conclude with auto_record_activity=True but duration is 0
    client.patch(
        f"/api/v1/student/sessions/{sess_id}",
        json={
            "ended_at": same_time.isoformat(),
            "status": "completed",
            "auto_record_activity": True,
        },
        headers=headers,
    )

    # No activities should have been created
    acts_resp = client.get(
        f"/api/v1/student/sessions/{sess_id}/activities",
        headers=headers,
    )
    assert acts_resp.status_code == status.HTTP_200_OK
    assert len(acts_resp.json()) == 0

    # Attempting to generate AI analysis on empty session must raise 400 Bad Request
    with pytest.raises(Exception) as exc_info:
        student_service.generate_session_behaviour_analysis(
            uuid.UUID(sess_id), stu_a.id, db_session
        )
    assert "Insufficient activity telemetry data" in str(exc_info.value)


def test_session_with_existing_activities_does_not_duplicate_on_auto_record(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that if manual activities already exist, auto_record_activity does not duplicate."""
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-a"}

    start_time = datetime.now(timezone.utc)
    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={"started_at": start_time.isoformat(), "status": "active"},
        headers=headers,
    )
    sess_id = sess_resp.json()["id"]

    # Log manual activity
    act_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={"activity_type": "coding", "duration_seconds": 600.0, "application_name": "VS Code"},
        headers=headers,
    )
    assert act_resp.status_code == status.HTTP_201_CREATED

    # Conclude session with auto_record_activity=True
    client.patch(
        f"/api/v1/student/sessions/{sess_id}",
        json={
            "status": "completed",
            "auto_record_activity": True,
        },
        headers=headers,
    )

    # Activities count must remain exactly 1 (not duplicated)
    acts_resp = client.get(
        f"/api/v1/student/sessions/{sess_id}/activities",
        headers=headers,
    )
    assert acts_resp.status_code == status.HTTP_200_OK
    acts = acts_resp.json()
    assert len(acts) == 1
    assert acts[0]["activity_type"] == "coding"
    assert acts[0]["metadata_json"]["application_name"] == "VS Code"


