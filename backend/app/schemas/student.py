import uuid
from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    auto_record_activity: bool = Field(
        default=False,
        description="If True when concluding an active session with 0 activities, records a study activity for elapsed session duration.",
    )


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
        pattern="^(?i)(study|productive|distraction|break|other|coding|app_focus|interruption|tab_switch|focus_loss|heartbeat|unknown)$",
        description="Controlled activity classification category including real-time web and extension telemetry",
    )
    application_name: str | None = Field(default=None, max_length=200)
    duration_seconds: float | None = Field(default=None, ge=0.0)
    occurred_at: datetime | None = None
    numeric_value: float | None = Field(default=None, ge=0.0)
    metadata_json: dict[str, Any] = Field(default_factory=dict)

    @field_validator("activity_type", mode="before")
    @classmethod
    def sanitize_activity_type(cls, v: Any) -> Any:
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator("application_name", mode="before")
    @classmethod
    def sanitize_application_name(cls, v: Any) -> Any:
        if isinstance(v, str):
            return v.strip()[:200]
        return v

    @field_validator("metadata_json", mode="before")
    @classmethod
    def sanitize_metadata_json(cls, v: Any) -> dict[str, Any]:
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        return {}


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
    unknown_duration_seconds: float = 0.0
    interruption_duration_seconds: float = 0.0
    interruption_count: int = 0
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


class CounterfactualSimulationRequest(BaseModel):
    analysis_id: UUID
    productive_duration: float | None = Field(default=None, ge=0.0, le=86400.0)
    distraction_duration: float | None = Field(default=None, ge=0.0, le=86400.0)
    break_duration: float | None = Field(default=None, ge=0.0, le=86400.0)
    activity_switch_count: int | None = Field(default=None, ge=0, le=500)
    unique_application_count: int | None = Field(default=None, ge=1, le=100)


class CounterfactualSimulationResponse(BaseModel):
    analysis_id: UUID
    study_session_id: UUID
    is_hypothetical: bool = True
    model_version: str
    allowed_bounds: dict[str, dict[str, float | int]]
    baseline_features: dict[str, Any]
    modified_features: dict[str, Any]
    baseline_predictions: dict[str, Any]
    simulated_predictions: dict[str, Any]
    deltas: dict[str, Any]
    explanation_summary: str



# ---------------------------------------------------------------------------
# Quiz Schemas
# ---------------------------------------------------------------------------
class QuizCreate(BaseModel):
    subject_id: UUID
    title: str = Field(..., min_length=1, max_length=200)
    quiz_date: date | None = None
    score: float | None = Field(default=None, ge=0.0)
    max_score: float | None = Field(default=100.0, gt=0.0)


class QuizResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subject_id: UUID
    title: str
    quiz_date: date | None = None
    score: float | None = None
    max_score: float | None = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Performance Report Schemas
# ---------------------------------------------------------------------------
class PerformanceReportCreate(BaseModel):
    subject_id: UUID | None = None
    study_session_id: UUID | None = None
    quiz_id: UUID | None = None
    score: float = Field(..., ge=0.0)
    max_score: float = Field(default=100.0, gt=0.0)
    performance_metric: str = Field(default="Quiz Score", min_length=1, max_length=100)
    measured_at: datetime | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)


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
    subject_name: str | None = None


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


class RecommendationTypeEffectiveness(BaseModel):
    recommendation_type: str
    title: str
    total_issued: int
    times_followed: int
    times_not_followed: int
    measured_outcomes_count: int
    average_focus_delta: float | None = None
    effectiveness_rating: str
    score_adjustment: float


class RecommendationEffectivenessResponse(BaseModel):
    student_id: UUID
    total_recommendations_issued: int
    total_outcomes_recorded: int
    total_measured_deltas: int
    average_overall_focus_delta: float | None = None
    positive_outcomes_count: int
    adherence_rate: float | None = None
    type_breakdown: list[RecommendationTypeEffectiveness]


class RecommendationHistoryItemResponse(BaseModel):
    id: UUID
    student_id: UUID
    source_session_id: UUID | None = None
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
    total_study_minutes: int = 0
    total_sessions: int = 0
    average_focus_score: float | None = None


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

