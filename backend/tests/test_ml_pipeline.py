"""Task 11 Unit & Integration Tests: AI/ML Behaviour Analysis Pipeline.

Verifies synthetic dataset reproducibility, target leakage checks, model artifact
loading, prediction bounds, real-data gating, quiz score enrichment, ownership
isolation, and end-to-end ML inferences.
"""

import uuid
from datetime import datetime, timezone

import numpy as np
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.entities import Parent, StudyActivity, StudySession, Student, Subject
from app.services import ml_service, student_service, supabase
from ml.data.generate_dataset import generate_synthetic_dataset
from ml.features.feature_pipeline import (
    FEATURE_NAMES,
    TARGET_NAMES,
    prepare_feature_dataframe,
    verify_no_target_leakage,
)


def setup_token_mock(monkeypatch: pytest.MonkeyPatch, auth_user_id: uuid.UUID):
    def mock_verify(token: str):
        return {"id": str(auth_user_id), "email": "student@focussense.ai"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify)


# ---------------------------------------------------------------------------
# 1. Dataset & Pipeline Integrity Tests
# ---------------------------------------------------------------------------
def test_synthetic_dataset_reproducibility_and_leakage():
    df1 = generate_synthetic_dataset(num_samples=100, random_seed=42)
    df2 = generate_synthetic_dataset(num_samples=100, random_seed=42)

    assert df1.equals(df2)
    assert len(df1) == 100

    # Verify target leakage absence
    assert verify_no_target_leakage() is True
    for name in FEATURE_NAMES:
        assert name not in TARGET_NAMES


def test_prepare_feature_dataframe_ordering():
    raw_sample = {
        "quiz_score": 88.0,
        "total_session_duration": 3600.0,
        "productive_duration": 3000.0,
        "distraction_duration": 300.0,
        "break_duration": 300.0,
        "productive_activity_ratio": 0.8333,
        "distraction_activity_ratio": 0.0833,
        "activity_switch_count": 2,
        "activity_count": 5,
        "unique_application_count": 2,
    }
    df = prepare_feature_dataframe(raw_sample)
    assert list(df.columns) == FEATURE_NAMES
    assert df.loc[0, "quiz_score"] == 88.0
    assert df.loc[0, "total_session_duration"] == 3600.0


# ---------------------------------------------------------------------------
# 2. Model Artifact & Prediction Service Tests
# ---------------------------------------------------------------------------
def test_predict_behaviour_bounds_and_validity():
    raw_sample = {
        "total_session_duration": 3600.0,
        "productive_duration": 3000.0,
        "distraction_duration": 300.0,
        "break_duration": 300.0,
        "productive_activity_ratio": 0.8333,
        "distraction_activity_ratio": 0.0833,
        "activity_switch_count": 2,
        "activity_count": 5,
        "unique_application_count": 2,
        "quiz_score": None,  # Test missing quiz score imputation
    }

    result = ml_service.predict_behaviour(raw_sample)

    assert "focus_score" in result
    assert "distraction_level" in result
    assert "performance_prediction" in result
    assert "model_version" in result

    assert 0.0 <= result["focus_score"] <= 100.0
    assert result["distraction_level"] in ("LOW", "MEDIUM", "HIGH")
    assert 0.0 <= result["performance_prediction"] <= 100.0
    assert result["model_version"] == "v1.0"


# ---------------------------------------------------------------------------
# 3. Real-Data Gate & Backend API Integration Tests
# ---------------------------------------------------------------------------
def test_insufficient_activity_real_data_gate(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)

    # 1. Create a session with NO activities
    session = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime.now(timezone.utc),
        status="active",
    )
    db_session.add(session)
    db_session.commit()

    # 2. Attempt to generate analysis on empty session -> Real-Data Gate returns 400 Bad Request
    with pytest.raises(Exception) as exc_info:
        student_service.generate_session_behaviour_analysis(session.id, stu_a.id, db_session)
    assert "Insufficient activity telemetry data" in str(exc_info.value)


def test_successful_real_data_ml_inference(
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

    # 1. Create active session for Student A
    session = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime.now(timezone.utc),
        status="active",
    )
    db_session.add(session)
    db_session.commit()

    # 2. Add real activity telemetry (25 mins productive, 5 mins distraction)
    act1 = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=session.id,
        activity_type="productive",
        occurred_at=datetime.now(timezone.utc),
        numeric_value=1500.0,
        metadata_json={"application_name": "VS Code"},
    )
    act2 = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=session.id,
        activity_type="distraction",
        occurred_at=datetime.now(timezone.utc),
        numeric_value=300.0,
        metadata_json={"application_name": "Social Media"},
    )
    db_session.add_all([act1, act2])
    db_session.commit()

    # 3. Generate ML analysis for session
    analysis = student_service.generate_session_behaviour_analysis(session.id, stu_a.id, db_session)

    assert analysis.study_session_id == session.id
    assert 0.0 <= analysis.focus_score <= 100.0
    assert analysis.distraction_level in ("LOW", "MEDIUM", "HIGH")
    assert 0.0 <= analysis.performance_prediction <= 100.0
    assert analysis.model_version == "v1.0"
    assert analysis.feature_snapshot["productive_activity_ratio"] == 0.8333

    # 4. Verify API response
    resp = client.get(
        "/api/v1/student/behaviour",
        headers={"Authorization": "Bearer token-a"},
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert len(data) >= 1
    latest = data[0]
    assert latest["focus_score"] == analysis.focus_score
    assert latest["distraction_level"] == analysis.distraction_level

    # 5. Cross-student isolation check: Student B gets 404 accessing Student A's analysis
    setup_token_mock(monkeypatch, auth_b)
    b_resp = client.get(
        f"/api/v1/student/behaviour/{analysis.id}",
        headers={"Authorization": "Bearer token-b"},
    )
    assert b_resp.status_code == status.HTTP_404_NOT_FOUND

    # 6. Parent role is forbidden
    setup_token_mock(monkeypatch, auth_parent)
    parent_resp = client.get(
        "/api/v1/student/behaviour",
        headers={"Authorization": "Bearer parent-token"},
    )
    assert parent_resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# 4. Task 12 Student Insight Flow & Linking Tests
# ---------------------------------------------------------------------------
def test_task12_behaviour_insight_flow_linking_and_empty_states(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    stu_a, auth_a = student_a
    stu_b, auth_b = student_b

    # 1. Student B with no sessions returns empty list (no fake prediction created)
    setup_token_mock(monkeypatch, auth_b)
    resp_empty = client.get(
        "/api/v1/student/behaviour",
        headers={"Authorization": "Bearer token-b"},
    )
    assert resp_empty.status_code == status.HTTP_200_OK
    assert resp_empty.json() == []

    # 2. Student A creates session with subject and activity telemetry
    setup_token_mock(monkeypatch, auth_a)
    subject = Subject(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        name="Algorithms",
    )
    db_session.add(subject)
    db_session.commit()
    session = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        subject_id=subject.id,
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
        metadata_json={"application_name": "PyCharm"},
    )
    db_session.add(activity)
    db_session.commit()

    # 3. Generate analysis
    analysis = student_service.generate_session_behaviour_analysis(session.id, stu_a.id, db_session)

    # 4. Retrieve latest analysis via API
    resp = client.get(
        "/api/v1/student/behaviour",
        headers={"Authorization": "Bearer token-a"},
    )
    assert resp.status_code == status.HTTP_200_OK
    items = resp.json()
    assert len(items) == 1
    latest = items[0]

    # Verify session-to-analysis linking fields
    assert latest["study_session_id"] == str(session.id)
    assert latest["subject_name"] == "Algorithms"
    assert latest["session_started_at"] is not None

    # Verify Observed Telemetry Metrics
    snapshot = latest["feature_snapshot"]
    assert snapshot["total_session_duration"] == 1800.0
    assert snapshot["productive_duration"] == 1800.0
    assert snapshot["productive_activity_ratio"] == 1.0
    assert snapshot["distraction_activity_ratio"] == 0.0
    assert snapshot["activity_count"] == 1
    assert snapshot["quiz_score"] is None  # Missing quiz score handled cleanly via None/Imputation

    # Verify AI Predictions
    assert 0.0 <= latest["focus_score"] <= 100.0
    assert latest["distraction_level"] in ("LOW", "MEDIUM", "HIGH")
    assert 0.0 <= latest["performance_prediction"] <= 100.0
    assert latest["model_version"] == "v1.0"
    assert latest["analyzed_at"] is not None


# ---------------------------------------------------------------------------
# 5. Task 13 Focus & Distraction Scoring Pipeline Tests
# ---------------------------------------------------------------------------
def test_task13_focus_and_distraction_scoring(monkeypatch: pytest.MonkeyPatch):
    # 1. Extreme input feature vectors test safe focus score clipping (0.0 to 100.0)
    high_prod_sample = {
        "total_session_duration": 14400.0,
        "productive_duration": 14400.0,
        "distraction_duration": 0.0,
        "break_duration": 0.0,
        "productive_activity_ratio": 1.0,
        "distraction_activity_ratio": 0.0,
        "activity_switch_count": 0,
        "activity_count": 5,
        "unique_application_count": 1,
        "quiz_score": 100.0,
    }
    res_high = ml_service.predict_behaviour(high_prod_sample)
    assert 0.0 <= res_high["focus_score"] <= 100.0
    assert res_high["distraction_level"] in ("LOW", "MEDIUM", "HIGH")

    low_prod_sample = {
        "total_session_duration": 14400.0,
        "productive_duration": 0.0,
        "distraction_duration": 14400.0,
        "break_duration": 0.0,
        "productive_activity_ratio": 0.0,
        "distraction_activity_ratio": 1.0,
        "activity_switch_count": 50,
        "activity_count": 50,
        "unique_application_count": 15,
        "quiz_score": 0.0,
    }
    res_low = ml_service.predict_behaviour(low_prod_sample)
    assert 0.0 <= res_low["focus_score"] <= 100.0
    assert res_low["distraction_level"] in ("LOW", "MEDIUM", "HIGH")

    # 2. Verify explicit error when distraction classifier predicts an unexpected class
    def mock_invalid_predict(X):
        return np.array(["EXTREME_DISTRACTION"])

    artifacts = ml_service.load_ml_artifacts()
    monkeypatch.setattr(artifacts["distraction_model"], "predict", mock_invalid_predict)

    with pytest.raises(ValueError) as exc_info:
        ml_service.predict_behaviour(high_prod_sample)
    assert "Invalid distraction class predicted: EXTREME_DISTRACTION" in str(exc_info.value)



