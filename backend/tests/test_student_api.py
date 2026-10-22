import uuid
from collections.abc import Generator
from datetime import datetime, timezone

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.entities import (
    BehaviouralAnalysis,
    Parent,
    PerformanceReport,
    Quiz,
    Recommendation,
    RecommendationEvent,
    StudyActivity,
    StudySession,
    Student,
    Subject,
)
from app.services import student_service, supabase


test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def student_a(db_session: Session) -> tuple[Student, uuid.UUID]:
    auth_id = uuid.uuid4()
    student = Student(
        id=uuid.uuid4(),
        auth_user_id=auth_id,
        display_name="Student A",
        department="CSE",
        semester=6,
        academic_year=3,
    )
    db_session.add(student)
    db_session.commit()
    db_session.refresh(student)
    return student, auth_id


@pytest.fixture
def student_b(db_session: Session) -> tuple[Student, uuid.UUID]:
    auth_id = uuid.uuid4()
    student = Student(
        id=uuid.uuid4(),
        auth_user_id=auth_id,
        display_name="Student B",
        department="ECE",
        semester=4,
        academic_year=2,
    )
    db_session.add(student)
    db_session.commit()
    db_session.refresh(student)
    return student, auth_id


@pytest.fixture
def parent_user(db_session: Session) -> tuple[Parent, uuid.UUID]:
    auth_id = uuid.uuid4()
    parent = Parent(
        id=uuid.uuid4(),
        auth_user_id=auth_id,
        display_name="Parent User",
    )
    db_session.add(parent)
    db_session.commit()
    db_session.refresh(parent)
    return parent, auth_id


def setup_token_mock(monkeypatch: pytest.MonkeyPatch, auth_id: uuid.UUID, email: str = "user@test.com"):
    def mock_verify(token: str):
        return {"id": str(auth_id), "email": email}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify)


# ---------------------------------------------------------------------------
# 1. Dashboard API Tests
# ---------------------------------------------------------------------------
def test_dashboard_unauthenticated_returns_401(client: TestClient):
    response = client.get("/api/v1/student/dashboard")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_dashboard_parent_role_forbidden(
    client: TestClient, parent_user: tuple[Parent, uuid.UUID], monkeypatch: pytest.MonkeyPatch
):
    _, auth_id = parent_user
    setup_token_mock(monkeypatch, auth_id)

    response = client.get(
        "/api/v1/student/dashboard",
        headers={"Authorization": "Bearer parent-token"},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_dashboard_empty_database_returns_null_and_empty(
    client: TestClient, student_a: tuple[Student, uuid.UUID], monkeypatch: pytest.MonkeyPatch
):
    _, auth_id = student_a
    setup_token_mock(monkeypatch, auth_id)

    response = client.get(
        "/api/v1/student/dashboard",
        headers={"Authorization": "Bearer student-token"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["focus_score"] is None
    assert data["distraction_level"] is None
    assert data["study_time_minutes"] == 0
    assert data["performance_score"] is None
    assert data["recent_activity"] == []
    assert data["subject_performance"] == []
    assert data["recommendations"] == []


def test_dashboard_reflects_real_student_data_and_isolates_others(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    stu_a, auth_a = student_a
    stu_b, _ = student_b

    # Add a completed study session for student A
    start_time = datetime(2026, 9, 14, 10, 0, tzinfo=timezone.utc)
    end_time = datetime(2026, 9, 14, 11, 30, tzinfo=timezone.utc)  # 90 minutes
    session_a = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=start_time,
        ended_at=end_time,
        status="completed",
    )
    db_session.add(session_a)

    # Add analysis for student A
    analysis_a = BehaviouralAnalysis(
        id=uuid.uuid4(),
        study_session_id=session_a.id,
        feature_snapshot={"context_switches": 4},
        focus_score=78.5,
        distraction_level="medium",
        model_version="v1.0",
        analyzed_at=end_time,
    )
    db_session.add(analysis_a)

    # Add activity for student A
    activity_a = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=session_a.id,
        activity_type="coding",
        occurred_at=datetime(2026, 9, 14, 10, 30, tzinfo=timezone.utc),
        numeric_value=1800.0,
        metadata_json={"app": "VS Code"},
    )
    db_session.add(activity_a)

    # Add data for student B (must NOT bleed into student A's dashboard)
    session_b = StudySession(
        id=uuid.uuid4(),
        student_id=stu_b.id,
        started_at=datetime(2026, 9, 14, 8, 0, tzinfo=timezone.utc),
        ended_at=datetime(2026, 9, 14, 12, 0, tzinfo=timezone.utc),  # 240 minutes
        status="completed",
    )
    db_session.add(session_b)
    db_session.commit()

    setup_token_mock(monkeypatch, auth_a)

    response = client.get(
        "/api/v1/student/dashboard",
        headers={"Authorization": "Bearer token-a"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["focus_score"] == 78.5
    assert data["distraction_level"] == "medium"
    assert data["study_time_minutes"] == 90  # Only Student A's 90 minutes, not Student B's 240!
    assert len(data["recent_activity"]) == 1
    assert data["recent_activity"][0]["activity_type"] == "coding"


# ---------------------------------------------------------------------------
# 2. Study Session API Tests
# ---------------------------------------------------------------------------
def test_study_session_crud_and_ownership(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    monkeypatch: pytest.MonkeyPatch,
):
    stu_a, auth_a = student_a
    _, auth_b = student_b

    # Student A creates a session
    setup_token_mock(monkeypatch, auth_a)
    create_resp = client.post(
        "/api/v1/student/sessions",
        json={"status": "active"},
        headers={"Authorization": "Bearer token-a"},
    )
    assert create_resp.status_code == status.HTTP_201_CREATED
    session_data = create_resp.json()
    session_id = session_data["id"]
    assert session_data["student_id"] == str(stu_a.id)
    assert session_data["status"] == "active"

    # Student A lists sessions
    list_resp = client.post if False else client.get(
        "/api/v1/student/sessions?limit=10&offset=0",
        headers={"Authorization": "Bearer token-a"},
    )
    assert list_resp.status_code == status.HTTP_200_OK
    assert list_resp.json()["total"] == 1
    assert list_resp.json()["items"][0]["id"] == session_id

    # Student A retrieves session by ID
    get_resp = client.get(
        f"/api/v1/student/sessions/{session_id}",
        headers={"Authorization": "Bearer token-a"},
    )
    assert get_resp.status_code == status.HTTP_200_OK
    assert get_resp.json()["id"] == session_id

    # Student A updates session (PATCH)
    patch_resp = client.patch(
        f"/api/v1/student/sessions/{session_id}",
        json={"status": "completed"},
        headers={"Authorization": "Bearer token-a"},
    )
    assert patch_resp.status_code == status.HTTP_200_OK
    assert patch_resp.json()["status"] == "completed"

    # Student B attempts to get Student A's session -> 404 Not Found (privacy)
    setup_token_mock(monkeypatch, auth_b)
    b_get_resp = client.get(
        f"/api/v1/student/sessions/{session_id}",
        headers={"Authorization": "Bearer token-b"},
    )
    assert b_get_resp.status_code == status.HTTP_404_NOT_FOUND

    # Student B attempts to update Student A's session -> 404 Not Found
    b_patch_resp = client.patch(
        f"/api/v1/student/sessions/{session_id}",
        json={"status": "cancelled"},
        headers={"Authorization": "Bearer token-b"},
    )
    assert b_patch_resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# 3. Study Activity API Tests
# ---------------------------------------------------------------------------
def test_study_activities_under_session(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    monkeypatch: pytest.MonkeyPatch,
):
    _, auth_a = student_a
    _, auth_b = student_b

    # Student A creates a session
    setup_token_mock(monkeypatch, auth_a)
    session_resp = client.post(
        "/api/v1/student/sessions",
        json={"status": "active"},
        headers={"Authorization": "Bearer token-a"},
    )
    session_id = session_resp.json()["id"]

    # Student A adds activity
    act_resp = client.post(
        f"/api/v1/student/sessions/{session_id}/activities",
        json={
            "activity_type": "app_focus",
            "numeric_value": 120.0,
            "metadata_json": {"app": "Firefox", "domain": "docs.python.org"},
        },
        headers={"Authorization": "Bearer token-a"},
    )
    assert act_resp.status_code == status.HTTP_201_CREATED
    assert act_resp.json()["activity_type"] == "app_focus"

    # Student A lists activities
    list_acts = client.get(
        f"/api/v1/student/sessions/{session_id}/activities",
        headers={"Authorization": "Bearer token-a"},
    )
    assert list_acts.status_code == status.HTTP_200_OK
    assert len(list_acts.json()) == 1

    # Student B cannot add activity to Student A's session -> 404
    setup_token_mock(monkeypatch, auth_b)
    b_act_resp = client.post(
        f"/api/v1/student/sessions/{session_id}/activities",
        json={"activity_type": "productive"},
        headers={"Authorization": "Bearer token-b"},
    )

    assert b_act_resp.status_code == status.HTTP_404_NOT_FOUND

    # Student B cannot list activities of Student A's session -> 404
    b_list_acts = client.get(
        f"/api/v1/student/sessions/{session_id}/activities",
        headers={"Authorization": "Bearer token-b"},
    )
    assert b_list_acts.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# 4. Behavioural Analysis API Tests
# ---------------------------------------------------------------------------
def test_behavioural_analysis_endpoints(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    stu_a, auth_a = student_a
    _, auth_b = student_b

    setup_token_mock(monkeypatch, auth_a)

    # Empty behaviour list
    resp_empty = client.get(
        "/api/v1/student/behaviour",
        headers={"Authorization": "Bearer token-a"},
    )
    assert resp_empty.status_code == status.HTTP_200_OK
    assert resp_empty.json() == []

    # Create session + analysis for student A
    session = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime.now(timezone.utc),
        status="completed",
    )
    db_session.add(session)
    analysis = BehaviouralAnalysis(
        id=uuid.uuid4(),
        study_session_id=session.id,
        feature_snapshot={"app_switches": 5},
        focus_score=85.0,
        distraction_level="low",
        model_version="v1.0",
    )
    db_session.add(analysis)
    db_session.commit()

    # Retrieve list
    resp_list = client.get(
        "/api/v1/student/behaviour",
        headers={"Authorization": "Bearer token-a"},
    )
    assert resp_list.status_code == status.HTTP_200_OK
    assert len(resp_list.json()) == 1
    assert resp_list.json()[0]["focus_score"] == 85.0

    # Retrieve single analysis by ID
    resp_get = client.get(
        f"/api/v1/student/behaviour/{analysis.id}",
        headers={"Authorization": "Bearer token-a"},
    )
    assert resp_get.status_code == status.HTTP_200_OK
    assert resp_get.json()["id"] == str(analysis.id)

    # Student B cannot access Student A's analysis -> 404
    setup_token_mock(monkeypatch, auth_b)
    b_resp = client.get(
        f"/api/v1/student/behaviour/{analysis.id}",
        headers={"Authorization": "Bearer token-b"},
    )
    assert b_resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# 5. Quizzes and Subjects API Tests
# ---------------------------------------------------------------------------
def test_subjects_and_quizzes(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    monkeypatch: pytest.MonkeyPatch,
):
    _, auth_a = student_a
    _, auth_b = student_b

    setup_token_mock(monkeypatch, auth_a)

    # Student A creates a subject
    subj_resp = client.post(
        "/api/v1/student/subjects",
        json={"name": "Machine Learning"},
        headers={"Authorization": "Bearer token-a"},
    )
    assert subj_resp.status_code == status.HTTP_201_CREATED
    subj_id = subj_resp.json()["id"]

    # Student A creates a quiz under that subject
    quiz_resp = client.post(
        "/api/v1/student/quizzes",
        json={"subject_id": subj_id, "title": "Midterm Quiz 1"},
        headers={"Authorization": "Bearer token-a"},
    )
    assert quiz_resp.status_code == status.HTTP_201_CREATED
    assert quiz_resp.json()["title"] == "Midterm Quiz 1"

    # Student A lists quizzes
    quizzes_resp = client.get(
        "/api/v1/student/quizzes",
        headers={"Authorization": "Bearer token-a"},
    )
    assert quizzes_resp.status_code == status.HTTP_200_OK
    assert len(quizzes_resp.json()) == 1

    # Student B cannot create quiz under Student A's subject -> 404
    setup_token_mock(monkeypatch, auth_b)
    b_quiz_resp = client.post(
        "/api/v1/student/quizzes",
        json={"subject_id": subj_id, "title": "Unauthorized Quiz"},
        headers={"Authorization": "Bearer token-b"},
    )
    assert b_quiz_resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# 6. Recommendations & Intervention Evaluation Tests
# ---------------------------------------------------------------------------
def test_recommendations_and_interventions(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    stu_a, auth_a = student_a
    _, auth_b = student_b

    # Add a recommendation to catalog
    rec = Recommendation(
        id=uuid.uuid4(),
        recommendation_type="reduce_interruptions",
        title="Minimize Task Switching",
        content="Group tab browsing into dedicated 5-minute research windows.",
        is_active=True,
    )
    db_session.add(rec)

    # Add a study session for student A
    session_a = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime.now(timezone.utc),
        status="completed",
    )
    db_session.add(session_a)
    db_session.commit()

    setup_token_mock(monkeypatch, auth_a)

    # 1. List catalog recommendations
    rec_list = client.get(
        "/api/v1/student/recommendations",
        headers={"Authorization": "Bearer token-a"},
    )
    assert rec_list.status_code == status.HTTP_200_OK
    assert len(rec_list.json()) >= 1

    # 2. Get specific recommendation
    rec_get = client.get(
        f"/api/v1/student/recommendations/{rec.id}",
        headers={"Authorization": "Bearer token-a"},
    )
    assert rec_get.status_code == status.HTTP_200_OK
    assert rec_get.json()["id"] == str(rec.id)

    # 3. Create recommendation event for student A
    event_resp = client.post(
        f"/api/v1/student/recommendations/{rec.id}/events",
        json={
            "source_session_id": str(session_a.id),
            "selection_reason": "High frequency of window shifts observed",
            "selector_version": "v1.0",
            "behavioural_persona": "fragmented_focus",
            "selection_context": {"context_switches": 12},
        },
        headers={"Authorization": "Bearer token-a"},
    )
    assert event_resp.status_code == status.HTTP_201_CREATED
    event_data = event_resp.json()
    event_id = event_data["id"]
    assert event_data["recommendation_id"] == str(rec.id)
    assert event_data["student_id"] == str(stu_a.id)

    # 4. Record recommendation outcome (causal tracking)
    outcome_resp = client.post(
        f"/api/v1/student/recommendations/{rec.id}/outcome",
        json={
            "recommendation_event_id": event_id,
            "recommendation_followed": True,
            "next_focus_score": 82.0,
            "delta_focus_next_session": 14.0,  # 82 - 68 focus score
            "outcome_status": "measured",
            "notes": "Student closed social media windows; focus improved.",
        },
        headers={"Authorization": "Bearer token-a"},
    )
    assert outcome_resp.status_code == status.HTTP_200_OK
    outcome_data = outcome_resp.json()
    assert outcome_data["recommendation_followed"] is True
    assert outcome_data["delta_focus_next_session"] == 14.0
    assert outcome_data["outcome_status"] == "measured"

    # 5. Student B cannot record outcome for Student A's event -> 404
    setup_token_mock(monkeypatch, auth_b)
    b_outcome_resp = client.post(
        f"/api/v1/student/recommendations/{rec.id}/outcome",
        json={
            "recommendation_event_id": event_id,
            "recommendation_followed": False,
        },
        headers={"Authorization": "Bearer token-b"},
    )
    assert b_outcome_resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# 7. Task 10 — Study Activity & Behaviour Feature Foundation Tests
# ---------------------------------------------------------------------------
def test_task10_activity_lifecycle_validation_and_features(
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

    # 1. Unauthenticated request is rejected (401)
    unauth_resp = client.get(f"/api/v1/student/sessions/{uuid.uuid4()}/activities")
    assert unauth_resp.status_code == status.HTTP_401_UNAUTHORIZED

    # 2. Parent role token is forbidden (403)
    setup_token_mock(monkeypatch, auth_parent)
    parent_resp = client.get(
        f"/api/v1/student/sessions/{uuid.uuid4()}/activities",
        headers={"Authorization": "Bearer parent-token"},
    )
    assert parent_resp.status_code == status.HTTP_403_FORBIDDEN

    # 3. Create active session for Student A
    setup_token_mock(monkeypatch, auth_a)
    session_resp = client.post(
        "/api/v1/student/sessions",
        json={"status": "active"},
        headers={"Authorization": "Bearer token-a"},
    )
    assert session_resp.status_code == status.HTTP_201_CREATED
    sess_id = session_resp.json()["id"]

    # 4. Invalid activity type is rejected (422)
    invalid_type_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={"activity_type": "invalid_type_category", "duration_seconds": 300},
        headers={"Authorization": "Bearer token-a"},
    )
    assert invalid_type_resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 5. Negative duration is rejected (422)
    neg_dur_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={"activity_type": "productive", "duration_seconds": -100},
        headers={"Authorization": "Bearer token-a"},
    )
    assert neg_dur_resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 6. Successfully log productive activity
    act1_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "productive",
            "application_name": "VS Code",
            "duration_seconds": 1500,  # 25 mins
        },
        headers={"Authorization": "Bearer token-a"},
    )
    assert act1_resp.status_code == status.HTTP_201_CREATED
    assert act1_resp.json()["activity_type"] == "productive"
    assert act1_resp.json()["metadata_json"]["application_name"] == "VS Code"

    # 7. Log distraction activity
    act2_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={
            "activity_type": "distraction",
            "application_name": "Social Media",
            "duration_seconds": 300,  # 5 mins
        },
        headers={"Authorization": "Bearer token-a"},
    )
    assert act2_resp.status_code == status.HTTP_201_CREATED

    # 8. Student B cannot access Student A's activities (404)
    setup_token_mock(monkeypatch, auth_b)
    b_act_resp = client.get(
        f"/api/v1/student/sessions/{sess_id}/activities",
        headers={"Authorization": "Bearer token-b"},
    )
    assert b_act_resp.status_code == status.HTTP_404_NOT_FOUND

    # 9. Get Activity Summary metrics for Student A
    setup_token_mock(monkeypatch, auth_a)
    sum_resp = client.get(
        f"/api/v1/student/sessions/{sess_id}/activities/summary",
        headers={"Authorization": "Bearer token-a"},
    )
    assert sum_resp.status_code == status.HTTP_200_OK
    summary = sum_resp.json()
    assert summary["total_duration_seconds"] == 1800.0  # 30 mins
    assert summary["productive_duration_seconds"] == 1500.0
    assert summary["distraction_duration_seconds"] == 300.0
    assert summary["productive_percentage"] == 83.3
    assert summary["distraction_percentage"] == 16.7
    assert summary["activity_count"] == 2
    assert summary["activity_switch_count"] == 1
    assert summary["unique_application_count"] == 2

    # 10. Conclude session and verify new activity creation is rejected (400)
    client.patch(
        f"/api/v1/student/sessions/{sess_id}",
        json={"status": "completed"},
        headers={"Authorization": "Bearer token-a"},
    )
    completed_act_resp = client.post(
        f"/api/v1/student/sessions/{sess_id}/activities",
        json={"activity_type": "productive", "duration_seconds": 600},
        headers={"Authorization": "Bearer token-a"},
    )
    assert completed_act_resp.status_code == status.HTTP_400_BAD_REQUEST

    # 11. Verify service feature extraction foundation returns deterministic feature dict
    features = student_service.extract_session_behaviour_features(
        uuid.UUID(sess_id), stu_a.id, db_session
    )
    assert features["total_session_duration"] == 1800.0
    assert features["productive_activity_ratio"] == 0.8333
    assert features["distraction_activity_ratio"] == 0.1667
    assert features["activity_switch_count"] == 1
    assert features["activity_count"] == 2




# ---------------------------------------------------------------------------
# 11. Performance Assessment History Regression Tests
# ---------------------------------------------------------------------------
def test_quiz_with_score_creates_persisted_performance_report(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    monkeypatch: pytest.MonkeyPatch,
):
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)

    # 1. Create a subject
    subj_resp = client.post(
        "/api/v1/student/subjects",
        json={"name": "Software Architecture"},
        headers={"Authorization": "Bearer token-a"},
    )
    assert subj_resp.status_code == status.HTTP_201_CREATED
    subj_id = subj_resp.json()["id"]

    # 2. Complete/record a quiz with genuine score
    quiz_resp = client.post(
        "/api/v1/student/quizzes",
        json={
            "subject_id": subj_id,
            "title": "Design Patterns Assessment",
            "score": 92.5,
            "max_score": 100.0,
            "quiz_date": "2026-10-23",
        },
        headers={"Authorization": "Bearer token-a"},
    )
    assert quiz_resp.status_code == status.HTTP_201_CREATED
    quiz_data = quiz_resp.json()
    assert quiz_data["score"] == 92.5
    assert quiz_data["max_score"] == 100.0
    quiz_id = quiz_data["id"]

    # 3. Verify it is persisted and appears in Assessment History (/performance)
    perf_resp = client.get(
        "/api/v1/student/performance",
        headers={"Authorization": "Bearer token-a"},
    )
    assert perf_resp.status_code == status.HTTP_200_OK
    reports = perf_resp.json()
    assert len(reports) == 1
    rep = reports[0]
    assert rep["quiz_id"] == quiz_id
    assert rep["score"] == 92.5
    assert rep["max_score"] == 100.0
    assert rep["performance_metric"] == "Design Patterns Assessment"
    assert rep["subject_name"] == "Software Architecture"
    assert "measured_at" in rep

    # 4. Verify quizzes list endpoint also displays score
    quizzes_resp = client.get(
        "/api/v1/student/quizzes",
        headers={"Authorization": "Bearer token-a"},
    )
    assert quizzes_resp.status_code == status.HTTP_200_OK
    q_list = quizzes_resp.json()
    assert len(q_list) == 1
    assert q_list[0]["score"] == 92.5
    assert q_list[0]["max_score"] == 100.0

    # 5. Verify student dashboard subject performance reflects the assessment score
    dash_resp = client.get(
        "/api/v1/student/dashboard",
        headers={"Authorization": "Bearer token-a"},
    )
    assert dash_resp.status_code == status.HTTP_200_OK
    dash_data = dash_resp.json()
    subj_perf = next(
        (sp for sp in dash_data["subject_performance"] if sp["subject_id"] == subj_id),
        None,
    )
    assert subj_perf is not None
    assert subj_perf["average_score"] == 92.5
    assert subj_perf["total_quizzes"] == 1


def test_direct_performance_report_creation_and_listing(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    monkeypatch: pytest.MonkeyPatch,
):
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)

    # 1. Create a subject
    subj_resp = client.post(
        "/api/v1/student/subjects",
        json={"name": "Mathematics"},
        headers={"Authorization": "Bearer token-a"},
    )
    assert subj_resp.status_code == status.HTTP_201_CREATED
    subj_id = subj_resp.json()["id"]

    # 2. Record a performance assessment directly
    perf_create_resp = client.post(
        "/api/v1/student/performance",
        json={
            "subject_id": subj_id,
            "performance_metric": "Midterm Exam 1",
            "score": 85.0,
            "max_score": 100.0,
        },
        headers={"Authorization": "Bearer token-a"},
    )
    assert perf_create_resp.status_code == status.HTTP_201_CREATED
    created = perf_create_resp.json()
    assert created["score"] == 85.0
    assert created["max_score"] == 100.0
    assert created["performance_metric"] == "Midterm Exam 1"
    assert created["subject_name"] == "Mathematics"
    report_id = created["id"]

    # 3. Retrieve specific performance report
    get_rep_resp = client.get(
        f"/api/v1/student/performance/{report_id}",
        headers={"Authorization": "Bearer token-a"},
    )
    assert get_rep_resp.status_code == status.HTTP_200_OK
    assert get_rep_resp.json()["id"] == report_id


def test_performance_assessment_data_isolation(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    monkeypatch: pytest.MonkeyPatch,
):
    _, auth_a = student_a
    _, auth_b = student_b

    # Student A creates an assessment
    setup_token_mock(monkeypatch, auth_a)
    subj_resp = client.post(
        "/api/v1/student/subjects",
        json={"name": "Data Structures"},
        headers={"Authorization": "Bearer token-a"},
    )
    subj_id = subj_resp.json()["id"]

    rep_resp = client.post(
        "/api/v1/student/performance",
        json={
            "subject_id": subj_id,
            "performance_metric": "Binary Trees Quiz",
            "score": 95.0,
            "max_score": 100.0,
        },
        headers={"Authorization": "Bearer token-a"},
    )
    rep_id = rep_resp.json()["id"]

    # Student B queries performance history -> empty list
    setup_token_mock(monkeypatch, auth_b)
    b_history_resp = client.get(
        "/api/v1/student/performance",
        headers={"Authorization": "Bearer token-b"},
    )
    assert b_history_resp.status_code == status.HTTP_200_OK
    assert b_history_resp.json() == []

    # Student B cannot access Student A's report directly -> 404
    b_get_resp = client.get(
        f"/api/v1/student/performance/{rep_id}",
        headers={"Authorization": "Bearer token-b"},
    )
    assert b_get_resp.status_code == status.HTTP_404_NOT_FOUND


def test_performance_assessment_validation_and_empty_state(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    monkeypatch: pytest.MonkeyPatch,
):
    _, auth_a = student_a

    # 1. Unauthenticated request returns 401
    unauth_resp = client.get("/api/v1/student/performance")
    assert unauth_resp.status_code == status.HTTP_401_UNAUTHORIZED

    setup_token_mock(monkeypatch, auth_a)

    # 2. Genuinely empty history returns 200 with empty list []
    empty_resp = client.get(
        "/api/v1/student/performance",
        headers={"Authorization": "Bearer token-a"},
    )
    assert empty_resp.status_code == status.HTTP_200_OK
    assert empty_resp.json() == []

    # 3. Submitting score > max_score returns 400 Bad Request
    invalid_resp = client.post(
        "/api/v1/student/performance",
        json={
            "performance_metric": "Invalid Exam",
            "score": 105.0,
            "max_score": 100.0,
        },
        headers={"Authorization": "Bearer token-a"},
    )
    assert invalid_resp.status_code == status.HTTP_400_BAD_REQUEST

    # 4. Submitting negative score returns 422 Unprocessable Content
    neg_resp = client.post(
        "/api/v1/student/performance",
        json={
            "performance_metric": "Negative Exam",
            "score": -5.0,
            "max_score": 100.0,
        },
        headers={"Authorization": "Bearer token-a"},
    )
    assert neg_resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
