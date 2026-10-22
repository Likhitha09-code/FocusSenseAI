import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import AuthenticatedUser, require_parent, require_student
from app.db.session import get_db
from app.schemas.parent import (
    LinkedParentSummary,
    LinkedStudentSummary,
    ParentStudentProgressSummary,
    StudentParentLinkConsentUpdate,
    StudentParentLinkCreate,
    StudentParentLinkUnlinkResponse,
)
from app.services import parent_service

parent_router = APIRouter(prefix="/parent", tags=["parent"])


@parent_router.get("/students", response_model=list[LinkedStudentSummary])
def get_linked_students(
    current_user: AuthenticatedUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> list[LinkedStudentSummary]:
    """List all students linked to the authenticated parent along with consent status."""
    return parent_service.list_linked_students_for_parent(current_user.parent_id, db)  # type: ignore[arg-type]


@parent_router.post("/students/link", response_model=LinkedStudentSummary, status_code=status.HTTP_201_CREATED)
def link_student(
    data: StudentParentLinkCreate,
    current_user: AuthenticatedUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> LinkedStudentSummary:
    """Request linking with a student account (sets consent to pending)."""
    return parent_service.link_student_to_parent(current_user.parent_id, data, db)  # type: ignore[arg-type]


@parent_router.delete("/students/{student_id}", response_model=StudentParentLinkUnlinkResponse)
def unlink_student(
    student_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> StudentParentLinkUnlinkResponse:
    """Remove student link from parent account."""
    return parent_service.unlink_student_for_parent(current_user.parent_id, student_id, db)  # type: ignore[arg-type]


@parent_router.get("/students/{student_id}/progress", response_model=ParentStudentProgressSummary)
def get_student_progress(
    student_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> ParentStudentProgressSummary:
    """View progress analytics for a linked student only if active consent is granted."""
    return parent_service.get_parent_student_progress(current_user.parent_id, student_id, db)  # type: ignore[arg-type]


# Student-side routes for managing parent consent
parent_consent_router = APIRouter(prefix="/student/parent-links", tags=["student-parent-links"])


@parent_consent_router.get("", response_model=list[LinkedParentSummary])
def get_student_parent_links(
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> list[LinkedParentSummary]:
    """List parents linked to the student and their consent status."""
    return parent_service.list_linked_parents_for_student(current_user.student_id, db)  # type: ignore[arg-type]


@parent_consent_router.patch("/{link_id}/consent", response_model=LinkedParentSummary)
def update_parent_consent(
    link_id: uuid.UUID,
    data: StudentParentLinkConsentUpdate,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> LinkedParentSummary:
    """Approve, revoke, or set consent status for a linked parent."""
    return parent_service.update_parent_consent_by_student(
        current_user.student_id, link_id, data, db  # type: ignore[arg-type]
    )


@parent_consent_router.delete("/{link_id}", response_model=StudentParentLinkUnlinkResponse)
def unlink_parent(
    link_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> StudentParentLinkUnlinkResponse:
    """Remove parent link from student account."""
    return parent_service.unlink_parent_for_student(current_user.student_id, link_id, db)  # type: ignore[arg-type]

