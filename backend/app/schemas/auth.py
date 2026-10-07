from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.core.auth import UserRole


class StudentProvisionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, description="Full name of the student")
    department: str | None = Field(default=None, max_length=100, description="Academic department or branch")
    semester: int | None = Field(default=None, ge=1, le=10, description="Current semester (1-10)")
    academic_year: int | None = Field(default=None, ge=1, le=5, description="Academic year (1-5)")
    timezone: str = Field(default="UTC", max_length=100)


class ParentProvisionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, description="Full name of the parent or guardian")


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    auth_user_id: UUID
    role: UserRole
    student_id: UUID | None = None
    parent_id: UUID | None = None
    email: str | None = None
    name: str | None = None
    department: str | None = None
    semester: int | None = None
    academic_year: int | None = None


class TestRoleResponse(BaseModel):
    message: str
    identity: UserProfileResponse

