"""Task 15 Lightweight Adaptive Recommendation Engine Service.

Provides deterministic, rule-based recommendation catalog management, non-clinical project
behavioural persona classification, recommendation event generation with selection context snapshots,
and recommendation history tracking.
"""

import uuid
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.entities import (
    BehaviouralAnalysis,
    Recommendation,
    RecommendationEvent,
    RecommendationOutcome,
    StudySession,
)

# Standard Recommendation Catalog Types & Pre-seeded Recommendations
DEFAULT_RECOMMENDATIONS = [
    {
        "recommendation_type": "REDUCE_DISTRACTION",
        "title": "Minimize Distraction Traps",
        "content": "Your telemetry indicates elevated non-study application time. Consider closing off-task tabs or using distraction blockers during focus blocks.",
    },
    {
        "recommendation_type": "REDUCE_CONTEXT_SWITCHING",
        "title": "Single-Task Focus Block",
        "content": "Frequent application switches disrupt deep focus work. Try staying inside your primary IDE or document for 20 continuous minutes before switching tasks.",
    },
    {
        "recommendation_type": "STRUCTURED_BREAKS",
        "title": "Paced Micro-Breaks",
        "content": "Extended continuous study blocks without breaks increase mental fatigue. Schedule a 5-minute rest interval after every 30 minutes of deep study.",
    },
    {
        "recommendation_type": "SUSTAINED_FOCUS_BUILDING",
        "title": "Extend Focused Attention",
        "content": "Your focus stability is building well. Challenge yourself to extend your active focus duration by 10 minutes in your next study session.",
    },
    {
        "recommendation_type": "ACADEMIC_REVIEW",
        "title": "Targeted Topic Review",
        "content": "Your recent quiz baseline suggests concept gaps. Spend 15 minutes reviewing weak subject topics before starting new problem sets.",
    },
    {
        "recommendation_type": "MAINTAIN_PRODUCTIVE_HABIT",
        "title": "Sustain Peak Study Routine",
        "content": "Excellent study session pattern! You maintained high focus with minimal distractions. Keep up your current study environment and routine.",
    },
]


def ensure_default_recommendation_catalog(db: Session) -> list[Recommendation]:
    """Ensure standard recommendation catalog entries exist in the database."""
    for rec_data in DEFAULT_RECOMMENDATIONS:
        existing = db.scalar(
            select(Recommendation).where(
                Recommendation.recommendation_type == rec_data["recommendation_type"]
            )
        )
        if not existing:
            new_rec = Recommendation(
                id=uuid.uuid4(),
                recommendation_type=rec_data["recommendation_type"],
                title=rec_data["title"],
                content=rec_data["content"],
                is_active=True,
            )
            db.add(new_rec)
    db.commit()

    return list(
        db.scalars(
            select(Recommendation)
            .where(Recommendation.is_active == True)  # noqa: E712
            .order_by(Recommendation.title.asc())
        ).all()
    )


def evaluate_behavioural_persona(analysis: BehaviouralAnalysis) -> str:
    """Classify student study session state into a deterministic project persona.

    Note: Personas are lightweight, rule-based engineering heuristics for habit
    classification within the application and do NOT represent medical or
    scientifically validated psychological categories.
    """
    snapshot = analysis.feature_snapshot or {}
    distraction_level = analysis.distraction_level or "LOW"
    focus_score = analysis.focus_score if analysis.focus_score is not None else 50.0
    distraction_ratio = snapshot.get("distraction_activity_ratio", 0.0) or 0.0
    switch_count = snapshot.get("activity_switch_count", 0) or 0
    total_duration = snapshot.get("total_session_duration", 0.0) or 0.0
    break_duration = snapshot.get("break_duration", 0.0) or 0.0
    quiz_score = snapshot.get("quiz_score")

    if distraction_level == "HIGH" or distraction_ratio > 0.35:
        return "HIGHLY_DISTRACTED"
    if switch_count > 15:
        return "CONTEXT_SWITCHER"
    if total_duration > 3600 and break_duration == 0:
        return "FATIGUED_STUDIER"
    if quiz_score is not None and quiz_score < 60.0:
        return "LOW_ACADEMIC_RETENTION"
    if focus_score >= 80.0:
        return "HIGH_PERFORMER"

    return "BALANCED_STUDIER"


def generate_student_recommendation(
    student_id: UUID, session_id: UUID, db: Session
) -> RecommendationEvent:
    """Generate and persist a personalized recommendation event for a completed session.

    Enforces real-data gates and stores rich selection context.
    Note: Does NOT create premature RecommendationOutcome records.
    """
    # 1. Ensure recommendation catalog is populated
    ensure_default_recommendation_catalog(db)

    # 2. Verify study session exists and belongs to the authenticated student
    session = db.scalar(
        select(StudySession).where(
            StudySession.id == session_id,
            StudySession.student_id == student_id,
        )
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study session not found for this student",
        )

    # 3. Retrieve or generate behavioural analysis
    analysis = db.scalar(
        select(BehaviouralAnalysis).where(
            BehaviouralAnalysis.study_session_id == session_id
        )
    )
    if not analysis:
        # Check activity count gate
        if not session.activities or len(session.activities) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient activity telemetry data to evaluate recommendation",
            )
        from app.services import student_service
        analysis = student_service.generate_session_behaviour_analysis(
            session_id, student_id, db
        )

    # Enforce real-data gate on snapshot duration
    snapshot = analysis.feature_snapshot or {}
    if snapshot.get("activity_count", 0) < 1 or snapshot.get("total_session_duration", 0.0) <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient activity telemetry data to evaluate recommendation",
        )

    # 4. Classify persona and select matching recommendation type
    persona = evaluate_behavioural_persona(analysis)

    type_mapping = {
        "HIGHLY_DISTRACTED": "REDUCE_DISTRACTION",
        "CONTEXT_SWITCHER": "REDUCE_CONTEXT_SWITCHING",
        "FATIGUED_STUDIER": "STRUCTURED_BREAKS",
        "LOW_ACADEMIC_RETENTION": "ACADEMIC_REVIEW",
        "HIGH_PERFORMER": "MAINTAIN_PRODUCTIVE_HABIT",
        "BALANCED_STUDIER": "SUSTAINED_FOCUS_BUILDING",
    }
    rec_type = type_mapping.get(persona, "SUSTAINED_FOCUS_BUILDING")

    recommendation = db.scalar(
        select(Recommendation).where(Recommendation.recommendation_type == rec_type)
    )
    if not recommendation:
        # Fallback to any active recommendation
        recommendation = db.scalar(
            select(Recommendation).where(Recommendation.is_active == True)  # noqa: E712
        )
        if not recommendation:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No recommendation catalog entries available",
            )

    # 5. Build detailed selection reason and selection context snapshot
    selection_reason = (
        f"Selected {recommendation.title} for persona '{persona}' based on focus score "
        f"{analysis.focus_score} and distraction level '{analysis.distraction_level}'."
    )

    selection_context = {
        "focus_score": analysis.focus_score,
        "distraction_level": analysis.distraction_level,
        "performance_prediction": analysis.performance_prediction,
        "productive_activity_ratio": snapshot.get("productive_activity_ratio"),
        "distraction_activity_ratio": snapshot.get("distraction_activity_ratio"),
        "activity_switch_count": snapshot.get("activity_switch_count"),
        "total_session_duration": snapshot.get("total_session_duration"),
        "quiz_score": snapshot.get("quiz_score"),
        "model_version": analysis.model_version,
    }

    # 6. Check if an event was already generated for this specific session to avoid duplicate events
    existing_event = db.scalar(
        select(RecommendationEvent).where(
            RecommendationEvent.student_id == student_id,
            RecommendationEvent.source_session_id == session_id,
        )
    )
    if existing_event:
        return existing_event

    # 7. Create & persist RecommendationEvent
    event = RecommendationEvent(
        id=uuid.uuid4(),
        student_id=student_id,
        source_session_id=session_id,
        recommendation_id=recommendation.id,
        selection_reason=selection_reason,
        selector_version="v1.0",
        behavioural_persona=persona,
        selection_context=selection_context,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Note: RecommendationOutcome is deliberately NOT initialized here.
    # Outcome fields remain unset/None until an actual outcome event occurs.

    return event


def get_student_recommendation_history(
    student_id: UUID, db: Session, limit: int = 20
) -> list[dict[str, Any]]:
    """Retrieve chronological history of recommendation events for a student."""
    events = db.scalars(
        select(RecommendationEvent)
        .options(
            joinedload(RecommendationEvent.student),
            joinedload(RecommendationEvent.outcome),
        )
        .where(RecommendationEvent.student_id == student_id)
        .order_by(RecommendationEvent.issued_at.desc())
        .limit(limit)
    ).all()

    results = []
    for ev in events:
        rec = db.get(Recommendation, ev.recommendation_id)
        outcome = ev.outcome

        item = {
            "id": ev.id,
            "student_id": ev.student_id,
            "source_session_id": ev.source_session_id,
            "recommendation_id": ev.recommendation_id,
            "recommendation_type": rec.recommendation_type if rec else "GENERAL",
            "title": rec.title if rec else "Study Recommendation",
            "content": rec.content if rec else "",
            "issued_at": ev.issued_at,
            "selection_reason": ev.selection_reason,
            "selector_version": ev.selector_version,
            "behavioural_persona": ev.behavioural_persona,
            "selection_context": ev.selection_context or {},
            "outcome_status": outcome.outcome_status if outcome else "unmeasured",
            "recommendation_followed": outcome.recommendation_followed if outcome else None,
            "delta_focus_next_session": outcome.delta_focus_next_session if outcome else None,
        }
        results.append(item)

    return results


def get_latest_student_recommendation(
    student_id: UUID, db: Session
) -> dict[str, Any] | None:
    """Return the most recent recommendation event generated for the student."""
    history = get_student_recommendation_history(student_id, db, limit=1)
    return history[0] if history else None

