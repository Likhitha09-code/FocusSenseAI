from datetime import datetime, timezone
import uuid
from pydantic import BaseModel, Field

class StudentParentLinkCreate(BaseModel):
    student_id: uuid.UUID

class StudentParentLinkConsentUpdate(BaseModel):
    consent_status: str = Field(..., pattern="^(pending|active|revoked|rejected)$")

class LinkedStudentSummary(BaseModel):
    id: uuid.UUID | None = None
    link_id: uuid.UUID
    student_id: uuid.UUID
    student_name: str | None = None
    display_name: str | None = None
    department: str | None = None
    semester: int | None = None
    academic_year: int | None = None
    consent_status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None

class LinkedParentSummary(BaseModel):
    id: uuid.UUID | None = None
    link_id: uuid.UUID
    parent_id: uuid.UUID
    parent_name: str | None = None
    display_name: str | None = None
    consent_status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None

class ParentSubjectSummary(BaseModel):
    subject_id: uuid.UUID
    subject_name: str
    total_study_minutes: int = 0
    total_sessions: int = 0
    average_focus_score: float | None = None
    average_quiz_score: float | None = None

class StudentParentLinkUnlinkResponse(BaseModel):
    success: bool = True
    message: str

class ParentStudentProgressSummary(BaseModel):
    student_id: uuid.UUID
    display_name: str | None = None
    consent_status: str
    total_study_sessions: int
    completed_study_sessions: int
    total_study_duration_minutes: float
    average_focus_score: float | None = None
    latest_distraction_level: str | None = None
    recent_sessions: list[dict] = Field(default_factory=list)
    recent_behaviour_analyses: list[dict] = Field(default_factory=list)
    recent_recommendations: list[dict] = Field(default_factory=list)
    subject_summaries: list[ParentSubjectSummary] = Field(default_factory=list)

