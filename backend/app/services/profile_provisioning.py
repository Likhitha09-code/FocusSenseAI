import uuid
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import UserRole
from app.models.entities import Parent, Student
from app.schemas.auth import ParentProvisionRequest, StudentProvisionRequest, UserProfileResponse


def create_student_profile(
    auth_user_id: UUID,
    data: StudentProvisionRequest,
    db: Session,
    email: str | None = None,
) -> UserProfileResponse:
    """Create a new Student profile linked to the verified Supabase Auth UUID."""
    existing_student = db.scalar(select(Student).where(Student.auth_user_id == auth_user_id))
    existing_parent = db.scalar(select(Parent).where(Parent.auth_user_id == auth_user_id))

    if existing_student or existing_parent:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An application profile already exists for this authenticated user",
        )

    student = Student(
        id=uuid.uuid4(),
        auth_user_id=auth_user_id,
        display_name=data.name,
        department=data.department,
        semester=data.semester,
        academic_year=data.academic_year,
        timezone=data.timezone,
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    return UserProfileResponse(
        auth_user_id=auth_user_id,
        role=UserRole.STUDENT,
        student_id=student.id,
        parent_id=None,
        email=email,
        name=student.display_name,
        department=student.department,
        semester=student.semester,
        academic_year=student.academic_year,
    )


def create_parent_profile(
    auth_user_id: UUID,
    data: ParentProvisionRequest,
    db: Session,
    email: str | None = None,
) -> UserProfileResponse:
    """Create a new Parent profile linked to the verified Supabase Auth UUID."""
    existing_student = db.scalar(select(Student).where(Student.auth_user_id == auth_user_id))
    existing_parent = db.scalar(select(Parent).where(Parent.auth_user_id == auth_user_id))

    if existing_student or existing_parent:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An application profile already exists for this authenticated user",
        )

    parent = Parent(
        id=uuid.uuid4(),
        auth_user_id=auth_user_id,
        display_name=data.name,
    )
    db.add(parent)
    db.commit()
    db.refresh(parent)

    return UserProfileResponse(
        auth_user_id=auth_user_id,
        role=UserRole.PARENT,
        student_id=None,
        parent_id=parent.id,
        email=email,
        name=parent.display_name,
    )

