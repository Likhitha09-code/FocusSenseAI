from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import (
    AuthenticatedUser,
    AuthTokenPayload,
    get_current_auth_token_user,
    get_current_user,
    require_parent,
    require_student,
)
from app.db.session import get_db
from app.schemas.auth import (
    ParentProvisionRequest,
    StudentProvisionRequest,
    TestRoleResponse,
    UserProfileResponse,
)
from app.api.student_routes import student_router
from app.api.parent_routes import parent_router, parent_consent_router
from app.services.profile_provisioning import create_parent_profile, create_student_profile

auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.get("/me", response_model=UserProfileResponse)
def get_my_profile(current_user: AuthenticatedUser = Depends(get_current_user)) -> UserProfileResponse:
    """Return the authenticated user identity and resolved application profile."""
    return UserProfileResponse(
        auth_user_id=current_user.auth_user_id,
        role=current_user.role,
        student_id=current_user.student_id,
        parent_id=current_user.parent_id,
        email=current_user.email,
        name=current_user.display_name,
        department=current_user.department,
        semester=current_user.semester,
        academic_year=current_user.academic_year,
    )


@auth_router.post(
    "/provision/student",
    response_model=UserProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def provision_student(
    request: StudentProvisionRequest,
    auth_token: AuthTokenPayload = Depends(get_current_auth_token_user),
    db: Session = Depends(get_db),
) -> UserProfileResponse:
    """Provision a Student application profile linked to the verified Supabase Auth user."""
    return create_student_profile(
        auth_user_id=auth_token.auth_user_id,
        data=request,
        db=db,
        email=auth_token.email,
    )


@auth_router.post(
    "/provision/parent",
    response_model=UserProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def provision_parent(
    request: ParentProvisionRequest,
    auth_token: AuthTokenPayload = Depends(get_current_auth_token_user),
    db: Session = Depends(get_db),
) -> UserProfileResponse:
    """Provision a Parent application profile linked to the verified Supabase Auth user."""
    return create_parent_profile(
        auth_user_id=auth_token.auth_user_id,
        data=request,
        db=db,
        email=auth_token.email,
    )


@auth_router.get("/student-test", response_model=TestRoleResponse)
def test_student_access(student_user: AuthenticatedUser = Depends(require_student)) -> TestRoleResponse:
    """Test endpoint demonstrating verified Student role access."""
    return TestRoleResponse(
        message="Student access verified",
        identity=UserProfileResponse(
            auth_user_id=student_user.auth_user_id,
            role=student_user.role,
            student_id=student_user.student_id,
            parent_id=student_user.parent_id,
            email=student_user.email,
            name=student_user.display_name,
        ),
    )


@auth_router.get("/parent-test", response_model=TestRoleResponse)
def test_parent_access(parent_user: AuthenticatedUser = Depends(require_parent)) -> TestRoleResponse:
    """Test endpoint demonstrating verified Parent role access."""
    return TestRoleResponse(
        message="Parent access verified",
        identity=UserProfileResponse(
            auth_user_id=parent_user.auth_user_id,
            role=parent_user.role,
            student_id=parent_user.student_id,
            parent_id=parent_user.parent_id,
            email=parent_user.email,
            name=parent_user.display_name,
        ),
    )


api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(student_router)
api_router.include_router(parent_router)
api_router.include_router(parent_consent_router)