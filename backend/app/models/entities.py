import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

JSON_TYPE = JSON().with_variant(JSONB, "postgresql")


class Timestamped:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Student(Timestamped, Base):
    __tablename__ = "students"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(200))
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    semester: Mapped[int | None] = mapped_column(Integer, nullable=True)
    academic_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timezone: Mapped[str] = mapped_column(String(100), default="UTC", server_default="UTC")

    subjects: Mapped[list["Subject"]] = relationship(back_populates="student")
    study_sessions: Mapped[list["StudySession"]] = relationship(back_populates="student")
    recommendation_events: Mapped[list["RecommendationEvent"]] = relationship(back_populates="student")


class Parent(Timestamped, Base):
    __tablename__ = "parents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(200))


class StudentParentLink(Timestamped, Base):
    __tablename__ = "student_parent_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    parent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("parents.id", ondelete="CASCADE"))
    consent_status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending")


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped[Student] = relationship(back_populates="subjects")
    quizzes: Mapped[list["Quiz"]] = relationship(back_populates="subject")


class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    subject_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("subjects.id", ondelete="SET NULL"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="planned", server_default="planned")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped[Student] = relationship(back_populates="study_sessions")
    subject: Mapped["Subject | None"] = relationship()
    activities: Mapped[list["StudyActivity"]] = relationship(back_populates="study_session")
    behavioural_analysis: Mapped["BehaviouralAnalysis | None"] = relationship(back_populates="study_session")


class StudyActivity(Base):
    __tablename__ = "study_activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    study_session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study_sessions.id", ondelete="CASCADE"))
    activity_type: Mapped[str] = mapped_column(String(100))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    numeric_value: Mapped[float | None] = mapped_column(Float)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON_TYPE, default=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    study_session: Mapped[StudySession] = relationship(back_populates="activities")


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    quiz_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    subject: Mapped[Subject] = relationship(back_populates="quizzes")
    performance_reports: Mapped[list["PerformanceReport"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan"
    )

    @property
    def score(self) -> float | None:
        if hasattr(self, "_score"):
            return self._score
        if self.performance_reports:
            for rep in self.performance_reports:
                if rep.score is not None:
                    return rep.score
        return None

    @property
    def max_score(self) -> float | None:
        if hasattr(self, "_max_score"):
            return self._max_score
        if self.performance_reports:
            for rep in self.performance_reports:
                if rep.max_score is not None:
                    return rep.max_score
        return None


class PerformanceReport(Base):
    __tablename__ = "performance_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    study_session_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("study_sessions.id", ondelete="SET NULL"))
    quiz_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("quizzes.id", ondelete="SET NULL"))
    score: Mapped[float | None] = mapped_column(Float)
    max_score: Mapped[float | None] = mapped_column(Float)
    performance_metric: Mapped[str] = mapped_column(String(100))
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON_TYPE, default=dict, server_default="{}"
    )

    quiz: Mapped[Quiz | None] = relationship(back_populates="performance_reports")
    study_session: Mapped[StudySession | None] = relationship()

    @property
    def subject_name(self) -> str | None:
        if self.quiz and self.quiz.subject:
            return self.quiz.subject.name
        if self.study_session and self.study_session.subject:
            return self.study_session.subject.name
        return None


class BehaviouralAnalysis(Base):
    __tablename__ = "behavioural_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    study_session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("study_sessions.id", ondelete="CASCADE"), unique=True
    )
    feature_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    focus_score: Mapped[float | None] = mapped_column(Float)
    distraction_level: Mapped[str | None] = mapped_column(String(50))
    performance_prediction: Mapped[float | None] = mapped_column(Float)
    shap_values: Mapped[dict[str, Any] | None] = mapped_column(JSON_TYPE)
    counterfactual_baseline: Mapped[dict[str, Any] | None] = mapped_column(JSON_TYPE)
    model_version: Mapped[str] = mapped_column(String(100))
    analyzed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    study_session: Mapped[StudySession] = relationship(back_populates="behavioural_analysis")

    @property
    def session_started_at(self) -> datetime | None:
        return self.study_session.started_at if self.study_session else None

    @property
    def subject_name(self) -> str | None:
        if self.study_session and self.study_session.subject:
            return self.study_session.subject.name
        return None


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recommendation_type: Mapped[str] = mapped_column(String(100), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RecommendationEvent(Base):
    __tablename__ = "recommendation_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    source_session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study_sessions.id", ondelete="CASCADE"))
    recommendation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("recommendations.id", ondelete="RESTRICT"))
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    selection_reason: Mapped[str | None] = mapped_column(Text)
    selector_version: Mapped[str] = mapped_column(String(100))
    behavioural_persona: Mapped[str | None] = mapped_column(String(100))
    selection_context: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE, default=dict, server_default="{}")

    student: Mapped[Student] = relationship(back_populates="recommendation_events")
    outcome: Mapped["RecommendationOutcome | None"] = relationship(back_populates="recommendation_event")


class RecommendationOutcome(Base):
    __tablename__ = "recommendation_outcomes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recommendation_event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("recommendation_events.id", ondelete="CASCADE"), unique=True
    )
    recommendation_followed: Mapped[bool | None] = mapped_column(Boolean)
    next_session_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("study_sessions.id", ondelete="SET NULL"))
    measured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_focus_score: Mapped[float | None] = mapped_column(Float)
    delta_focus_next_session: Mapped[float | None] = mapped_column(Float)
    outcome_status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending")
    notes: Mapped[str | None] = mapped_column(Text)

    recommendation_event: Mapped[RecommendationEvent] = relationship(back_populates="outcome")
