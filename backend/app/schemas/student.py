import uuid
from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Subject Schemas
# ---------------------------------------------------------------------------
class SubjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class SubjectCreate(SubjectBase):
    pass


class SubjectResponse(SubjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    student_id: UUID
    created_at: datetime


# ---------------------------------------------------------------------------
# Study Session Schemas
# ---------------------------------------------------------------------------
class StudySessionCreate(BaseModel):
    subject_id: UUID | None = None
    started_at: datetime | None = None
    status: str = Field(default="active", pattern="^(planned|active|completed|cancelled)$")


class StudySessionUpdate(BaseModel):
    ended_at: datetime | None = None
    status: str | None = Field(default=None, pattern="^(planned|active|completed|cancelled)$")
    subject_id: UUID | None = None


class StudySessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    student_id: UUID
    subject_id: UUID | None = None
    started_at: datetime
    ended_at: datetime | None = None
    status: str
    created_at: datetime


class StudySessionListResponse(BaseModel):
    items: list[StudySessionResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Study Activity Schemas
# ---------------------------------------------------------------------------
class StudyActivityCreate(BaseModel):
    activity_type: str = Field(
        ...,
        pattern="^(study|productive|distraction|break|other|coding|app_focus)$",
        description="Controlled activity classification category",
    )


    application_name: str | None = Field(default=None, max_length=200)
    duration_seconds: float | None = Field(default=None, ge=0.0)
    occurred_at: datetime | None = None
    numeric_value: float | None = Field(default=None, ge=0.0)
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class StudyActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    study_session_id: UUID
    activity_type: str
    occurred_at: datetime
    numeric_value: float | None = None
    metadata_json: dict[str, Any]
    created_at: datetime


class SessionActivitySummaryResponse(BaseModel):
    session_id: UUID
    total_duration_seconds: float
    productive_duration_seconds: float
    distraction_duration_seconds: float
    break_duration_seconds: float
    productive_percentage: float
    distraction_percentage: float
    activity_count: int
    activity_switch_count: int
    unique_application_count: int



# ---------------------------------------------------------------------------
# Behavioural Analysis Schemas
# ---------------------------------------------------------------------------
class BehaviourAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    study_session_id: UUID
    feature_snapshot: dict[str, Any]
    focus_score: float | None = None
    distraction_level: str | None = None
    performance_prediction: float | None = None
    shap_values: dict[str, Any] | None = None
    counterfactual_baseline: dict[str, Any] | None = None
    model_version: str
    analyzed_at: datetime
    session_started_at: datetime | None = None
    subject_name: str | None = None


# ---------------------------------------------------------------------------
# Quiz Schemas
# ---------------------------------------------------------------------------
class QuizCreate(BaseModel):
    subject_id: UUID
    title: str = Field(..., min_length=1, max_length=200)
    quiz_date: date | None = None


class QuizResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subject_id: UUID
    title: str
    quiz_date: date | None = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Performance Report Schemas
# ---------------------------------------------------------------------------
class PerformanceReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    student_id: UUID
    study_session_id: UUID | None = None
    quiz_id: UUID | None = None
    score: float | None = None
    max_score: float | None = None
    performance_metric: str
    measured_at: datetime
    metadata_json: dict[str, Any]


# ---------------------------------------------------------------------------
# Recommendation Schemas
# ---------------------------------------------------------------------------
class RecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    recommendation_type: str
    title: str
    content: str
    is_active: bool
    created_at: datetime


class RecommendationEventCreate(BaseModel):
    source_session_id: UUID
    selection_reason: str | None = None
    selector_version: str = Field(default="v1.0", max_length=100)
    behavioural_persona: str | None = Field(default=None, max_length=100)
    selection_context: dict[str, Any] = Field(default_factory=dict)


class RecommendationEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    student_id: UUID
    source_session_id: UUID
    recommendation_id: UUID
    issued_at: datetime
    selection_reason: str | None = None
    selector_version: str
    behavioural_persona: str | None = None
    selection_context: dict[str, Any]


class RecommendationOutcomeCreate(BaseModel):
    recommendation_event_id: UUID | None = None
    recommendation_followed: bool | None = None
    next_session_id: UUID | None = None
    measured_at: datetime | None = None
    next_focus_score: float | None = Field(default=None, ge=0.0, le=100.0)
    delta_focus_next_session: float | None = None
    outcome_status: str = Field(default="pending", pattern="^(pending|measured|unavailable)$")
    notes: str | None = None


class RecommendationOutcomeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    recommendation_event_id: UUID
    recommendation_followed: bool | None = None
    next_session_id: UUID | None = None
    measured_at: datetime | None = None
    next_focus_score: float | None = None
    delta_focus_next_session: float | None = None
    outcome_status: str
    notes: str | None = None


class RecommendationGenerateRequest(BaseModel):
    session_id: UUID


class RecommendationHistoryItemResponse(BaseModel):
    id: UUID
    student_id: UUID
    source_session_id: UUID
    recommendation_id: UUID
    recommendation_type: str
    title: str
    content: str
    issued_at: datetime
    selection_reason: str | None = None
    selector_version: str
    behavioural_persona: str | None = None
    selection_context: dict[str, Any] = Field(default_factory=dict)
    outcome_id: UUID | None = None
    outcome_status: str = "unmeasured"
    recommendation_followed: bool | None = None
    next_session_id: UUID | None = None
    next_focus_score: float | None = None
    delta_focus_next_session: float | None = None
    measured_at: datetime | None = None
    notes: str | None = None




# ---------------------------------------------------------------------------
# Student Dashboard Aggregated Schemas
# ---------------------------------------------------------------------------
class RecentActivityItem(BaseModel):
    activity_id: UUID
    session_id: UUID
    activity_type: str
    occurred_at: datetime
    duration_seconds: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SubjectPerformanceItem(BaseModel):
    subject_id: UUID
    subject_name: str
    average_score: float | None = None
    total_quizzes: int = 0


class RecommendationSummaryItem(BaseModel):
    recommendation_id: UUID
    recommendation_type: str
    title: str
    issued_at: datetime | None = None


class StudentDashboardResponse(BaseModel):
    focus_score: float | None = None
    distraction_level: str | None = None
    study_time_minutes: int = 0
    performance_score: float | None = None
    recent_activity: list[RecentActivityItem] = Field(default_factory=list)
    subject_performance: list[SubjectPerformanceItem] = Field(default_factory=list)
    recommendations: list[RecommendationSummaryItem] = Field(default_factory=list)

