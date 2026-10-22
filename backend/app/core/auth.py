from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Parent, Student
from app.services import supabase
from app.services.supabase import SupabaseConfigurationError


class UserRole(StrEnum):
    STUDENT = "student"
    PARENT = "parent"


@dataclass(frozen=True)
class AuthTokenPayload:
    """Verified payload extracted from Supabase Auth access token."""

    auth_user_id: UUID
    email: str | None = None
    user_metadata: dict | None = None


@dataclass(frozen=True)
class AuthenticatedUser:
    """Typed authenticated application identity resolved from trusted database profile."""

    auth_user_id: UUID
    role: UserRole
    student_id: UUID | None = None
    parent_id: UUID | None = None
    email: str | None = None
    display_name: str | None = None
    department: str | None = None
    semester: int | None = None
    academic_year: int | None = None

    @property
    def supabase_user_id(self) -> UUID:
        """Alias for backward compatibility."""
        return self.auth_user_id

    @property
    def profile_id(self) -> UUID | None:
        """Alias for backward compatibility."""
        return self.student_id if self.role == UserRole.STUDENT else self.parent_id


bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Authentication required") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_auth_token_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthTokenPayload:
    """Read Bearer token and verify it through Supabase Auth, returning verified Auth UUID."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized("Authentication required")

    try:
        payload = supabase.verify_access_token(credentials.credentials)
        return AuthTokenPayload(
            auth_user_id=UUID(payload["id"]),
            email=payload.get("email"),
            user_metadata=payload.get("user_metadata") or {},
        )
    except (SupabaseConfigurationError, KeyError, ValueError) as error:
        raise _unauthorized("Invalid or unverifiable access token") from error


def _parse_bounded_int(value: object, min_val: int, max_val: int) -> int | None:
    try:
        parsed = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return parsed if min_val <= parsed <= max_val else None


def _auto_provision_from_metadata(
    auth_payload: AuthTokenPayload, db: Session
) -> AuthenticatedUser | None:
    """Auto-provision a Student or Parent profile if verified Supabase user_metadata contains registration info."""
    metadata = auth_payload.user_metadata or {}
    if not isinstance(metadata, dict):
        return None

    raw_role = str(metadata.get("role") or "").strip().lower()
    raw_name = str(metadata.get("name") or metadata.get("display_name") or "").strip()
    if not raw_name or len(raw_name) > 200:
        return None

    if raw_role == UserRole.STUDENT.value:
        raw_dept = metadata.get("department")
        department = str(raw_dept).strip()[:100] if raw_dept and str(raw_dept).strip() else None
        semester = _parse_bounded_int(metadata.get("semester"), 1, 10)
        academic_year = _parse_bounded_int(metadata.get("academic_year"), 1, 5)
        raw_tz = metadata.get("timezone")
        timezone = str(raw_tz).strip()[:100] if raw_tz and str(raw_tz).strip() else "UTC"

        student = Student(
            auth_user_id=auth_payload.auth_user_id,
            display_name=raw_name,
            department=department,
            semester=semester,
            academic_year=academic_year,
            timezone=timezone,
        )
        db.add(student)
        db.commit()
        db.refresh(student)
        return AuthenticatedUser(
            auth_user_id=auth_payload.auth_user_id,
            role=UserRole.STUDENT,
            student_id=student.id,
            parent_id=None,
            email=auth_payload.email,
            display_name=student.display_name,
            department=student.department,
            semester=student.semester,
            academic_year=student.academic_year,
        )

    if raw_role == UserRole.PARENT.value:
        parent = Parent(
            auth_user_id=auth_payload.auth_user_id,
            display_name=raw_name,
        )
        db.add(parent)
        db.commit()
        db.refresh(parent)
        return AuthenticatedUser(
            auth_user_id=auth_payload.auth_user_id,
            role=UserRole.PARENT,
            student_id=None,
            parent_id=parent.id,
            email=auth_payload.email,
            display_name=parent.display_name,
        )

    return None


def resolve_application_profile(auth_payload: AuthTokenPayload, db: Session) -> AuthenticatedUser:
    """Resolve the trusted student or parent role from application profile tables using auth_user_id."""
    student = db.scalar(select(Student).where(Student.auth_user_id == auth_payload.auth_user_id))
    parent = db.scalar(select(Parent).where(Parent.auth_user_id == auth_payload.auth_user_id))

    if student and parent:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ambiguous application profile: mapped to both student and parent",
        )
    if student:
        return AuthenticatedUser(
            auth_user_id=auth_payload.auth_user_id,
            role=UserRole.STUDENT,
            student_id=student.id,
            parent_id=None,
            email=auth_payload.email,
            display_name=student.display_name,
            department=student.department,
            semester=student.semester,
            academic_year=student.academic_year,
        )
    if parent:
        return AuthenticatedUser(
            auth_user_id=auth_payload.auth_user_id,
            role=UserRole.PARENT,
            student_id=None,
            parent_id=parent.id,
            email=auth_payload.email,
            display_name=parent.display_name,
        )

    provisioned_user = _auto_provision_from_metadata(auth_payload, db)
    if provisioned_user is not None:
        return provisioned_user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Application profile not found. Please complete profile registration.",
    )


def get_current_user(
    auth_payload: AuthTokenPayload = Depends(get_current_auth_token_user),
    db: Session = Depends(get_db),
) -> AuthenticatedUser:
    """FastAPI dependency: verifies bearer token and resolves trusted application profile."""
    return resolve_application_profile(auth_payload, db)


def require_student(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """Require authenticated user to have the Student application role."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Student role required",
        )
    return current_user


def require_parent(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """Require authenticated user to have the Parent application role."""
    if current_user.role != UserRole.PARENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Parent role required",
        )
    return current_user


def require_role(role: UserRole) -> Callable:
    """Build a route dependency that checks the resolved application role."""

    def dependency(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: {role.value.capitalize()} role required",
            )
        return user

    return dependency
