from datetime import datetime, timezone
import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    BehaviouralAnalysis,
    Parent,
    PerformanceReport,
    Quiz,
    RecommendationEvent,
    Student,
    StudentParentLink,
    StudySession,
    Subject,
)
from app.schemas.parent import (
    LinkedParentSummary,
    LinkedStudentSummary,
    ParentStudentProgressSummary,
    ParentSubjectSummary,
    StudentParentLinkCreate,
    StudentParentLinkConsentUpdate,
    StudentParentLinkUnlinkResponse,
)


def list_linked_students_for_parent(parent_id: uuid.UUID, db: Session) -> list[LinkedStudentSummary]:
    links = db.scalars(
        select(StudentParentLink)
        .where(StudentParentLink.parent_id == parent_id)
        .order_by(StudentParentLink.created_at.desc())
    ).all()

    results = []
    for link in links:
        student = db.scalar(select(Student).where(Student.id == link.student_id))
        results.append(
            LinkedStudentSummary(
                id=link.id,
                link_id=link.id,
                student_id=link.student_id,
                student_name=student.display_name if student else None,
                display_name=student.display_name if student else None,
                department=student.department if student else None,
                semester=student.semester if student else None,
                academic_year=student.academic_year if student else None,
                consent_status=link.consent_status,
                created_at=link.created_at,
                updated_at=link.updated_at,
            )
        )
    return results


def link_student_to_parent(
    parent_id: uuid.UUID, data: StudentParentLinkCreate, db: Session
) -> LinkedStudentSummary:
    # Verify student exists
    student = db.scalar(select(Student).where(Student.id == data.student_id))
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found with provided ID",
        )

    # Check if link already exists
    existing = db.scalar(
        select(StudentParentLink).where(
            StudentParentLink.parent_id == parent_id,
            StudentParentLink.student_id == data.student_id,
        )
    )
    if existing:
        return LinkedStudentSummary(
            id=existing.id,
            link_id=existing.id,
            student_id=existing.student_id,
            student_name=student.display_name,
            display_name=student.display_name,
            department=student.department,
            semester=student.semester,
            academic_year=student.academic_year,
            consent_status=existing.consent_status,
            created_at=existing.created_at,
            updated_at=existing.updated_at,
        )

    new_link = StudentParentLink(
        id=uuid.uuid4(),
        parent_id=parent_id,
        student_id=data.student_id,
        consent_status="pending",
    )
    db.add(new_link)
    db.commit()
    db.refresh(new_link)

    return LinkedStudentSummary(
        id=new_link.id,
        link_id=new_link.id,
        student_id=new_link.student_id,
        student_name=student.display_name,
        display_name=student.display_name,
        department=student.department,
        semester=student.semester,
        academic_year=student.academic_year,
        consent_status=new_link.consent_status,
        created_at=new_link.created_at,
        updated_at=new_link.updated_at,
    )


def get_parent_student_progress(
    parent_id: uuid.UUID, student_id: uuid.UUID, db: Session
) -> ParentStudentProgressSummary:
    # STRICT AUTH & CONSENT CHECK
    link = db.scalar(
        select(StudentParentLink).where(
            StudentParentLink.parent_id == parent_id,
            StudentParentLink.student_id == student_id,
        )
    )
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not linked to this parent account",
        )

    if link.consent_status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Parent access restricted: Student consent is currently '{link.consent_status}'",
        )

    student = db.scalar(select(Student).where(Student.id == student_id))
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found",
        )

    # Calculate real student progress summary
    sessions = db.scalars(
        select(StudySession)
        .where(StudySession.student_id == student_id)
        .order_by(StudySession.started_at.desc())
    ).all()

    total_sessions = len(sessions)
    completed_sessions = [s for s in sessions if s.status == "completed"]

    total_duration_minutes = 0.0
    for s in sessions:
        if s.ended_at and s.started_at and s.ended_at >= s.started_at:
            total_duration_minutes += (s.ended_at - s.started_at).total_seconds() / 60.0

    # Fetch behavioural analyses for completed sessions
    session_ids = [s.id for s in sessions]
    analyses = []
    if session_ids:
        analyses = db.scalars(
            select(BehaviouralAnalysis)
            .where(BehaviouralAnalysis.study_session_id.in_(session_ids))
            .order_by(BehaviouralAnalysis.analyzed_at.desc())
        ).all()

    focus_scores = [a.focus_score for a in analyses if a.focus_score is not None]
    avg_focus = round(sum(focus_scores) / len(focus_scores), 1) if focus_scores else None
    latest_distraction = analyses[0].distraction_level if analyses else None

    # Recommendations
    recs = db.scalars(
        select(RecommendationEvent)
        .where(RecommendationEvent.student_id == student_id)
        .order_by(RecommendationEvent.issued_at.desc())
        .limit(5)
    ).all()

    recent_sessions_data = [
        {
            "id": str(s.id),
            "status": s.status,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
        }
        for s in sessions[:5]
    ]

    recent_analyses_data = [
        {
            "id": str(a.id),
            "session_id": str(a.study_session_id),
            "focus_score": a.focus_score,
            "distraction_level": a.distraction_level,
            "performance_prediction": a.performance_prediction,
            "analyzed_at": a.analyzed_at.isoformat() if a.analyzed_at else None,
        }
        for a in analyses[:5]
    ]

    recent_recs_data = [
        {
            "id": str(r.id),
            "issued_at": r.issued_at.isoformat() if r.issued_at else None,
            "persona": r.behavioural_persona,
            "reason": r.selection_reason,
        }
        for r in recs
    ]

    # Subject-level performance summaries
    subjects = db.scalars(select(Subject).where(Subject.student_id == student_id)).all()
    subject_summaries: list[ParentSubjectSummary] = []
    for subj in subjects:
        subj_sessions = [s for s in sessions if s.subject_id == subj.id]
        subj_mins = 0
        for ss in subj_sessions:
            if ss.ended_at and ss.started_at and ss.ended_at >= ss.started_at:
                subj_mins += int((ss.ended_at - ss.started_at).total_seconds() / 60)

        subj_sess_ids = {ss.id for ss in subj_sessions}
        subj_focus = [
            a.focus_score
            for a in analyses
            if a.study_session_id in subj_sess_ids and a.focus_score is not None
        ]
        subj_avg_focus = (
            round(sum(subj_focus) / len(subj_focus), 1) if subj_focus else None
        )

        subj_quizzes = db.scalars(select(Quiz).where(Quiz.subject_id == subj.id)).all()
        q_ids = [q.id for q in subj_quizzes]
        avg_quiz = None
        if q_ids:
            reps = db.scalars(
                select(PerformanceReport).where(
                    PerformanceReport.student_id == student_id,
                    PerformanceReport.quiz_id.in_(q_ids),
                )
            ).all()
            q_scores = [r.score for r in reps if r.score is not None]
            if q_scores:
                avg_quiz = round(sum(q_scores) / len(q_scores), 1)

        subject_summaries.append(
            ParentSubjectSummary(
                subject_id=subj.id,
                subject_name=subj.name,
                total_study_minutes=subj_mins,
                total_sessions=len(subj_sessions),
                average_focus_score=subj_avg_focus,
                average_quiz_score=avg_quiz,
            )
        )

    return ParentStudentProgressSummary(
        student_id=student.id,
        display_name=student.display_name,
        consent_status=link.consent_status,
        total_study_sessions=total_sessions,
        completed_study_sessions=len(completed_sessions),
        total_study_duration_minutes=round(total_duration_minutes, 1),
        average_focus_score=avg_focus,
        latest_distraction_level=latest_distraction,
        recent_sessions=recent_sessions_data,
        recent_behaviour_analyses=recent_analyses_data,
        recent_recommendations=recent_recs_data,
        subject_summaries=subject_summaries,
    )


# Student-facing consent management
def list_linked_parents_for_student(student_id: uuid.UUID, db: Session) -> list[LinkedParentSummary]:
    links = db.scalars(
        select(StudentParentLink)
        .where(StudentParentLink.student_id == student_id)
        .order_by(StudentParentLink.created_at.desc())
    ).all()

    results = []
    for link in links:
        parent = db.scalar(select(Parent).where(Parent.id == link.parent_id))
        pname = parent.display_name if parent else None
        results.append(
            LinkedParentSummary(
                id=link.id,
                link_id=link.id,
                parent_id=link.parent_id,
                parent_name=pname,
                display_name=pname,
                consent_status=link.consent_status,
                created_at=link.created_at,
                updated_at=link.updated_at,
            )
        )
    return results


def update_parent_consent_by_student(
    student_id: uuid.UUID,
    link_id: uuid.UUID,
    data: StudentParentLinkConsentUpdate,
    db: Session,
) -> LinkedParentSummary:
    link = db.scalar(
        select(StudentParentLink).where(
            StudentParentLink.id == link_id,
            StudentParentLink.student_id == student_id,
        )
    )
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student-Parent link record not found",
        )

    link.consent_status = data.consent_status
    link.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(link)

    parent = db.scalar(select(Parent).where(Parent.id == link.parent_id))
    pname = parent.display_name if parent else None
    return LinkedParentSummary(
        id=link.id,
        link_id=link.id,
        parent_id=link.parent_id,
        parent_name=pname,
        display_name=pname,
        consent_status=link.consent_status,
        created_at=link.created_at,
        updated_at=link.updated_at,
    )


def unlink_student_for_parent(
    parent_id: uuid.UUID, student_id: uuid.UUID, db: Session
) -> StudentParentLinkUnlinkResponse:
    link = db.scalar(
        select(StudentParentLink).where(
            StudentParentLink.parent_id == parent_id,
            StudentParentLink.student_id == student_id,
        )
    )
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not linked to this parent account",
        )
    db.delete(link)
    db.commit()
    return StudentParentLinkUnlinkResponse(
        success=True, message="Student unlinked successfully from parent account"
    )


def unlink_parent_for_student(
    student_id: uuid.UUID, link_id: uuid.UUID, db: Session
) -> StudentParentLinkUnlinkResponse:
    link = db.scalar(
        select(StudentParentLink).where(
            StudentParentLink.id == link_id,
            StudentParentLink.student_id == student_id,
        )
    )
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student-Parent link record not found",
        )
    db.delete(link)
    db.commit()
    return StudentParentLinkUnlinkResponse(
        success=True, message="Parent link removed successfully by student"
    )


