"""Task 15 Lightweight Adaptive Recommendation Engine Service.

Provides deterministic, rule-based recommendation catalog management, non-clinical project
behavioural persona classification, recommendation event generation with selection context snapshots,
and recommendation history tracking.
"""

import uuid
from datetime import datetime, timezone
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
    StudyActivity,
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
    {
        "recommendation_type": "STUDY_HABIT_ONBOARDING",
        "title": "Establish Your Study Baseline",
        "content": "Welcome to FocusSense AI. Start your first focused study session and record learning activities. The AI engine will track your focus rhythms and generate personalized behavioural recommendations.",
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


# ---------------------------------------------------------------------------
# Adaptive Feedback Loop & Ranking Models
# ---------------------------------------------------------------------------
PERSONA_CANDIDATE_WEIGHTS: dict[str, dict[str, float]] = {
    "HIGHLY_DISTRACTED": {
        "REDUCE_DISTRACTION": 10.0,
        "REDUCE_CONTEXT_SWITCHING": 8.0,
        "STRUCTURED_BREAKS": 6.0,
    },
    "CONTEXT_SWITCHER": {
        "REDUCE_CONTEXT_SWITCHING": 10.0,
        "REDUCE_DISTRACTION": 8.0,
        "SUSTAINED_FOCUS_BUILDING": 6.0,
    },
    "FATIGUED_STUDIER": {
        "STRUCTURED_BREAKS": 10.0,
        "SUSTAINED_FOCUS_BUILDING": 8.0,
        "REDUCE_DISTRACTION": 6.0,
    },
    "LOW_ACADEMIC_RETENTION": {
        "ACADEMIC_REVIEW": 10.0,
        "SUSTAINED_FOCUS_BUILDING": 8.0,
        "STRUCTURED_BREAKS": 6.0,
    },
    "HIGH_PERFORMER": {
        "MAINTAIN_PRODUCTIVE_HABIT": 10.0,
        "SUSTAINED_FOCUS_BUILDING": 8.0,
        "ACADEMIC_REVIEW": 6.0,
    },
    "BALANCED_STUDIER": {
        "SUSTAINED_FOCUS_BUILDING": 10.0,
        "STRUCTURED_BREAKS": 8.0,
        "MAINTAIN_PRODUCTIVE_HABIT": 6.0,
    },
}

DEFAULT_PERSONA_RECOMMENDATION: dict[str, str] = {
    "HIGHLY_DISTRACTED": "REDUCE_DISTRACTION",
    "CONTEXT_SWITCHER": "REDUCE_CONTEXT_SWITCHING",
    "FATIGUED_STUDIER": "STRUCTURED_BREAKS",
    "LOW_ACADEMIC_RETENTION": "ACADEMIC_REVIEW",
    "HIGH_PERFORMER": "MAINTAIN_PRODUCTIVE_HABIT",
    "BALANCED_STUDIER": "SUSTAINED_FOCUS_BUILDING",
}


def compute_student_recommendation_signals(
    student_id: UUID, db: Session
) -> dict[str, dict[str, Any]]:
    """Compute empirical effectiveness signals per recommendation type for a specific student.

    Strictly isolated to `student_id`. Uses Bayesian shrinkage on measured focus deltas
    (delta_focus_next_session) and follow-through history to produce bounded score adjustments.
    """
    events = list(
        db.scalars(
            select(RecommendationEvent)
            .options(
                joinedload(RecommendationEvent.outcome),
            )
            .where(RecommendationEvent.student_id == student_id)
        ).all()
    )

    type_stats: dict[str, dict[str, Any]] = {}

    for ev in events:
        rec = db.get(Recommendation, ev.recommendation_id)
        if not rec:
            continue
        rtype = rec.recommendation_type
        if rtype not in type_stats:
            type_stats[rtype] = {
                "total_issued": 0,
                "times_followed": 0,
                "times_not_followed": 0,
                "deltas": [],
            }
        stats = type_stats[rtype]
        stats["total_issued"] += 1

        outcome = ev.outcome
        if outcome:
            if outcome.recommendation_followed is True:
                stats["times_followed"] += 1
            elif outcome.recommendation_followed is False:
                stats["times_not_followed"] += 1

            if outcome.delta_focus_next_session is not None:
                stats["deltas"].append(float(outcome.delta_focus_next_session))

    K = 2.0  # Prior pseudo-count for Bayesian shrinkage (conservative against small samples)
    signals: dict[str, dict[str, Any]] = {}

    for rtype, stats in type_stats.items():
        deltas = stats["deltas"]
        n_deltas = len(deltas)
        followed = stats["times_followed"]
        not_followed = stats["times_not_followed"]

        # Delta focus signal with shrinkage
        if n_deltas > 0:
            mean_delta = float(sum(deltas) / n_deltas)
            shrinkage_weight = n_deltas / (n_deltas + K)
            delta_signal = shrinkage_weight * mean_delta
            delta_signal = max(-5.0, min(5.0, delta_signal))
        else:
            mean_delta = None
            delta_signal = 0.0

        # Adherence signal (bounded [-1.5, +1.0])
        if followed > 0 and not_followed == 0:
            adherence_signal = min(1.0, 0.5 * followed)
        elif not_followed > 0 and followed == 0:
            adherence_signal = max(-1.5, -0.5 * not_followed)
        elif followed > not_followed:
            adherence_signal = 0.5
        elif not_followed > followed:
            adherence_signal = -0.5
        else:
            adherence_signal = 0.0

        total_adjustment = max(-6.0, min(6.0, delta_signal + adherence_signal))

        if mean_delta is not None:
            if mean_delta > 1.0:
                rating = "positive"
            elif mean_delta < -1.0:
                rating = "negative"
            else:
                rating = "neutral"
        elif followed > not_followed:
            rating = "positive"
        elif not_followed > followed:
            rating = "negative"
        else:
            rating = "unmeasured"

        signals[rtype] = {
            "total_issued": stats["total_issued"],
            "times_followed": followed,
            "times_not_followed": not_followed,
            "measured_count": n_deltas,
            "average_delta": round(mean_delta, 1) if mean_delta is not None else None,
            "delta_signal": round(delta_signal, 2),
            "adherence_signal": round(adherence_signal, 2),
            "adjustment": round(total_adjustment, 2),
            "effectiveness_rating": rating,
        }

    return signals


def select_adaptive_recommendation(
    persona: str,
    student_id: UUID,
    db: Session,
) -> tuple[Recommendation, float, bool, dict[str, Any]]:
    """Select the best recommendation candidate using the adaptive feedback loop.

    Returns (selected_recommendation, rank_score, is_adapted, signal_details).
    """
    signals = compute_student_recommendation_signals(student_id, db)
    candidate_weights = PERSONA_CANDIDATE_WEIGHTS.get(persona, {})
    default_rec_type = DEFAULT_PERSONA_RECOMMENDATION.get(
        persona, "SUSTAINED_FOCUS_BUILDING"
    )

    all_recommendations = list(
        db.scalars(
            select(Recommendation).where(Recommendation.is_active == True)  # noqa: E712
        ).all()
    )

    if not all_recommendations:
        all_recommendations = ensure_default_recommendation_catalog(db)

    if not all_recommendations:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No recommendation catalog entries available",
        )

    scored_candidates: list[tuple[float, float, str, Recommendation, dict[str, Any]]] = []

    for rec in all_recommendations:
        rtype = rec.recommendation_type
        base_score = candidate_weights.get(rtype, 4.0)
        signal_info = signals.get(rtype, {})
        adjustment = float(signal_info.get("adjustment", 0.0))
        final_score = base_score + adjustment

        # Store for sorting: (final_score, base_score, rtype, rec, signal_info)
        scored_candidates.append((final_score, base_score, rtype, rec, signal_info))

    # Sort descending by final_score, then base_score to keep default if tied
    scored_candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)

    best_score, best_base, best_rtype, best_rec, best_signal = scored_candidates[0]
    is_adapted = best_rtype != default_rec_type and len(signals) > 0

    return best_rec, best_score, is_adapted, best_signal


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

    # 4. Classify persona and select matching recommendation type using adaptive feedback loop
    persona = evaluate_behavioural_persona(analysis)
    default_rec_type = DEFAULT_PERSONA_RECOMMENDATION.get(
        persona, "SUSTAINED_FOCUS_BUILDING"
    )

    recommendation, rank_score, is_adapted, signal_info = (
        select_adaptive_recommendation(persona, student_id, db)
    )

    # 5. Build detailed selection reason and selection context snapshot
    if is_adapted:
        adj = signal_info.get("adjustment", 0.0)
        sign = "+" if adj >= 0 else ""
        selection_reason = (
            f"Selected {recommendation.title} for persona '{persona}' via adaptive feedback: "
            f"past outcomes demonstrated higher effectiveness (effectiveness signal {sign}{adj} pts) "
            f"over default {default_rec_type}."
        )
        selector_version = "v1.1-adaptive"
    else:
        selection_reason = (
            f"Selected {recommendation.title} for persona '{persona}' based on focus score "
            f"{analysis.focus_score} and distraction level '{analysis.distraction_level}'."
        )
        selector_version = "v1.0"

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
        "adaptive_feedback": {
            "is_adapted": is_adapted,
            "selected_recommendation_type": recommendation.recommendation_type,
            "default_recommendation_type": default_rec_type,
            "rank_score": round(rank_score, 2),
            "measured_outcomes_count": signal_info.get("measured_count", 0),
            "score_adjustment": signal_info.get("adjustment", 0.0),
        },
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
        selector_version=selector_version,
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
    """Retrieve chronological history of recommendation events for a student.

    If no events exist, automatically processes un-recommended completed sessions
    that have telemetry. If student has no completed sessions, delivers a transparent
    onboarding recommendation baseline.
    """
    ensure_default_recommendation_catalog(db)

    # 1. Backfill recommendations for any completed sessions with telemetry
    existing_sess_ids = set(
        db.scalars(
            select(RecommendationEvent.source_session_id).where(
                RecommendationEvent.student_id == student_id
            )
        ).all()
    )

    unrecommended_sessions = db.scalars(
        select(StudySession)
        .where(
            StudySession.student_id == student_id,
            StudySession.status == "completed",
        )
        .order_by(StudySession.started_at.desc())
    ).all()

    for sess in unrecommended_sessions:
        if sess.id not in existing_sess_ids:
            acts = db.scalars(
                select(StudyActivity).where(StudyActivity.study_session_id == sess.id)
            ).all()
            dur = sum(float(a.numeric_value or 0.0) for a in acts)
            if len(acts) > 0 and dur > 0.0:
                try:
                    generate_student_recommendation(student_id, sess.id, db)
                    existing_sess_ids.add(sess.id)
                except Exception:
                    pass

    # 2. Query persisted events
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
            "outcome_id": outcome.id if outcome else None,
            "outcome_status": outcome.outcome_status if outcome else "unmeasured",
            "recommendation_followed": outcome.recommendation_followed if outcome else None,
            "next_session_id": outcome.next_session_id if outcome else None,
            "next_focus_score": outcome.next_focus_score if outcome else None,
            "delta_focus_next_session": outcome.delta_focus_next_session if outcome else None,
            "measured_at": outcome.measured_at if outcome else None,
            "notes": outcome.notes if outcome else None,
        }
        results.append(item)

    return results


def get_latest_student_recommendation(
    student_id: UUID, db: Session
) -> dict[str, Any] | None:
    """Return the most recent recommendation event generated for the student."""
    history = get_student_recommendation_history(student_id, db, limit=1)
    return history[0] if history else None


def record_recommendation_outcome(
    student_id: UUID,
    event_id: UUID,
    recommendation_followed: bool | None = None,
    next_session_id: UUID | None = None,
    next_focus_score: float | None = None,
    delta_focus_next_session: float | None = None,
    outcome_status: str | None = None,
    notes: str | None = None,
    db: Session = None,
) -> RecommendationOutcome:
    """Record or update an intervention outcome for an issued recommendation event.

    Idempotent: Updates existing outcome if present rather than creating duplicates.
    Automatic Next Session Selection: Selects ONLY the immediate next completed session
    (ORDER BY started_at ASC LIMIT 1) without skipping unanalyzed sessions.
    """
    # 1. Verify recommendation event exists and belongs to student
    event = db.scalar(
        select(RecommendationEvent).where(
            RecommendationEvent.id == event_id,
            RecommendationEvent.student_id == student_id,
        )
    )
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation event not found for this student",
        )

    # 2. Retrieve source study session
    source_session = db.get(StudySession, event.source_session_id)
    if not source_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source study session not found",
        )

    # 3. Determine target next_session
    target_next_session: StudySession | None = None

    if next_session_id:
        # Explicit next_session_id provided
        target_next_session = db.scalar(
            select(StudySession).where(
                StudySession.id == next_session_id,
                StudySession.student_id == student_id,
            )
        )
        if not target_next_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Next study session not found for this student",
            )
        # Chronological validation
        if source_session.started_at and target_next_session.started_at:
            if target_next_session.started_at <= source_session.started_at:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Next study session must occur after recommendation source session",
                )
    else:
        # Automatic selection: IMMEDIATE next completed session ONLY
        target_next_session = db.scalar(
            select(StudySession)
            .where(
                StudySession.student_id == student_id,
                StudySession.started_at > source_session.started_at,
                StudySession.status == "completed",
            )
            .order_by(StudySession.started_at.asc())
            .limit(1)
        )

    # 4. Evaluate ML focus scores & delta_focus_next_session
    source_analysis = db.scalar(
        select(BehaviouralAnalysis).where(
            BehaviouralAnalysis.study_session_id == source_session.id
        )
    )
    source_focus = source_analysis.focus_score if source_analysis else None

    computed_next_focus = next_focus_score
    computed_delta_focus = delta_focus_next_session
    final_status = outcome_status or "pending"

    if target_next_session:
        next_analysis = db.scalar(
            select(BehaviouralAnalysis).where(
                BehaviouralAnalysis.study_session_id == target_next_session.id
            )
        )
        if next_analysis and next_analysis.focus_score is not None and source_focus is not None:
            if computed_next_focus is None:
                computed_next_focus = next_analysis.focus_score
            if computed_delta_focus is None:
                computed_delta_focus = round(float(computed_next_focus - source_focus), 1)
            final_status = "measured"

    if computed_delta_focus is not None or computed_next_focus is not None:
        if outcome_status is not None:
            final_status = outcome_status
        elif computed_delta_focus is not None:
            final_status = "measured"

    # 5. Idempotent Create / Update
    outcome = db.scalar(
        select(RecommendationOutcome).where(
            RecommendationOutcome.recommendation_event_id == event_id
        )
    )

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    if outcome:
        if recommendation_followed is not None:
            outcome.recommendation_followed = recommendation_followed
        if target_next_session:
            outcome.next_session_id = target_next_session.id
        if computed_next_focus is not None:
            outcome.next_focus_score = computed_next_focus
        if computed_delta_focus is not None:
            outcome.delta_focus_next_session = computed_delta_focus
        if final_status:
            outcome.outcome_status = final_status
        outcome.measured_at = now
        if notes is not None:
            outcome.notes = notes
        db.commit()
        db.refresh(outcome)
        return outcome

    outcome = RecommendationOutcome(
        id=uuid.uuid4(),
        recommendation_event_id=event_id,
        recommendation_followed=recommendation_followed,
        next_session_id=target_next_session.id if target_next_session else None,
        measured_at=now,
        next_focus_score=computed_next_focus,
        delta_focus_next_session=computed_delta_focus,
        outcome_status=final_status,
        notes=notes,
    )
    db.add(outcome)
    db.commit()
    db.refresh(outcome)
    return outcome


def evaluate_pending_outcomes_for_session(
    student_id: UUID, new_session_id: UUID, db: Session
) -> int:
    """When a new study session completes with focus analysis, evaluate any prior pending outcomes.

    Strictly measures focus deltas across consecutive sessions with valid analysis.
    Never invents or fabricates focus scores. Returns count of evaluated outcomes.
    """
    new_session = db.get(StudySession, new_session_id)
    if not new_session or not new_session.started_at:
        return 0

    new_analysis = db.scalar(
        select(BehaviouralAnalysis).where(
            BehaviouralAnalysis.study_session_id == new_session_id
        )
    )
    if not new_analysis or new_analysis.focus_score is None:
        return 0

    # Find pending outcomes for student recommendations whose source session started before new_session
    pending_outcomes = db.scalars(
        select(RecommendationOutcome)
        .join(RecommendationEvent, RecommendationOutcome.recommendation_event_id == RecommendationEvent.id)
        .where(
            RecommendationEvent.student_id == student_id,
            RecommendationOutcome.outcome_status == "pending",
            RecommendationOutcome.next_session_id.is_(None),
        )
    ).all()

    evaluated_count = 0
    now = datetime.now(timezone.utc)

    for outcome in pending_outcomes:
        event = db.get(RecommendationEvent, outcome.recommendation_event_id)
        if not event or not event.source_session_id:
            continue

        source_session = db.get(StudySession, event.source_session_id)
        if not source_session or not source_session.started_at:
            continue

        if source_session.started_at >= new_session.started_at:
            continue

        # Check if there is any other completed session between source_session and new_session
        intermediate = db.scalar(
            select(StudySession.id).where(
                StudySession.student_id == student_id,
                StudySession.started_at > source_session.started_at,
                StudySession.started_at < new_session.started_at,
                StudySession.status == "completed",
            ).limit(1)
        )
        if intermediate:
            continue  # Must be the immediate next completed session

        source_analysis = db.scalar(
            select(BehaviouralAnalysis).where(
                BehaviouralAnalysis.study_session_id == source_session.id
            )
        )
        if not source_analysis or source_analysis.focus_score is None:
            continue

        outcome.next_session_id = new_session.id
        outcome.next_focus_score = new_analysis.focus_score
        outcome.delta_focus_next_session = round(
            float(new_analysis.focus_score - source_analysis.focus_score), 1
        )
        outcome.outcome_status = "measured"
        outcome.measured_at = now
        evaluated_count += 1

    if evaluated_count > 0:
        db.commit()

    return evaluated_count


def get_student_recommendations_effectiveness(
    student_id: UUID, db: Session
) -> dict[str, Any]:
    """Retrieve aggregated empirical effectiveness signals across recommendations for a student."""
    signals = compute_student_recommendation_signals(student_id, db)
    catalog = list(
        db.scalars(
            select(Recommendation).where(Recommendation.is_active == True)  # noqa: E712
        ).all()
    )
    if not catalog:
        catalog = ensure_default_recommendation_catalog(db)

    type_breakdown = []
    total_issued = 0
    total_outcomes = 0
    total_measured_deltas = 0
    all_deltas: list[float] = []
    positive_count = 0
    followed_count = 0

    for rec in catalog:
        rtype = rec.recommendation_type
        sig = signals.get(rtype, {})
        issued = sig.get("total_issued", 0)
        fol = sig.get("times_followed", 0)
        nfol = sig.get("times_not_followed", 0)
        m_count = sig.get("measured_count", 0)
        avg_d = sig.get("average_delta")
        rating = sig.get("effectiveness_rating", "unmeasured")
        adj = sig.get("adjustment", 0.0)

        total_issued += issued
        total_outcomes += fol + nfol
        total_measured_deltas += m_count
        followed_count += fol
        if avg_d is not None and avg_d > 0:
            positive_count += 1

        type_breakdown.append(
            {
                "recommendation_type": rtype,
                "title": rec.title,
                "total_issued": issued,
                "times_followed": fol,
                "times_not_followed": nfol,
                "measured_outcomes_count": m_count,
                "average_focus_delta": avg_d,
                "effectiveness_rating": rating,
                "score_adjustment": adj,
            }
        )

    all_events = list(
        db.scalars(
            select(RecommendationEvent)
            .options(joinedload(RecommendationEvent.outcome))
            .where(RecommendationEvent.student_id == student_id)
        ).all()
    )

    for ev in all_events:
        if ev.outcome and ev.outcome.delta_focus_next_session is not None:
            all_deltas.append(float(ev.outcome.delta_focus_next_session))

    avg_overall_delta = (
        round(float(sum(all_deltas) / len(all_deltas)), 1) if all_deltas else None
    )
    adherence_rate = (
        round(float(followed_count / total_outcomes), 2) if total_outcomes > 0 else None
    )

    return {
        "student_id": student_id,
        "total_recommendations_issued": total_issued,
        "total_outcomes_recorded": total_outcomes,
        "total_measured_deltas": total_measured_deltas,
        "average_overall_focus_delta": avg_overall_delta,
        "positive_outcomes_count": positive_count,
        "adherence_rate": adherence_rate,
        "type_breakdown": type_breakdown,
    }




