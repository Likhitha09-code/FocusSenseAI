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


# ---------------------------------------------------------------------------
# 6. Task 14 Performance Prediction & Analysis Tests
# ---------------------------------------------------------------------------
def test_task14_performance_prediction_analysis(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    stu_a, auth_a = student_a
    setup_token_mock(monkeypatch, auth_a)

    # 1. Extreme feature inputs safely bound performance prediction in [0.0, 100.0]
    sample_feat = {
        "total_session_duration": 7200.0,
        "productive_duration": 6000.0,
        "distraction_duration": 600.0,
        "break_duration": 600.0,
        "productive_activity_ratio": 0.8333,
        "distraction_activity_ratio": 0.0833,
        "activity_switch_count": 3,
        "activity_count": 8,
        "unique_application_count": 3,
        "quiz_score": None,  # Test median imputation safeguard
    }
    prediction_result = ml_service.predict_behaviour(sample_feat)
    assert "performance_prediction" in prediction_result
    assert 0.0 <= prediction_result["performance_prediction"] <= 100.0

    # 2. Verify distinction between AI predicted performance score and actual measured report score
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
        numeric_value=3600.0,
        metadata_json={"application_name": "IDE"},
    )
    db_session.add(activity)
    db_session.commit()

    # Generate analysis
    analysis = student_service.generate_session_behaviour_analysis(session.id, stu_a.id, db_session)

    # Add actual academic report record
    from app.models.entities import PerformanceReport
    report = PerformanceReport(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        study_session_id=session.id,
        score=92.5,
        max_score=100.0,
        performance_metric="Midterm Quiz",
        measured_at=datetime.now(timezone.utc),
    )
    db_session.add(report)
    db_session.commit()

    # Retrieve performance endpoint response
    resp = client.get(
        "/api/v1/student/performance",
        headers={"Authorization": "Bearer token-a"},
    )
    assert resp.status_code == status.HTTP_200_OK
    reports_data = resp.json()
    assert len(reports_data) >= 1
    actual_report = reports_data[0]

    # Confirm explicit separation between ML estimate and actual grade
    assert actual_report["score"] == 92.5
    assert actual_report["score"] != analysis.performance_prediction


# ---------------------------------------------------------------------------
# 7. Task 17 Interactive Counterfactual Explanations Tests
# ---------------------------------------------------------------------------
def test_task17_simulate_counterfactual_math_and_bounds():
    baseline_features = {
        "total_session_duration": 3600.0,
        "productive_duration": 1800.0,
        "distraction_duration": 1200.0,
        "break_duration": 600.0,
        "productive_activity_ratio": 0.5,
        "distraction_activity_ratio": 0.3333,
        "activity_switch_count": 18,
        "activity_count": 6,
        "unique_application_count": 5,
        "quiz_score": 78.0,
    }

    # 1. Simulate increasing productive duration (30m -> 50m) and reducing distraction (20m -> 5m) and switches (18 -> 3)
    sim = ml_service.simulate_counterfactual(
        baseline_features,
        {
            "productive_duration": 3000.0,
            "distraction_duration": 300.0,
            "break_duration": 300.0,
            "activity_switch_count": 3,
            "unique_application_count": 2,
        },
    )

    mod = sim["modified_features"]
    assert mod["total_session_duration"] == 3600.0
    assert mod["productive_activity_ratio"] == round(3000.0 / 3600.0, 4)
    assert mod["distraction_activity_ratio"] == round(300.0 / 3600.0, 4)
    assert mod["activity_switch_count"] == 3
    assert mod["unique_application_count"] == 2
    assert mod["quiz_score"] == 78.0

    # Baseline features dictionary was not mutated
    assert baseline_features["productive_duration"] == 1800.0
    assert baseline_features["distraction_duration"] == 1200.0

    # Predictions & deltas consistency
    base_pred = sim["baseline_predictions"]
    sim_pred = sim["simulated_predictions"]
    deltas = sim["deltas"]

    assert 0.0 <= sim_pred["focus_score"] <= 100.0
    assert sim_pred["distraction_level"] in ("LOW", "MEDIUM", "HIGH")
    assert 0.0 <= sim_pred["performance_prediction"] <= 100.0
    assert deltas["focus_score_delta"] == round(
        sim_pred["focus_score"] - base_pred["focus_score"], 1
    )
    assert deltas["performance_prediction_delta"] == round(
        sim_pred["performance_prediction"] - base_pred["performance_prediction"], 1
    )
    assert deltas["focus_score_delta"] > 0.0
    assert "hypothetical" in sim["explanation_summary"].lower()

    # 2. Zero-change simulation produces zero deltas
    no_change = ml_service.simulate_counterfactual(baseline_features, {})
    assert no_change["deltas"]["focus_score_delta"] == 0.0
    assert no_change["deltas"]["performance_prediction_delta"] == 0.0
    assert no_change["deltas"]["distraction_level_changed"] is False

    # 3. Rejects zero total duration
    with pytest.raises(ValueError) as exc_info:
        ml_service.simulate_counterfactual(
            baseline_features,
            {
                "productive_duration": 0.0,
                "distraction_duration": 0.0,
                "break_duration": 0.0,
            },
        )
    assert "greater than 0 seconds" in str(exc_info.value)


def test_task17_counterfactual_api_immutability_and_isolation(
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

    # 1. Create a real session with activities for Student A
    session = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime.now(timezone.utc),
        status="completed",
    )
    db_session.add(session)
    db_session.commit()

    act_prod = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=session.id,
        activity_type="productive",
        occurred_at=datetime.now(timezone.utc),
        numeric_value=1500.0,
        metadata_json={"application_name": "VS Code"},
    )
    act_dist = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=session.id,
        activity_type="distraction",
        occurred_at=datetime.now(timezone.utc),
        numeric_value=900.0,
        metadata_json={"application_name": "Browser"},
    )
    db_session.add_all([act_prod, act_dist])
    db_session.commit()

    analysis = student_service.generate_session_behaviour_analysis(
        session.id, stu_a.id, db_session
    )
    orig_focus = analysis.focus_score
    orig_distraction = analysis.distraction_level
    orig_perf = analysis.performance_prediction
    orig_snapshot = dict(analysis.feature_snapshot)

    # 2. Run hypothetical counterfactual simulation via API
    sim_resp = client.post(
        "/api/v1/student/behaviour/counterfactual",
        json={
            "analysis_id": str(analysis.id),
            "productive_duration": 2400.0,
            "distraction_duration": 0.0,
            "break_duration": 300.0,
            "activity_switch_count": 1,
            "unique_application_count": 1,
        },
        headers={"Authorization": "Bearer token-a"},
    )
    assert sim_resp.status_code == status.HTTP_200_OK
    sim_data = sim_resp.json()

    assert sim_data["analysis_id"] == str(analysis.id)
    assert sim_data["study_session_id"] == str(session.id)
    assert sim_data["is_hypothetical"] is True
    assert sim_data["baseline_predictions"]["focus_score"] == orig_focus
    assert sim_data["simulated_predictions"]["focus_score"] >= orig_focus
    assert "deltas" in sim_data
    assert "explanation_summary" in sim_data

    # 3. Verify stored BehaviouralAnalysis record is 100% immutable in DB and GET endpoint
    db_session.refresh(analysis)
    assert analysis.focus_score == orig_focus
    assert analysis.distraction_level == orig_distraction
    assert analysis.performance_prediction == orig_perf
    assert analysis.feature_snapshot == orig_snapshot

    get_resp = client.get(
        f"/api/v1/student/behaviour/{analysis.id}",
        headers={"Authorization": "Bearer token-a"},
    )
    assert get_resp.status_code == status.HTTP_200_OK
    assert get_resp.json()["focus_score"] == orig_focus
    assert get_resp.json()["feature_snapshot"] == orig_snapshot

    # 4. Validation: zero total simulated duration returns 400 Bad Request
    zero_resp = client.post(
        "/api/v1/student/behaviour/counterfactual",
        json={
            "analysis_id": str(analysis.id),
            "productive_duration": 0.0,
            "distraction_duration": 0.0,
            "break_duration": 0.0,
        },
        headers={"Authorization": "Bearer token-a"},
    )
    assert zero_resp.status_code == status.HTTP_400_BAD_REQUEST

    # 5. Validation: negative duration returns 422 Unprocessable Entity
    neg_resp = client.post(
        "/api/v1/student/behaviour/counterfactual",
        json={
            "analysis_id": str(analysis.id),
            "productive_duration": -120.0,
        },
        headers={"Authorization": "Bearer token-a"},
    )
    assert neg_resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 6. Cross-student isolation: Student B gets 404 Not Found on Student A's analysis
    setup_token_mock(monkeypatch, auth_b)
    b_resp = client.post(
        "/api/v1/student/behaviour/counterfactual",
        json={
            "analysis_id": str(analysis.id),
            "productive_duration": 2400.0,
        },
        headers={"Authorization": "Bearer token-b"},
    )
    assert b_resp.status_code == status.HTTP_404_NOT_FOUND

    # 7. Role protection: Parent user gets 403 Forbidden
    setup_token_mock(monkeypatch, auth_parent)
    p_resp = client.post(
        "/api/v1/student/behaviour/counterfactual",
        json={
            "analysis_id": str(analysis.id),
            "productive_duration": 2400.0,
        },
        headers={"Authorization": "Bearer parent-token"},
    )
    assert p_resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# 6. Task 18 SHAP Feature Attribution Tests
# ---------------------------------------------------------------------------
def test_task18_shap_exact_decomposition_and_efficiency():
    """Verify that tree feature attributions decompose the exact focus score.

    Local Accuracy / Efficiency: base_value + sum(attributions) == prediction.
    All 10 features must be present, ordered, and signed.
    """
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
        "quiz_score": 85.0,
    }

    result = ml_service.calculate_feature_attributions(raw_sample, target="focus_score")
    assert result is not None
    assert result["target"] == "focus_score"
    assert result["model_name"] == "RandomForestRegressor"
    assert "base_value" in result
    assert "prediction" in result
    assert "method" in result
    assert "summary" in result
    assert len(result["summary"]) > 0

    # Verify all 10 features are represented in values dict
    values = result["values"]
    assert len(values) == len(FEATURE_NAMES)
    for name in FEATURE_NAMES:
        assert name in values

    # Verify attributions list
    attributions = result["attributions"]
    assert len(attributions) == len(FEATURE_NAMES)

    # Verify local accuracy / efficiency property
    attr_sum = sum(a["attribution"] for a in attributions)
    reconstructed_pred = round(result["base_value"] + attr_sum, 1)
    # Reconstructed sum should closely match the model's prediction
    assert abs(reconstructed_pred - result["prediction"]) <= 0.2

    # Verify feature impacts and signs
    prod_attr = next(a for a in attributions if a["feature_name"] == "productive_activity_ratio")
    dist_attr = next(a for a in attributions if a["feature_name"] == "distraction_activity_ratio")
    assert prod_attr["impact"] == "positive"
    assert prod_attr["attribution"] > 0
    assert dist_attr["impact"] == "negative"
    assert dist_attr["attribution"] < 0

    # Also test performance_score target (GradientBoostingRegressor)
    perf_result = ml_service.calculate_feature_attributions(raw_sample, target="performance_score")
    assert perf_result is not None
    assert perf_result["target"] == "performance_score"
    assert perf_result["model_name"] == "GradientBoostingRegressor"
    perf_sum = sum(a["attribution"] for a in perf_result["attributions"])
    reconstructed_perf = round(perf_result["base_value"] + perf_sum, 1)
    assert abs(reconstructed_perf - perf_result["prediction"]) <= 0.2


def test_task18_shap_missing_and_invalid_inputs_safety():
    """Verify robust, graceful handling of edge cases without exceptions."""
    # 1. Empty dict returns None
    assert ml_service.calculate_feature_attributions({}) is None

    # 2. None input returns None
    assert ml_service.calculate_feature_attributions(None) is None  # type: ignore[arg-type]

    # 3. Session with zero duration and zero activities returns None (gating)
    zero_session = {
        "total_session_duration": 0.0,
        "productive_duration": 0.0,
        "distraction_duration": 0.0,
        "break_duration": 0.0,
        "activity_count": 0,
    }
    assert ml_service.calculate_feature_attributions(zero_session) is None

    # 4. Sample with missing quiz score imputes gracefully
    imputed_sample = {
        "total_session_duration": 1800.0,
        "productive_duration": 1500.0,
        "distraction_duration": 200.0,
        "break_duration": 100.0,
        "productive_activity_ratio": 0.8333,
        "distraction_activity_ratio": 0.1111,
        "activity_switch_count": 3,
        "activity_count": 4,
        "unique_application_count": 2,
        "quiz_score": None,
    }
    res = ml_service.calculate_feature_attributions(imputed_sample)
    assert res is not None
    assert res["prediction"] > 0

    # 5. Unsupported target raises ValueError
    with pytest.raises(ValueError) as exc_info:
        ml_service.calculate_feature_attributions(imputed_sample, target="unsupported_target")
    assert "Unsupported explanation target" in str(exc_info.value)


def test_task18_e2e_session_analysis_includes_shap_values(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify that an end-to-end study session with telemetry generates and returns SHAP values."""
    stu_a, auth_a = student_a
    _, auth_b = student_b
    setup_token_mock(monkeypatch, auth_a)

    # 1. Create session and telemetry
    session = StudySession(
        id=uuid.uuid4(),
        student_id=stu_a.id,
        started_at=datetime.now(timezone.utc),
        status="active",
    )
    db_session.add(session)
    db_session.commit()

    act1 = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=session.id,
        activity_type="productive",
        occurred_at=datetime.now(timezone.utc),
        numeric_value=1800.0,
        metadata_json={"application_name": "PyCharm"},
    )
    act2 = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=session.id,
        activity_type="distraction",
        occurred_at=datetime.now(timezone.utc),
        numeric_value=200.0,
        metadata_json={"application_name": "Twitter"},
    )
    db_session.add_all([act1, act2])
    db_session.commit()

    # 2. Generate analysis and verify shap_values is persisted in DB
    analysis = student_service.generate_session_behaviour_analysis(session.id, stu_a.id, db_session)
    assert analysis.shap_values is not None
    assert analysis.shap_values["target"] == "focus_score"
    assert len(analysis.shap_values["attributions"]) == 10

    # 3. GET /api/v1/student/behaviour returns shap_values in payload
    resp = client.get(
        "/api/v1/student/behaviour",
        headers={"Authorization": "Bearer token-a"},
    )
    assert resp.status_code == status.HTTP_200_OK
    analyses_list = resp.json()
    assert len(analyses_list) >= 1
    latest = analyses_list[0]
    assert latest["shap_values"] is not None
    assert latest["shap_values"]["target"] == "focus_score"
    assert "attributions" in latest["shap_values"]
    assert "summary" in latest["shap_values"]

    # 4. GET /api/v1/student/behaviour/{id} returns shap_values in payload
    single_resp = client.get(
        f"/api/v1/student/behaviour/{analysis.id}",
        headers={"Authorization": "Bearer token-a"},
    )
    assert single_resp.status_code == status.HTTP_200_OK
    single_data = single_resp.json()
    assert single_data["shap_values"] is not None
    assert single_data["shap_values"]["base_value"] == analysis.shap_values["base_value"]

    # 5. Cross-student tenant isolation holds
    setup_token_mock(monkeypatch, auth_b)
    isolated_resp = client.get(
        f"/api/v1/student/behaviour/{analysis.id}",
        headers={"Authorization": "Bearer token-b"},
    )
    assert isolated_resp.status_code == status.HTTP_404_NOT_FOUND





