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
        )
    except (SupabaseConfigurationError, KeyError, ValueError) as error:
        raise _unauthorized("Invalid or unverifiable access token") from error


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
