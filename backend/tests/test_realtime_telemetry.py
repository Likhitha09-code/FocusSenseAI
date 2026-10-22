"""Tests for Real-Time Telemetry and Browser Monitoring Events.

Verifies event validation, duplicate idempotency, interruption tracking,
reconciliation, and ML feature derivation in isolated SQLite environment.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.entities import Student
from app.services import ml_service, student_service
from tests.conftest import setup_token_mock


def _assert_isolated_test_db(db_session: Session) -> None:
    db_url = str(db_session.bind.url)
    assert db_url == "sqlite:///:memory:", f"CRITICAL SAFETY VIOLATION: {db_url}"


def test_activity_create_expanded_types_validation(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that real-time monitoring event types (interruption, tab_switch, etc.) are valid."""
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-a"}

    # Start session
    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={"status": "active"},
        headers=headers,
    )
    assert sess_resp.status_code == status.HTTP_201_CREATED
    sess_id = sess_resp.json()["id"]

    # Valid real-time event types
    valid_types = [
        "productive",
        "interruption",
        "tab_switch",
        "focus_loss",
        "heartbeat",
        "unknown",
        "distraction",
        "study",
    ]
    for act_type in valid_types:
        resp = client.post(
            f"/api/v1/student/sessions/{sess_id}/activities",
            json={
                "activity_type": act_type,
                "application_name": f"App for {act_type}",
                "duration_seconds": 30.0,
            },
            headers=headers,
        )
        assert resp.status_code == status.HTTP_201_CREATED, f"Failed for valid type: {act_type}"
        assert resp.json()["activity_type"] == act_type

    # Resilient field handling: metadata_json=None accepted and coerced to dict
    meta_none_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "productive",
            "metadata_json": None,
            "duration_seconds": 15.0,
        },
        headers=headers,
    )
    assert meta_none_resp.status_code == status.HTTP_201_CREATED
    assert isinstance(meta_none_resp.json()["metadata_json"], dict)

    # Resilient field handling: overly long application name safely truncated to <= 200 chars
    long_app_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "productive",
            "application_name": "https://example.com/very/long/url/path/" + ("a" * 250),
            "duration_seconds": 20.0,
        },
        headers=headers,
    )
    assert long_app_resp.status_code == status.HTTP_201_CREATED
    assert len(long_app_resp.json()["metadata_json"].get("application_name", "")) <= 200

    # Invalid activity type rejected with 422
    bad_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "invalid_fake_category",
            "duration_seconds": 30.0,
        },
        headers=headers,
    )
    assert bad_resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_activity_duplicate_idempotency_handling(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that network reconnects resending client_event_id do not create duplicate records."""
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-a"}

    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={"status": "active"},
        headers=headers,
    )
    sess_id = sess_resp.json()["id"]

    # Send initial activity with client_event_id
    payload = {
        "activity_type": "interruption",
        "application_name": "Tab Switch / Window Blur",
        "duration_seconds": 45.0,
        "metadata_json": {
            "client_event_id": "evt-unique-abc-123",
            "source": "web_focus_monitor",
        },
    }
    first_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json=payload,
        headers=headers,
    )
    assert first_resp.status_code == status.HTTP_201_CREATED
    first_id = first_resp.json()["id"]

    # Resend identical event (simulating network reconnect)
    second_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json=payload,
        headers=headers,
    )
    assert second_resp.status_code == status.HTTP_201_CREATED
    second_id = second_resp.json()["id"]

    # Must return the identical existing record without creating a duplicate
    assert first_id == second_id

    # Verify activity count is exactly 1
    acts_resp = client.get(
        f"/api/v1/student/sessions/{sess_id}/activities",
        headers=headers,
    )
    assert len(acts_resp.json()) == 1


def test_session_interruption_and_switch_aggregation(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that real-time interruptions, tab switches, and focus losses aggregate accurately."""
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-a"}

    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={"status": "active"},
        headers=headers,
    )
    sess_id = sess_resp.json()["id"]

    # 1. Productive study on study page (15 mins = 900s)
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "productive",
            "application_name": "Operating Systems",
            "duration_seconds": 900.0,
        },
        headers=headers,
    )

    # 2. Interruption: user switched tab to Social Media (5 mins = 300s)
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "distraction",
            "application_name": "youtube.com",
            "duration_seconds": 300.0,
        },
        headers=headers,
    )

    # 3. Focus loss: unobserved window blur (2 mins = 120s)
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "focus_loss",
            "application_name": "External Window",
            "duration_seconds": 120.0,
        },
        headers=headers,
    )

    # 4. Returned to productive study (8 mins = 480s)
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "productive",
            "application_name": "Operating Systems",
            "duration_seconds": 480.0,
        },
        headers=headers,
    )

    # Verify Aggregated Summary
    sum_resp = client.get(
        f"/api/v1/student/sessions/{sess_id}/activities/summary",
        headers=headers,
    )
    assert sum_resp.status_code == status.HTTP_200_OK
    summary = sum_resp.json()

    # Total duration = 900 + 300 + 120 + 480 = 1800s (30 mins)
    assert summary["total_duration_seconds"] == 1800.0
    assert summary["productive_duration_seconds"] == 1380.0  # 900 + 480
    assert summary["distraction_duration_seconds"] == 300.0
    assert summary["unknown_duration_seconds"] == 120.0
    assert summary["interruption_count"] == 2  # distraction + focus_loss
    assert summary["activity_switch_count"] == 3  # OS -> youtube -> External -> OS
    assert summary["unique_application_count"] == 3

    # Productive percentage = 1380 / 1800 * 100 = 76.7%
    assert summary["productive_percentage"] == 76.7
    assert summary["distraction_percentage"] == 16.7


def test_session_with_telemetry_does_not_overwrite_with_pure_productive(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that concluding a session with recorded interruptions never falsely reports 100% productive."""
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-a"}

    start_time = datetime.now(timezone.utc) - timedelta(minutes=20)
    end_time = datetime.now(timezone.utc)

    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={"started_at": start_time.isoformat(), "status": "active"},
        headers=headers,
    )
    sess_id = sess_resp.json()["id"]

    # Real telemetry logged: 10 mins productive, 10 mins distraction
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={"activity_type": "productive", "duration_seconds": 600.0, "application_name": "Study"},
        headers=headers,
    )
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={"activity_type": "distraction", "duration_seconds": 600.0, "application_name": "reddit.com"},
        headers=headers,
    )

    # Conclude with auto_record_activity=True
    client.patch(
        f"/api/v1/student/sessions/{sess_id}",
        json={"ended_at": end_time.isoformat(), "status": "completed", "auto_record_activity": True},
        headers=headers,
    )

    # Activities must remain the 2 real recorded activities
    acts_resp = client.get(
        f"/api/v1/student/sessions/{sess_id}/activities",
        headers=headers,
    )
    acts = acts_resp.json()
    assert len(acts) == 2

    # ML Behaviour Analysis must reflect the actual 50% distraction, not 100% focus
    analysis = student_service.generate_session_behaviour_analysis(
        uuid.UUID(sess_id), stu_a.id, db_session
    )
    assert analysis.feature_snapshot["distraction_duration"] == 600.0
    assert analysis.feature_snapshot["productive_duration"] == 600.0
    assert analysis.feature_snapshot["distraction_activity_ratio"] == 0.5


def test_telemetry_student_ownership_and_tenant_isolation(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that Student B cannot inject telemetry events or inspect activities for Student A's session."""
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    _, auth_b = student_b

    # Student A starts a session
    setup_token_mock(monkeypatch, auth_a)
    headers_a = {"Authorization": "Bearer token-a"}
    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={"status": "active"},
        headers=headers_a,
    )
    sess_id = sess_resp.json()["id"]

    # Student B attempts to log telemetry into Student A's session -> must be rejected with 404
    setup_token_mock(monkeypatch, auth_b)
    headers_b = {"Authorization": "Bearer token-b"}
    bad_post = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "distraction",
            "application_name": "malicious-injection.com",
            "duration_seconds": 60.0,
        },
        headers=headers_b,
    )
    assert bad_post.status_code == status.HTTP_404_NOT_FOUND

    # Student B attempts to view Student A's activity summary -> 404
    bad_get = client.get(
        f"/api/v1/student/sessions/{sess_id}/activities/summary",
        headers=headers_b,
    )
    assert bad_get.status_code == status.HTTP_404_NOT_FOUND


def test_telemetry_timestamp_ordering_and_duration_reconciliation(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that activities are retrieved in chronological order and ratios never exceed [0.0, 1.0]."""
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-a"}

    base_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={"started_at": base_time.isoformat(), "status": "active"},
        headers=headers,
    )
    sess_id = sess_resp.json()["id"]

    # Log 3 events with explicit out-of-order post requests
    t1 = base_time + timedelta(minutes=1)
    t2 = base_time + timedelta(minutes=4)
    t3 = base_time + timedelta(minutes=7)

    # Post event 2 first
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={"activity_type": "distraction", "occurred_at": t2.isoformat(), "duration_seconds": 120.0, "application_name": "youtube.com"},
        headers=headers,
    )
    # Post event 1 second
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={"activity_type": "productive", "occurred_at": t1.isoformat(), "duration_seconds": 180.0, "application_name": "VS Code"},
        headers=headers,
    )
    # Post event 3 third
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={"activity_type": "productive", "occurred_at": t3.isoformat(), "duration_seconds": 180.0, "application_name": "Terminal"},
        headers=headers,
    )

    # Activities list must be sorted chronologically by occurred_at asc
    acts_resp = client.get(
        f"/api/v1/student/sessions/{sess_id}/activities",
        headers=headers,
    )
    assert acts_resp.status_code == status.HTTP_200_OK
    acts = acts_resp.json()
    assert len(acts) == 3
    assert acts[0]["metadata_json"]["application_name"] == "VS Code"
    assert acts[1]["metadata_json"]["application_name"] == "youtube.com"
    assert acts[2]["metadata_json"]["application_name"] == "Terminal"

    # Aggregated ratios must be mathematically sound
    features = student_service.extract_session_behaviour_features(
        uuid.UUID(sess_id), stu_a.id, db_session
    )
    assert 0.0 <= features["productive_activity_ratio"] <= 1.0
    assert 0.0 <= features["distraction_activity_ratio"] <= 1.0
    assert features["productive_duration"] + features["distraction_duration"] == features["total_session_duration"]


def test_tab_switch_activity_logging_and_switch_count_increments(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that browser extension tab switch payloads increment context switches and affect ML features."""
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-a"}

    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={"status": "active"},
        headers=headers,
    )
    sess_id = sess_resp.json()["id"]

    # 1. Initial focused study interval on FocusSense web page (45s)
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "productive",
            "application_name": "General Study",
            "duration_seconds": 45.0,
            "metadata_json": {
                "source": "web_focus_monitor",
                "event_type": "page_blur",
                "client_event_id": f"evt-{sess_id}-1-productive",
            },
        },
        headers=headers,
    )

    # 2. Extension records tab switch to a distraction domain (e.g., youtube.com, 25s)
    ext_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "distraction",
            "application_name": "youtube.com",
            "duration_seconds": 25.0,
            "metadata_json": {
                "domain": "youtube.com",
                "category": "distraction",
                "source": "browser_extension",
                "event_type": "tab_switch",
                "client_event_id": f"ext-{sess_id}-2-youtube.com",
            },
        },
        headers=headers,
    )
    assert ext_resp.status_code == status.HTTP_201_CREATED

    # 3. User switches back to FocusSense tab and completes 50s more study
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "productive",
            "application_name": "General Study",
            "duration_seconds": 50.0,
            "metadata_json": {
                "source": "web_focus_monitor",
                "event_type": "session_end_flush",
                "client_event_id": f"evt-{sess_id}-3-productive",
            },
        },
        headers=headers,
    )

    # Conclude session
    client.patch(
        f"/api/v1/student/sessions/{sess_id}",
        json={"status": "completed"},
        headers=headers,
    )

    # Summary query must report 2 context switches, 1 interruption, and non-zero distraction percentage
    summary_resp = client.get(
        f"/api/v1/student/sessions/{sess_id}/activities/summary",
        headers=headers,
    )
    assert summary_resp.status_code == status.HTTP_200_OK
    summary = summary_resp.json()
    assert summary["activity_count"] == 3
    assert summary["activity_switch_count"] == 2
    assert summary["interruption_count"] == 1
    assert summary["productive_percentage"] > 0
    assert summary["distraction_percentage"] > 0

    # ML Behaviour extraction receives real, non-zero context switch count
    features = student_service.extract_session_behaviour_features(
        uuid.UUID(sess_id), stu_a.id, db_session
    )
    assert features["activity_switch_count"] == 2
    assert features["distraction_duration"] == 25.0


def test_extension_api_call_authentication_requirement(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that activity logging enforces student authentication (fails closed without token)."""
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-a"}

    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={"status": "active"},
        headers=headers,
    )
    sess_id = sess_resp.json()["id"]

    # Request without Authorization header must return 401 Unauthorized
    unauth_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "distraction",
            "application_name": "youtube.com",
            "duration_seconds": 15.0,
        },
    )
    assert unauth_resp.status_code == status.HTTP_401_UNAUTHORIZED

    # Request with invalid token must return 401 Unauthorized
    from app.services import supabase as supabase_svc

    def mock_strict_verify(token: str):
        if token != "token-a":
            raise supabase_svc.SupabaseConfigurationError("Invalid token")
        return {"id": str(auth_a), "email": "user@test.com"}

    monkeypatch.setattr(supabase_svc, "verify_access_token", mock_strict_verify)

    invalid_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "distraction",
            "application_name": "youtube.com",
            "duration_seconds": 15.0,
        },
        headers={"Authorization": "Bearer bad-token-xyz"},
    )
    assert invalid_resp.status_code == status.HTTP_401_UNAUTHORIZED


def test_heartbeat_does_not_falsely_increment_switches(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that multiple consecutive heartbeats for the same application do not count as switches."""
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-a"}

    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={"status": "active"},
        headers=headers,
    )
    sess_id = sess_resp.json()["id"]

    # Two consecutive productive intervals for the same application
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={"activity_type": "productive", "application_name": "Physics Study", "duration_seconds": 30.0},
        headers=headers,
    )
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={"activity_type": "productive", "application_name": "Physics Study", "duration_seconds": 30.0},
        headers=headers,
    )

    summary_resp = client.get(
        f"/api/v1/student/sessions/{sess_id}/activities/summary",
        headers=headers,
    )
    summary = summary_resp.json()
    assert summary["activity_count"] == 2
    assert summary["activity_switch_count"] == 0


def test_hybrid_fallback_and_reconnect_telemetry_flow(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that web fallback handles interruptions when extension is disconnected and seamlessly reconciles on reconnect."""
    _assert_isolated_test_db(db_session)
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)
    headers = {"Authorization": "Bearer token-a"}

    sess_resp = client.post(
        "/api/v1/student/sessions",
        json={"status": "active"},
        headers=headers,
    )
    sess_id = sess_resp.json()["id"]

    # 1. Productive focus interval on FocusSense web page (30s)
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "productive",
            "application_name": "Operating Systems",
            "duration_seconds": 30.0,
            "metadata_json": {
                "source": "web_focus_monitor",
                "client_event_id": f"evt-{sess_id}-1-focus",
            },
        },
        headers=headers,
    )

    # 2. Extension disconnected/invalidated -> Web fallback logs interruption on window blur/tab switch (15s)
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "interruption",
            "application_name": "Browser Tab Switch / Window Blur",
            "duration_seconds": 15.0,
            "metadata_json": {
                "source": "web_focus_monitor",
                "event_type": "page_focus",
                "client_event_id": f"evt-{sess_id}-2-web-interruption",
            },
        },
        headers=headers,
    )

    # 3. Extension reconnects -> Records cross-tab domain activity directly (e.g., youtube.com, 20s)
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "distraction",
            "application_name": "youtube.com",
            "duration_seconds": 20.0,
            "metadata_json": {
                "domain": "youtube.com",
                "source": "browser_extension",
                "event_type": "tab_switch",
                "client_event_id": f"ext-{sess_id}-3-youtube.com",
            },
        },
        headers=headers,
    )

    # 4. Final productive interval on FocusSense
    client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "productive",
            "application_name": "Operating Systems",
            "duration_seconds": 35.0,
            "metadata_json": {
                "source": "web_focus_monitor",
                "client_event_id": f"evt-{sess_id}-4-focus",
            },
        },
        headers=headers,
    )

    # Conclude session
    client.patch(
        f"/api/v1/student/sessions/{sess_id}",
        json={"status": "completed"},
        headers=headers,
    )

    # Summary validation
    summary_resp = client.get(
        f"/api/v1/student/sessions/{sess_id}/activities/summary",
        headers=headers,
    )
    summary = summary_resp.json()
    assert summary["activity_count"] == 4
    assert summary["interruption_count"] == 2
    assert summary["activity_switch_count"] >= 3
    assert summary["total_duration_seconds"] == 100.0
    assert summary["productive_duration_seconds"] == 65.0
    assert summary["distraction_duration_seconds"] == 35.0
    assert summary["interruption_duration_seconds"] == 35.0

