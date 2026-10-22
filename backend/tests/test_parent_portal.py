from datetime import datetime, timezone
import uuid
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    BehaviouralAnalysis,
    Parent,
    Student,
    StudentParentLink,
    StudySession,
)
from app.services import supabase


def test_parent_cannot_access_unlinked_student_progress(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    parent_user: tuple[Parent, uuid.UUID],
    monkeypatch: pytest.MonkeyPatch,
):
    student, _ = student_a
    parent, parent_auth = parent_user

    def mock_verify(token: str):
        return {"id": str(parent_auth), "email": "parent@test.com"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify)

    # Parent tries to access Student A progress without any link
    response = client.get(
        f"/api/v1/parent/students/{student.id}/progress",
        headers={"Authorization": "Bearer parent-token"},
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "not linked" in response.json()["detail"].lower()


def test_parent_cannot_access_student_without_active_consent(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    parent_user: tuple[Parent, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    student, _ = student_a
    parent, parent_auth = parent_user

    # Create link with "pending" consent
    link = StudentParentLink(
        id=uuid.uuid4(),
        parent_id=parent.id,
        student_id=student.id,
        consent_status="pending",
    )
    db_session.add(link)
    db_session.commit()

    def mock_verify(token: str):
        return {"id": str(parent_auth), "email": "parent@test.com"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify)

    # Access is forbidden when consent is pending
    response = client.get(
        f"/api/v1/parent/students/{student.id}/progress",
        headers={"Authorization": "Bearer parent-token"},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "consent is currently 'pending'" in response.json()["detail"]


def test_parent_sees_progress_when_consent_active_and_revocation_blocks_access(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    parent_user: tuple[Parent, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    student, student_auth = student_a
    parent, parent_auth = parent_user

    # Add study session and analysis
    now = datetime.now(timezone.utc)
    sess = StudySession(
        id=uuid.uuid4(),
        student_id=student.id,
        started_at=now,
        ended_at=now,
        status="completed",
    )
    db_session.add(sess)
    db_session.commit()

    analysis = BehaviouralAnalysis(
        id=uuid.uuid4(),
        study_session_id=sess.id,
        feature_snapshot={"productive_duration": 1800.0},
        focus_score=85.5,
        distraction_level="LOW",
        performance_prediction=90.0,
        model_version="v1.0",
    )
    db_session.add(analysis)

    # Link with active consent
    link = StudentParentLink(
        id=uuid.uuid4(),
        parent_id=parent.id,
        student_id=student.id,
        consent_status="active",
    )
    db_session.add(link)
    db_session.commit()

    # 1. Parent accesses student progress with active consent
    def mock_verify_parent(token: str):
        return {"id": str(parent_auth), "email": "parent@test.com"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_parent)

    resp = client.get(
        f"/api/v1/parent/students/{student.id}/progress",
        headers={"Authorization": "Bearer parent-token"},
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["student_id"] == str(student.id)
    assert data["total_study_sessions"] == 1
    assert data["completed_study_sessions"] == 1
    assert data["average_focus_score"] == 85.5
    assert data["latest_distraction_level"] == "LOW"
    assert "subject_summaries" in data
    assert isinstance(data["subject_summaries"], list)

    # 2. Student revokes consent via student parent-link endpoint
    def mock_verify_student(token: str):
        return {"id": str(student_auth), "email": "student@test.com"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_student)

    patch_resp = client.patch(
        f"/api/v1/student/parent-links/{link.id}/consent",
        json={"consent_status": "revoked"},
        headers={"Authorization": "Bearer student-token"},
    )
    assert patch_resp.status_code == status.HTTP_200_OK
    assert patch_resp.json()["consent_status"] == "revoked"

    # 3. Parent immediately loses access (403 Forbidden)
    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_parent)
    blocked_resp = client.get(
        f"/api/v1/parent/students/{student.id}/progress",
        headers={"Authorization": "Bearer parent-token"},
    )
    assert blocked_resp.status_code == status.HTTP_403_FORBIDDEN
    assert "revoked" in blocked_resp.json()["detail"]


def test_student_cannot_access_parent_endpoints(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    monkeypatch: pytest.MonkeyPatch,
):
    _, student_auth = student_a

    def mock_verify(token: str):
        return {"id": str(student_auth), "email": "student@test.com"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify)

    resp = client.get(
        "/api/v1/parent/students",
        headers={"Authorization": "Bearer student-token"},
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


def test_parent_and_student_unlink_workflows(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    parent_user: tuple[Parent, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    student, student_auth = student_a
    parent, parent_auth = parent_user

    # 1. Create link with active consent
    link = StudentParentLink(
        id=uuid.uuid4(),
        parent_id=parent.id,
        student_id=student.id,
        consent_status="active",
    )
    db_session.add(link)
    db_session.commit()

    def mock_verify_parent(token: str):
        return {"id": str(parent_auth), "email": "parent@test.com"}

    def mock_verify_student(token: str):
        return {"id": str(student_auth), "email": "student@test.com"}

    # 2. Parent unlinks student
    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_parent)
    del_resp = client.delete(
        f"/api/v1/parent/students/{student.id}",
        headers={"Authorization": "Bearer parent-token"},
    )
    assert del_resp.status_code == status.HTTP_200_OK
    assert del_resp.json()["success"] is True

    # After unlink, link no longer exists
    check_link = db_session.scalar(select(StudentParentLink).where(StudentParentLink.id == link.id))
    assert check_link is None

    # 3. Create another link to test student-side unlink
    link2 = StudentParentLink(
        id=uuid.uuid4(),
        parent_id=parent.id,
        student_id=student.id,
        consent_status="pending",
    )
    db_session.add(link2)
    db_session.commit()

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_student)
    stu_del_resp = client.delete(
        f"/api/v1/student/parent-links/{link2.id}",
        headers={"Authorization": "Bearer student-token"},
    )
    assert stu_del_resp.status_code == status.HTTP_200_OK
    assert stu_del_resp.json()["success"] is True

    check_link2 = db_session.scalar(select(StudentParentLink).where(StudentParentLink.id == link2.id))
    assert check_link2 is None


def test_student_role_forbidden_from_parent_endpoints(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    monkeypatch: pytest.MonkeyPatch,
):
    """Students cannot access parent-only endpoints (HTTP 403 Forbidden)."""
    _, student_auth = student_a
    monkeypatch.setattr(supabase, "verify_access_token", lambda token: {"id": str(student_auth), "email": "student@test.com"})

    resp = client.get(
        "/api/v1/parent/students",
        headers={"Authorization": "Bearer student-token"},
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


def test_parent_empty_state_and_invalid_link_handling(
    client: TestClient,
    parent_user: tuple[Parent, uuid.UUID],
    monkeypatch: pytest.MonkeyPatch,
):
    """Parent with 0 linked students receives an empty list [].

    Attempting to link a non-existent student UUID returns 404.
    """
    _, parent_auth = parent_user
    monkeypatch.setattr(supabase, "verify_access_token", lambda token: {"id": str(parent_auth), "email": "parent@test.com"})

    # 1. Listing with 0 links -> []
    resp = client.get(
        "/api/v1/parent/students",
        headers={"Authorization": "Bearer parent-token"},
    )
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json() == []

    # 2. Attempt link to non-existent student ID -> 404
    bad_id = uuid.uuid4()
    bad_link_resp = client.post(
        "/api/v1/parent/students/link",
        json={"student_id": str(bad_id)},
        headers={"Authorization": "Bearer parent-token"},
    )
    assert bad_link_resp.status_code == status.HTTP_404_NOT_FOUND


def test_student_parent_link_approve_reject_delete_actions(
    client: TestClient,
    student_a: tuple[Student, uuid.UUID],
    student_b: tuple[Student, uuid.UUID],
    parent_user: tuple[Parent, uuid.UUID],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Exhaustively verify Approve, Reject, and Delete actions on parent links.

    Ensures proper consent enforcement, authorization boundaries, and tamper resistance.
    """
    student, student_auth = student_a
    other_student, other_auth = student_b
    parent, parent_auth = parent_user

    def mock_verify_student(token: str):
        return {"id": str(student_auth), "email": "student@test.com"}

    def mock_verify_other_student(token: str):
        return {"id": str(other_auth), "email": "other@test.com"}

    def mock_verify_parent(token: str):
        return {"id": str(parent_auth), "email": "parent@test.com"}

    # 1. Create a link in pending state
    link = StudentParentLink(
        id=uuid.uuid4(),
        parent_id=parent.id,
        student_id=student.id,
        consent_status="pending",
    )
    db_session.add(link)
    db_session.commit()

    # 2. Student lists links -> verify both 'id' and 'link_id' are present
    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_student)
    list_resp = client.get(
        "/api/v1/student/parent-links",
        headers={"Authorization": "Bearer student-token"},
    )
    assert list_resp.status_code == status.HTTP_200_OK
    items = list_resp.json()
    assert len(items) == 1
    assert items[0]["link_id"] == str(link.id)
    assert items[0]["id"] == str(link.id)
    assert items[0]["consent_status"] == "pending"

    # 3. Unauthorized student cannot manipulate Student A's link
    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_other_student)
    bad_approve = client.patch(
        f"/api/v1/student/parent-links/{link.id}/consent",
        json={"consent_status": "active"},
        headers={"Authorization": "Bearer other-student-token"},
    )
    assert bad_approve.status_code == status.HTTP_404_NOT_FOUND

    # 4. ACTION: Approve -> consent_status becomes 'active'
    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_student)
    app_resp = client.patch(
        f"/api/v1/student/parent-links/{link.id}/consent",
        json={"consent_status": "active"},
        headers={"Authorization": "Bearer student-token"},
    )
    assert app_resp.status_code == status.HTTP_200_OK
    assert app_resp.json()["consent_status"] == "active"

    # Verify parent can access progress when approved
    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_parent)
    prog_resp = client.get(
        f"/api/v1/parent/students/{student.id}/progress",
        headers={"Authorization": "Bearer parent-token"},
    )
    assert prog_resp.status_code == status.HTTP_200_OK

    # 5. ACTION: Reject -> consent_status becomes 'rejected'
    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_student)
    rej_resp = client.patch(
        f"/api/v1/student/parent-links/{link.id}/consent",
        json={"consent_status": "rejected"},
        headers={"Authorization": "Bearer student-token"},
    )
    assert rej_resp.status_code == status.HTTP_200_OK
    assert rej_resp.json()["consent_status"] == "rejected"

    # Verify parent access is denied when rejected
    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_parent)
    prog_rej_resp = client.get(
        f"/api/v1/parent/students/{student.id}/progress",
        headers={"Authorization": "Bearer parent-token"},
    )
    assert prog_rej_resp.status_code == status.HTTP_403_FORBIDDEN
    assert "rejected" in prog_rej_resp.json()["detail"].lower()

    # 6. ACTION: Delete -> completely removes the link
    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_student)
    del_resp = client.delete(
        f"/api/v1/student/parent-links/{link.id}",
        headers={"Authorization": "Bearer student-token"},
    )
    assert del_resp.status_code == status.HTTP_200_OK
    assert del_resp.json()["success"] is True

    # After delete, link is gone from DB
    check_link = db_session.scalar(select(StudentParentLink).where(StudentParentLink.id == link.id))
    assert check_link is None

    # Parent progress access now returns 404 (not linked)
    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_parent)
    prog_del_resp = client.get(
        f"/api/v1/parent/students/{student.id}/progress",
        headers={"Authorization": "Bearer parent-token"},
    )
    assert prog_del_resp.status_code == status.HTTP_404_NOT_FOUND




