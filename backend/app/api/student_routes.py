from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.auth import AuthenticatedUser, require_student
from app.db.session import get_db
from app.schemas.student import (
    BehaviourAnalysisResponse,
    PerformanceReportResponse,
    QuizCreate,
    QuizResponse,
    RecommendationEventCreate,
    RecommendationEventResponse,
    RecommendationOutcomeCreate,
    RecommendationOutcomeResponse,
    RecommendationResponse,
    SessionActivitySummaryResponse,
    StudentDashboardResponse,

    StudyActivityCreate,
    StudyActivityResponse,
    StudySessionCreate,
    StudySessionListResponse,
    StudySessionResponse,
    StudySessionUpdate,
    SubjectCreate,
    SubjectResponse,
)
from app.services import student_service

student_router = APIRouter(prefix="/student", tags=["student"])


# ---------------------------------------------------------------------------
# 1. Student Dashboard Summary
# ---------------------------------------------------------------------------
@student_router.get(
    "/dashboard",
    response_model=StudentDashboardResponse,
    summary="Get student dashboard summary",
    description="Returns aggregated metrics, recent activities, subject performance, and recommendations for the authenticated student.",
)
def get_dashboard(
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> StudentDashboardResponse:
    return student_service.get_student_dashboard_summary(
        current_user.student_id, db  # type: ignore[arg-type]
    )


# ---------------------------------------------------------------------------
# 2. Subjects
# ---------------------------------------------------------------------------
@student_router.get(
    "/subjects",
    response_model=list[SubjectResponse],
    summary="List student subjects",
)
def get_subjects(
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> list[SubjectResponse]:
    return student_service.list_student_subjects(
        current_user.student_id, db  # type: ignore[arg-type]
    )


@student_router.post(
    "/subjects",
    response_model=SubjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create student subject",
)
def create_subject(
    data: SubjectCreate,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> SubjectResponse:
    return student_service.create_student_subject(
        current_user.student_id, data, db  # type: ignore[arg-type]
    )


# ---------------------------------------------------------------------------
# 3. Study Sessions
# ---------------------------------------------------------------------------
@student_router.post(
    "/sessions",
    response_model=StudySessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new study session",
    description="Starts or plans a study session automatically owned by the authenticated student.",
)
def create_session(
    data: StudySessionCreate,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> StudySessionResponse:
    return student_service.create_study_session(
        current_user.student_id, data, db  # type: ignore[arg-type]
    )


@student_router.get(
    "/sessions",
    response_model=StudySessionListResponse,
    summary="List authenticated student's study sessions",
)
def list_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> StudySessionListResponse:
    items, total = student_service.list_study_sessions(
        current_user.student_id,  # type: ignore[arg-type]
        db,
        limit=limit,
        offset=offset,
        status_filter=status_filter,
    )
    return StudySessionListResponse(
        items=[StudySessionResponse.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@student_router.get(
    "/sessions/{session_id}",
    response_model=StudySessionResponse,
    summary="Get a specific study session",
)
def get_session(
    session_id: UUID,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> StudySessionResponse:
    return student_service.get_study_session(
        session_id, current_user.student_id, db  # type: ignore[arg-type]
    )


@student_router.patch(
    "/sessions/{session_id}",
    response_model=StudySessionResponse,
    summary="Update a study session",
)
def update_session(
    session_id: UUID,
    data: StudySessionUpdate,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> StudySessionResponse:
    return student_service.update_study_session(
        session_id, current_user.student_id, data, db  # type: ignore[arg-type]
    )


# ---------------------------------------------------------------------------
# 4. Study Activities
# ---------------------------------------------------------------------------
@student_router.post(
    "/sessions/{session_id}/activities",
    response_model=StudyActivityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record study activity under a session",
)
def create_activity(
    session_id: UUID,
    data: StudyActivityCreate,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> StudyActivityResponse:
    return student_service.create_study_activity(
        session_id, current_user.student_id, data, db  # type: ignore[arg-type]
    )


@student_router.get(
    "/sessions/{session_id}/activities",
    response_model=list[StudyActivityResponse],
    summary="List activities under a study session",
)
def list_activities(
    session_id: UUID,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> list[StudyActivityResponse]:
    return student_service.list_study_activities(
        session_id, current_user.student_id, db  # type: ignore[arg-type]
    )


@student_router.get(
    "/sessions/{session_id}/activities/summary",
    response_model=SessionActivitySummaryResponse,
    summary="Get aggregated activity summary metrics for a study session",
)
def get_activities_summary(
    session_id: UUID,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> SessionActivitySummaryResponse:
    summary_data = student_service.aggregate_session_activities(
        session_id, current_user.student_id, db  # type: ignore[arg-type]
    )
    return SessionActivitySummaryResponse(**summary_data)



# ---------------------------------------------------------------------------
# 5. Behavioural Analysis
# ---------------------------------------------------------------------------
@student_router.get(
    "/behaviour",
    response_model=list[BehaviourAnalysisResponse],
    summary="List student's behavioural analyses",
)
def list_behaviour(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> list[BehaviourAnalysisResponse]:
    return student_service.list_behavioural_analyses(
        current_user.student_id, db, limit=limit, offset=offset  # type: ignore[arg-type]
    )


@student_router.get(
    "/behaviour/{analysis_id}",
    response_model=BehaviourAnalysisResponse,
    summary="Get a specific behavioural analysis",
)
def get_behaviour(
    analysis_id: UUID,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> BehaviourAnalysisResponse:
    return student_service.get_behavioural_analysis(
        analysis_id, current_user.student_id, db  # type: ignore[arg-type]
    )


# ---------------------------------------------------------------------------
# 6. Performance & Quizzes
# ---------------------------------------------------------------------------
@student_router.get(
    "/performance",
    response_model=list[PerformanceReportResponse],
    summary="List performance reports",
)
def list_performance(
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> list[PerformanceReportResponse]:
    return student_service.list_performance_reports(
        current_user.student_id, db  # type: ignore[arg-type]
    )


@student_router.get(
    "/performance/{report_id}",
    response_model=PerformanceReportResponse,
    summary="Get a specific performance report",
)
def get_performance(
    report_id: UUID,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> PerformanceReportResponse:
    return student_service.get_performance_report(
        report_id, current_user.student_id, db  # type: ignore[arg-type]
    )


@student_router.get(
    "/quizzes",
    response_model=list[QuizResponse],
    summary="List student's quizzes",
)
def list_quizzes(
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> list[QuizResponse]:
    return student_service.list_student_quizzes(
        current_user.student_id, db  # type: ignore[arg-type]
    )


@student_router.post(
    "/quizzes",
    response_model=QuizResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a quiz under an enrolled subject",
)
def create_quiz(
    data: QuizCreate,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> QuizResponse:
    return student_service.create_student_quiz(
        current_user.student_id, data, db  # type: ignore[arg-type]
    )


# ---------------------------------------------------------------------------
# 7. Recommendations & Interventions
# ---------------------------------------------------------------------------
@student_router.get(
    "/recommendations",
    response_model=list[RecommendationResponse],
    summary="List active recommendations catalog",
)
def list_recommendations(
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> list[RecommendationResponse]:
    return student_service.list_available_recommendations(db)


@student_router.get(
    "/recommendations/{recommendation_id}",
    response_model=RecommendationResponse,
    summary="Get a specific recommendation",
)
def get_recommendation(
    recommendation_id: UUID,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> RecommendationResponse:
    return student_service.get_recommendation_by_id(recommendation_id, db)


@student_router.post(
    "/recommendations/{recommendation_id}/events",
    response_model=RecommendationEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record an issued recommendation event for the student",
)
def record_event(
    recommendation_id: UUID,
    data: RecommendationEventCreate,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> RecommendationEventResponse:
    return student_service.create_recommendation_event(
        recommendation_id, current_user.student_id, data, db  # type: ignore[arg-type]
    )


@student_router.post(
    "/recommendations/{recommendation_id}/outcome",
    response_model=RecommendationOutcomeResponse,
    status_code=status.HTTP_200_OK,
    summary="Record or update an intervention outcome",
    description="Stores recommendation_followed, delta_focus_next_session, and next session evaluation for causal analysis.",
)
def record_outcome(
    recommendation_id: UUID,
    data: RecommendationOutcomeCreate,
    current_user: AuthenticatedUser = Depends(require_student),
    db: Session = Depends(get_db),
) -> RecommendationOutcomeResponse:
    return student_service.record_recommendation_outcome(
        recommendation_id, current_user.student_id, data, db  # type: ignore[arg-type]
    )

