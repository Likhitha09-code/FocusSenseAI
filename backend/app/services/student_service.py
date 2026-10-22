import uuid
from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.entities import (
    BehaviouralAnalysis,
    PerformanceReport,
    Quiz,
    Recommendation,
    RecommendationEvent,
    RecommendationOutcome,
    StudyActivity,
    StudySession,
    Subject,
)
from app.schemas.student import (
    CounterfactualSimulationRequest,
    PerformanceReportCreate,
    QuizCreate,
    RecentActivityItem,
    RecommendationEventCreate,
    RecommendationOutcomeCreate,
    RecommendationSummaryItem,
    StudentDashboardResponse,
    StudyActivityCreate,
    StudySessionCreate,
    StudySessionUpdate,
    SubjectCreate,
    SubjectPerformanceItem,
)


# ---------------------------------------------------------------------------
# Dashboard Aggregated Summary Service
# ---------------------------------------------------------------------------
def get_student_dashboard_summary(
    student_id: UUID, db: Session
) -> StudentDashboardResponse:
    """Return aggregated real database summary for the student.

    Returns null/empty when no records exist.
    """
    # 1. Focus Score & Distraction Level from latest completed analysis
    latest_analysis = db.scalar(
        select(BehaviouralAnalysis)
        .join(StudySession, BehaviouralAnalysis.study_session_id == StudySession.id)
        .where(StudySession.student_id == student_id)
        .order_by(BehaviouralAnalysis.analyzed_at.desc())
    )
    focus_score = latest_analysis.focus_score if latest_analysis else None
    distraction_level = latest_analysis.distraction_level if latest_analysis else None

    # 2. Total verified study time in minutes
    sessions = db.scalars(
        select(StudySession).where(
            StudySession.student_id == student_id,
            StudySession.started_at.is_not(None),
            StudySession.ended_at.is_not(None),
        )
    ).all()

    total_minutes = 0
    for s in sessions:
        if s.ended_at and s.started_at and s.ended_at >= s.started_at:
            delta = s.ended_at - s.started_at
            total_minutes += int(delta.total_seconds() / 60)

    # 3. Latest performance report score
    latest_report = db.scalar(
        select(PerformanceReport)
        .where(PerformanceReport.student_id == student_id)
        .order_by(PerformanceReport.measured_at.desc())
    )
    performance_score = None
    if latest_report and latest_report.score is not None:
        if latest_report.max_score and latest_report.max_score > 0:
            performance_score = round(
                (latest_report.score / latest_report.max_score) * 100, 1
            )
        else:
            performance_score = latest_report.score

    # 4. Recent study activity telemetry
    activities = db.scalars(
        select(StudyActivity)
        .join(StudySession, StudyActivity.study_session_id == StudySession.id)
        .where(StudySession.student_id == student_id)
        .order_by(StudyActivity.occurred_at.desc())
        .limit(10)
    ).all()

    recent_activity_items = [
        RecentActivityItem(
            activity_id=a.id,
            session_id=a.study_session_id,
            activity_type=a.activity_type,
            occurred_at=a.occurred_at,
            duration_seconds=a.numeric_value,
            metadata=a.metadata_json or {},
        )
        for a in activities
    ]

    # 5. Subject performance
    subjects = db.scalars(
        select(Subject).where(Subject.student_id == student_id)
    ).all()
    subject_items: list[SubjectPerformanceItem] = []
    for subj in subjects:
        subj_quizzes = db.scalars(
            select(Quiz).where(Quiz.subject_id == subj.id)
        ).all()
        # Look for performance reports linked to quizzes in this subject
        quiz_ids = [q.id for q in subj_quizzes]
        avg_score = None
        if quiz_ids:
            reports = db.scalars(
                select(PerformanceReport).where(
                    PerformanceReport.student_id == student_id,
                    PerformanceReport.quiz_id.in_(quiz_ids),
                )
            ).all()
            if reports:
                scores = [r.score for r in reports if r.score is not None]
                if scores:
                    avg_score = round(sum(scores) / len(scores), 1)

        # Study sessions and behavioural focus metrics for this subject
        subj_sessions = db.scalars(
            select(StudySession).where(
                StudySession.student_id == student_id,
                StudySession.subject_id == subj.id,
            )
        ).all()
        subj_minutes = 0
        for ss in subj_sessions:
            if ss.ended_at and ss.started_at and ss.ended_at >= ss.started_at:
                subj_minutes += int((ss.ended_at - ss.started_at).total_seconds() / 60)

        subj_sess_ids = [ss.id for ss in subj_sessions]
        subj_focus_scores: list[float] = []
        if subj_sess_ids:
            subj_analyses = db.scalars(
                select(BehaviouralAnalysis).where(
                    BehaviouralAnalysis.study_session_id.in_(subj_sess_ids)
                )
            ).all()
            subj_focus_scores = [a.focus_score for a in subj_analyses if a.focus_score is not None]

        subj_avg_focus = (
            round(sum(subj_focus_scores) / len(subj_focus_scores), 1)
            if subj_focus_scores
            else None
        )

        subject_items.append(
            SubjectPerformanceItem(
                subject_id=subj.id,
                subject_name=subj.name,
                average_score=avg_score,
                total_quizzes=len(subj_quizzes),
                total_study_minutes=subj_minutes,
                total_sessions=len(subj_sessions),
                average_focus_score=subj_avg_focus,
            )
        )

    # 6. Recommendations
    events = db.scalars(
        select(RecommendationEvent)
        .where(RecommendationEvent.student_id == student_id)
        .order_by(RecommendationEvent.issued_at.desc())
        .limit(5)
    ).all()

    rec_items: list[RecommendationSummaryItem] = []
    for ev in events:
        rec = db.get(Recommendation, ev.recommendation_id)
        if rec:
            rec_items.append(
                RecommendationSummaryItem(
                    recommendation_id=rec.id,
                    recommendation_type=rec.recommendation_type,
                    title=rec.title,
                    issued_at=ev.issued_at,
                )
            )

    return StudentDashboardResponse(
        focus_score=focus_score,
        distraction_level=distraction_level,
        study_time_minutes=total_minutes,
        performance_score=performance_score,
        recent_activity=recent_activity_items,
        subject_performance=subject_items,
        recommendations=rec_items,
    )


# ---------------------------------------------------------------------------
# Subject Services
# ---------------------------------------------------------------------------
def list_student_subjects(student_id: UUID, db: Session) -> list[Subject]:
    return list(
        db.scalars(
            select(Subject)
            .where(Subject.student_id == student_id)
            .order_by(Subject.name.asc())
        ).all()
    )


def create_student_subject(
    student_id: UUID, data: SubjectCreate, db: Session
) -> Subject:
    # Check for existing duplicate subject name for this student
    existing = db.scalar(
        select(Subject).where(
            Subject.student_id == student_id, Subject.name == data.name
        )
    )
    if existing:
        return existing

    subject = Subject(
        id=uuid.uuid4(),
        student_id=student_id,
        name=data.name,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


# ---------------------------------------------------------------------------
# Study Session Services
# ---------------------------------------------------------------------------
def create_study_session(
    student_id: UUID, data: StudySessionCreate, db: Session
) -> StudySession:
    if data.subject_id:
        subject = db.scalar(
            select(Subject).where(
                Subject.id == data.subject_id, Subject.student_id == student_id
            )
        )
        if not subject:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found or does not belong to the student",
            )

    started_at = data.started_at or datetime.now(timezone.utc)
    session = StudySession(
        id=uuid.uuid4(),
        student_id=student_id,
        subject_id=data.subject_id,
        started_at=started_at,
        status=data.status,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def list_study_sessions(
    student_id: UUID,
    db: Session,
    limit: int = 20,
    offset: int = 0,
    status_filter: str | None = None,
) -> tuple[list[StudySession], int]:
    query = select(StudySession).where(StudySession.student_id == student_id)
    if status_filter:
        query = query.where(StudySession.status == status_filter)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    items = db.scalars(
        query.order_by(StudySession.started_at.desc()).offset(offset).limit(limit)
    ).all()

    return list(items), total


def get_study_session(
    session_id: UUID, student_id: UUID, db: Session
) -> StudySession:
    session = db.scalar(
        select(StudySession).where(
            StudySession.id == session_id, StudySession.student_id == student_id
        )
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study session not found",
        )
    return session


def update_study_session(
    session_id: UUID, student_id: UUID, data: StudySessionUpdate, db: Session
) -> StudySession:
    session = get_study_session(session_id, student_id, db)

    if data.subject_id is not None:
        subject = db.scalar(
            select(Subject).where(
                Subject.id == data.subject_id, Subject.student_id == student_id
            )
        )
        if not subject:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found or does not belong to the student",
            )
        session.subject_id = data.subject_id

    if data.ended_at is not None:
        session.ended_at = data.ended_at

    # If auto_record_activity is requested when concluding an active session with 0 activities:
    if data.auto_record_activity and (data.status == "completed" or (data.status is None and session.status == "completed")):
        existing_count = db.scalar(
            select(func.count(StudyActivity.id)).where(StudyActivity.study_session_id == session_id)
        ) or 0
        if existing_count == 0 and session.status == "active":
            def _to_utc(dt: datetime | None) -> datetime:
                if dt is None:
                    return datetime.now(timezone.utc)
                if dt.tzinfo is None:
                    return dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc)

            ended = _to_utc(session.ended_at)
            started = _to_utc(session.started_at)
            dur_seconds = max(0.0, (ended - started).total_seconds())
            if dur_seconds > 0.0:
                subj_name = session.subject.name if session.subject else "General Study"
                activity = StudyActivity(
                    id=uuid.uuid4(),
                    study_session_id=session.id,
                    activity_type="productive",
                    occurred_at=started,
                    numeric_value=round(dur_seconds, 1),
                    metadata_json={"application_name": subj_name, "auto_recorded": True},
                )
                db.add(activity)

    if data.status is not None:
        session.status = data.status

    db.commit()
    db.refresh(session)

    # If session concluded, auto-generate behavioural analysis & recommendation if telemetry exists
    if session.status == "completed":
        try:
            from app.services import recommendation_service

            acts = db.scalars(
                select(StudyActivity).where(StudyActivity.study_session_id == session.id)
            ).all()
            dur = sum(float(a.numeric_value or 0.0) for a in acts)
            if len(acts) > 0 and dur > 0.0:
                generate_session_behaviour_analysis(session.id, student_id, db)
                recommendation_service.generate_student_recommendation(
                    student_id, session.id, db
                )
                recommendation_service.evaluate_pending_outcomes_for_session(
                    student_id, session.id, db
                )
        except Exception:
            pass

    return session


# ---------------------------------------------------------------------------
# Study Activity Services
# ---------------------------------------------------------------------------
def create_study_activity(
    session_id: UUID, student_id: UUID, data: StudyActivityCreate, db: Session
) -> StudyActivity:
    # Verify session exists and belongs to the authenticated student
    session = get_study_session(session_id, student_id, db)

    # Reject activity creation if session is concluded
    if session.status in ("completed", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot record activity for a session with status '{session.status}'",
        )

    # Resolve numeric_value (duration in seconds) and metadata_json (application_name)
    metadata = dict(data.metadata_json or {})
    if data.application_name and "application_name" not in metadata:
        metadata["application_name"] = data.application_name

    duration = data.duration_seconds if data.duration_seconds is not None else data.numeric_value

    # Idempotency / duplicate check for client-supplied event_id
    client_event_id = metadata.get("event_id") or metadata.get("client_event_id")
    if client_event_id:
        existing_activities = db.scalars(
            select(StudyActivity).where(StudyActivity.study_session_id == session_id)
        ).all()
        for existing in existing_activities:
            m = existing.metadata_json or {}
            if str(m.get("client_event_id") or m.get("event_id")) == str(client_event_id):
                return existing

    activity = StudyActivity(
        id=uuid.uuid4(),
        study_session_id=session_id,
        activity_type=data.activity_type.lower(),
        occurred_at=data.occurred_at or datetime.now(timezone.utc),
        numeric_value=duration,
        metadata_json=metadata,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


def list_study_activities(
    session_id: UUID, student_id: UUID, db: Session
) -> list[StudyActivity]:
    # Verify session exists and belongs to the authenticated student
    get_study_session(session_id, student_id, db)

    items = db.scalars(
        select(StudyActivity)
        .where(StudyActivity.study_session_id == session_id)
        .order_by(StudyActivity.occurred_at.asc())
    ).all()
    return list(items)


def aggregate_session_activities(
    session_id: UUID, student_id: UUID, db: Session
) -> dict[str, Any]:
    """Calculate deterministic summary metrics for activities in a study session.

    Reconciles real-time web telemetry and browser extension activity streams
    without inventing fake focus scores or double-counting durations.
    """
    activities = list_study_activities(session_id, student_id, db)

    total_duration = 0.0
    productive_duration = 0.0
    distraction_duration = 0.0
    break_duration = 0.0
    unknown_duration = 0.0
    interruption_duration = 0.0
    interruption_count = 0

    apps_seen = set()
    prev_type: str | None = None
    prev_app: str | None = None
    switch_count = 0

    for act in activities:
        dur = float(act.numeric_value or 0.0)
        total_duration += dur

        act_type = (act.activity_type or "").lower()
        if act_type in ("study", "productive", "coding", "app_focus"):
            productive_duration += dur
        elif act_type in ("distraction", "interruption"):
            distraction_duration += dur
            interruption_duration += dur
            interruption_count += 1
        elif act_type == "break":
            break_duration += dur
        elif act_type in ("focus_loss", "tab_switch", "other", "unknown"):
            unknown_duration += dur
            interruption_duration += dur
            interruption_count += 1

        app_name = (act.metadata_json or {}).get("application_name") or (act.metadata_json or {}).get("app") or (act.metadata_json or {}).get("domain")
        if app_name:
            apps_seen.add(app_name)

        is_tab_switch_event = (act.metadata_json or {}).get("event_type") == "tab_switch" or act_type == "tab_switch"
        if prev_type is not None and (act_type != prev_type or (app_name and app_name != prev_app) or is_tab_switch_event):
            switch_count += 1

        prev_type = act_type
        prev_app = app_name

    prod_pct = round((productive_duration / total_duration) * 100.0, 1) if total_duration > 0 else 0.0
    dist_pct = round((distraction_duration / total_duration) * 100.0, 1) if total_duration > 0 else 0.0

    return {
        "session_id": session_id,
        "total_duration_seconds": round(total_duration, 1),
        "productive_duration_seconds": round(productive_duration, 1),
        "distraction_duration_seconds": round(distraction_duration, 1),
        "break_duration_seconds": round(break_duration, 1),
        "unknown_duration_seconds": round(unknown_duration, 1),
        "interruption_duration_seconds": round(interruption_duration, 1),
        "interruption_count": interruption_count,
        "productive_percentage": prod_pct,
        "distraction_percentage": dist_pct,
        "activity_count": len(activities),
        "activity_switch_count": switch_count,
        "unique_application_count": len(apps_seen),
    }


def extract_session_behaviour_features(
    session_id: UUID, student_id: UUID, db: Session
) -> dict[str, Any]:
    """Extract deterministic feature vector dictionary for future ML pipelines.

    Strictly no model predictions or fake focus scores.
    """
    agg = aggregate_session_activities(session_id, student_id, db)
    total_dur = agg["total_duration_seconds"]

    prod_ratio = round(agg["productive_duration_seconds"] / total_dur, 4) if total_dur > 0 else 0.0
    dist_ratio = round(agg["distraction_duration_seconds"] / total_dur, 4) if total_dur > 0 else 0.0

    return {
        "total_session_duration": total_dur,
        "productive_duration": agg["productive_duration_seconds"],
        "distraction_duration": agg["distraction_duration_seconds"],
        "break_duration": agg["break_duration_seconds"],
        "productive_activity_ratio": prod_ratio,
        "distraction_activity_ratio": dist_ratio,
        "activity_switch_count": agg["activity_switch_count"],
        "activity_count": agg["activity_count"],
        "unique_application_count": agg["unique_application_count"],
    }


def enrich_features_with_academic_data(
    student_id: UUID, subject_id: UUID | None, features: dict[str, Any], db: Session
) -> dict[str, Any]:
    """Enrich feature dictionary with real quiz performance metrics if available.

    If no quiz score exists, sets quiz_score to None allowing preprocessor
    imputation rather than inventing data.
    """
    enriched = dict(features)
    avg_score = None

    if subject_id:
        subj_quizzes = db.scalars(
            select(Quiz).where(Quiz.subject_id == subject_id)
        ).all()
        quiz_ids = [q.id for q in subj_quizzes]
        if quiz_ids:
            reports = db.scalars(
                select(PerformanceReport).where(
                    PerformanceReport.student_id == student_id,
                    PerformanceReport.quiz_id.in_(quiz_ids),
                )
            ).all()
            scores = [r.score for r in reports if r.score is not None]
            if scores:
                avg_score = float(sum(scores) / len(scores))

    if avg_score is None:
        # Fallback to overall student quiz average if no subject-specific quiz score
        all_reports = db.scalars(
            select(PerformanceReport).where(
                PerformanceReport.student_id == student_id,
                PerformanceReport.score.is_not(None),
            )
        ).all()
        scores = [r.score for r in all_reports if r.score is not None]
        if scores:
            avg_score = float(sum(scores) / len(scores))

    enriched["quiz_score"] = round(avg_score, 1) if avg_score is not None else None
    return enriched


def generate_session_behaviour_analysis(
    session_id: UUID, student_id: UUID, db: Session
) -> BehaviouralAnalysis:
    """Generate real ML predictions for a session passing the Real-Data Gate.

    Requires at least 1 logged activity record and >0 total activity duration.
    """
    from app.services import ml_service

    session = get_study_session(session_id, student_id, db)
    activities = list_study_activities(session_id, student_id, db)

    total_dur = sum(float(a.numeric_value or 0.0) for a in activities)
    if len(activities) == 0 or total_dur <= 0.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient activity telemetry data to generate an AI behaviour analysis.",
        )

    # 1. Extract raw Task 10 features
    features = extract_session_behaviour_features(session_id, student_id, db)

    # 2. Enrich with real academic quiz data
    enriched_features = enrich_features_with_academic_data(
        student_id, session.subject_id, features, db
    )

    # 3. Call ML Prediction Service
    predictions = ml_service.predict_behaviour(enriched_features)
    shap_data = ml_service.calculate_feature_attributions(enriched_features, target="focus_score")

    # 4. Save/Update DB Record
    existing = db.scalar(
        select(BehaviouralAnalysis).where(
            BehaviouralAnalysis.study_session_id == session_id
        )
    )
    if existing:
        existing.feature_snapshot = enriched_features
        existing.focus_score = predictions["focus_score"]
        existing.distraction_level = predictions["distraction_level"]
        existing.performance_prediction = predictions["performance_prediction"]
        existing.shap_values = shap_data
        existing.model_version = predictions["model_version"]
        db.commit()
        db.refresh(existing)
        return existing

    analysis = BehaviouralAnalysis(
        id=uuid.uuid4(),
        study_session_id=session_id,
        feature_snapshot=enriched_features,
        focus_score=predictions["focus_score"],
        distraction_level=predictions["distraction_level"],
        performance_prediction=predictions["performance_prediction"],
        shap_values=shap_data,
        model_version=predictions["model_version"],
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


# ---------------------------------------------------------------------------
# Behavioural Analysis Services
# ---------------------------------------------------------------------------
def list_behavioural_analyses(
    student_id: UUID, db: Session, limit: int = 20, offset: int = 0
) -> list[BehaviouralAnalysis]:

    # Auto-generate analyses for any unanalyzed student sessions with sufficient activity data
    unanalyzed_sessions = db.scalars(
        select(StudySession)
        .outerjoin(BehaviouralAnalysis, StudySession.id == BehaviouralAnalysis.study_session_id)
        .where(
            StudySession.student_id == student_id,
            BehaviouralAnalysis.id.is_(None),
        )
    ).all()

    for sess in unanalyzed_sessions:
        acts = db.scalars(
            select(StudyActivity).where(StudyActivity.study_session_id == sess.id)
        ).all()
        dur = sum(float(a.numeric_value or 0.0) for a in acts)
        if len(acts) > 0 and dur > 0.0:
            try:
                generate_session_behaviour_analysis(sess.id, student_id, db)
            except Exception:
                pass

    items = list(
        db.scalars(
            select(BehaviouralAnalysis)
            .options(joinedload(BehaviouralAnalysis.study_session).joinedload(StudySession.subject))
            .join(StudySession, BehaviouralAnalysis.study_session_id == StudySession.id)
            .where(StudySession.student_id == student_id)
            .order_by(BehaviouralAnalysis.analyzed_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )

    for item in items:
        if item.shap_values is None and item.feature_snapshot:
            try:
                from app.services import ml_service

                item.shap_values = ml_service.calculate_feature_attributions(
                    item.feature_snapshot, target="focus_score"
                )
                db.commit()
            except Exception:
                pass

    return items


def get_behavioural_analysis(
    analysis_id: UUID, student_id: UUID, db: Session
) -> BehaviouralAnalysis:
    analysis = db.scalar(
        select(BehaviouralAnalysis)
        .options(joinedload(BehaviouralAnalysis.study_session).joinedload(StudySession.subject))
        .join(StudySession, BehaviouralAnalysis.study_session_id == StudySession.id)
        .where(
            BehaviouralAnalysis.id == analysis_id,
            StudySession.student_id == student_id,
        )
    )
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Behavioural analysis not found",
        )

    if analysis.shap_values is None and analysis.feature_snapshot:
        try:
            from app.services import ml_service

            analysis.shap_values = ml_service.calculate_feature_attributions(
                analysis.feature_snapshot, target="focus_score"
            )
            db.commit()
            db.refresh(analysis)
        except Exception:
            pass

    return analysis


def run_session_counterfactual_simulation(
    student_id: UUID, data: CounterfactualSimulationRequest, db: Session
) -> dict[str, Any]:
    """Run an interactive counterfactual what-if simulation on an analyzed session.

    Strictly read-only against stored session and analysis records; original
    predictions and telemetry remain immutable.
    """
    from app.services import ml_service

    analysis = get_behavioural_analysis(data.analysis_id, student_id, db)

    adjustments = {
        "productive_duration": data.productive_duration,
        "distraction_duration": data.distraction_duration,
        "break_duration": data.break_duration,
        "activity_switch_count": data.activity_switch_count,
        "unique_application_count": data.unique_application_count,
    }

    try:
        sim_result = ml_service.simulate_counterfactual(
            analysis.feature_snapshot or {}, adjustments
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return {
        "analysis_id": analysis.id,
        "study_session_id": analysis.study_session_id,
        "is_hypothetical": True,
        **sim_result,
    }



# ---------------------------------------------------------------------------
# Quizzes & Performance Services
# ---------------------------------------------------------------------------
def list_student_quizzes(student_id: UUID, db: Session) -> list[Quiz]:
    items = db.scalars(
        select(Quiz)
        .options(joinedload(Quiz.performance_reports))
        .join(Subject, Quiz.subject_id == Subject.id)
        .where(Subject.student_id == student_id)
        .order_by(Quiz.created_at.desc())
    ).unique().all()
    return list(items)


def create_student_quiz(
    student_id: UUID, data: QuizCreate, db: Session
) -> Quiz:
    # Verify subject belongs to student
    subject = db.scalar(
        select(Subject).where(
            Subject.id == data.subject_id, Subject.student_id == student_id
        )
    )
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found or does not belong to the student",
        )

    if data.score is not None and data.max_score is not None and data.score > data.max_score:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Score ({data.score}) cannot exceed max_score ({data.max_score})",
        )

    quiz = Quiz(
        id=uuid.uuid4(),
        subject_id=data.subject_id,
        title=data.title,
        quiz_date=data.quiz_date,
    )
    db.add(quiz)

    if data.score is not None:
        measured = (
            datetime.combine(data.quiz_date, datetime.min.time(), tzinfo=timezone.utc)
            if data.quiz_date
            else datetime.now(timezone.utc)
        )
        report = PerformanceReport(
            id=uuid.uuid4(),
            student_id=student_id,
            quiz_id=quiz.id,
            score=data.score,
            max_score=data.max_score or 100.0,
            performance_metric=data.title,
            measured_at=measured,
            metadata_json={"source": "quiz_submission", "subject_id": str(data.subject_id)},
        )
        db.add(report)

    db.commit()
    db.refresh(quiz)
    if data.score is not None:
        quiz._score = data.score
        quiz._max_score = data.max_score or 100.0
    return quiz


def create_performance_report(
    student_id: UUID, data: PerformanceReportCreate, db: Session
) -> PerformanceReport:
    if data.score > data.max_score:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Score ({data.score}) cannot exceed max_score ({data.max_score})",
        )

    quiz_id = data.quiz_id
    if quiz_id:
        quiz = db.scalar(
            select(Quiz)
            .join(Subject, Quiz.subject_id == Subject.id)
            .where(Quiz.id == quiz_id, Subject.student_id == student_id)
        )
        if not quiz:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quiz not found or does not belong to the student",
            )
    elif data.subject_id:
        subject = db.scalar(
            select(Subject).where(
                Subject.id == data.subject_id, Subject.student_id == student_id
            )
        )
        if not subject:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found or does not belong to the student",
            )
        quiz = Quiz(
            id=uuid.uuid4(),
            subject_id=data.subject_id,
            title=data.performance_metric,
            quiz_date=data.measured_at.date() if data.measured_at else date.today(),
        )
        db.add(quiz)
        db.flush()
        quiz_id = quiz.id

    if data.study_session_id:
        get_study_session(data.study_session_id, student_id, db)

    metadata = dict(data.metadata_json or {})
    if data.subject_id and "subject_id" not in metadata:
        metadata["subject_id"] = str(data.subject_id)

    report = PerformanceReport(
        id=uuid.uuid4(),
        student_id=student_id,
        study_session_id=data.study_session_id,
        quiz_id=quiz_id,
        score=data.score,
        max_score=data.max_score,
        performance_metric=data.performance_metric,
        measured_at=data.measured_at or datetime.now(timezone.utc),
        metadata_json=metadata,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def list_performance_reports(
    student_id: UUID, db: Session, limit: int = 50, offset: int = 0
) -> list[PerformanceReport]:
    items = db.scalars(
        select(PerformanceReport)
        .options(
            joinedload(PerformanceReport.quiz).joinedload(Quiz.subject),
            joinedload(PerformanceReport.study_session).joinedload(StudySession.subject),
        )
        .where(PerformanceReport.student_id == student_id)
        .order_by(PerformanceReport.measured_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return list(items)


def get_performance_report(
    report_id: UUID, student_id: UUID, db: Session
) -> PerformanceReport:
    report = db.scalar(
        select(PerformanceReport)
        .options(
            joinedload(PerformanceReport.quiz).joinedload(Quiz.subject),
            joinedload(PerformanceReport.study_session).joinedload(StudySession.subject),
        )
        .where(
            PerformanceReport.id == report_id,
            PerformanceReport.student_id == student_id,
        )
    )
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance report not found",
        )
    return report


# ---------------------------------------------------------------------------
# Recommendations & Intervention Evaluation Services
# ---------------------------------------------------------------------------
def list_available_recommendations(db: Session) -> list[Recommendation]:
    from app.services.recommendation_service import ensure_default_recommendation_catalog
    return ensure_default_recommendation_catalog(db)


def get_recommendation_by_id(recommendation_id: UUID, db: Session) -> Recommendation:
    rec = db.get(Recommendation, recommendation_id)
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation not found",
        )
    return rec


def create_recommendation_event(
    recommendation_id: UUID,
    student_id: UUID,
    data: RecommendationEventCreate,
    db: Session,
) -> RecommendationEvent:
    # 1. Verify recommendation exists
    get_recommendation_by_id(recommendation_id, db)

    # 2. Verify source session exists and belongs to the authenticated student
    get_study_session(data.source_session_id, student_id, db)

    event = RecommendationEvent(
        id=uuid.uuid4(),
        student_id=student_id,
        source_session_id=data.source_session_id,
        recommendation_id=recommendation_id,
        selection_reason=data.selection_reason,
        selector_version=data.selector_version,
        behavioural_persona=data.behavioural_persona,
        selection_context=data.selection_context,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def record_recommendation_outcome(
    recommendation_id: UUID,
    student_id: UUID,
    data: RecommendationOutcomeCreate,
    db: Session,
) -> RecommendationOutcome:
    # 1. Verify recommendation exists
    get_recommendation_by_id(recommendation_id, db)

    # 2. Determine target event_id
    event_id = data.recommendation_event_id
    if not event_id:
        # Find latest event for this recommendation and student
        event = db.scalar(
            select(RecommendationEvent).where(
                RecommendationEvent.recommendation_id == recommendation_id,
                RecommendationEvent.student_id == student_id,
            ).order_by(RecommendationEvent.issued_at.desc())
        )
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recommendation event not found for this student and recommendation",
            )
        event_id = event.id

    from app.services import recommendation_service
    return recommendation_service.record_recommendation_outcome(
        student_id=student_id,
        event_id=event_id,
        recommendation_followed=data.recommendation_followed,
        next_session_id=data.next_session_id,
        next_focus_score=data.next_focus_score,
        delta_focus_next_session=data.delta_focus_next_session,
        outcome_status=data.outcome_status,
        notes=data.notes,
        db=db,
    )

