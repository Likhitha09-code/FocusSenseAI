import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.entities import Parent, Student
from app.services import supabase

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def student_a(db_session: Session) -> tuple[Student, uuid.UUID]:
    auth_id = uuid.uuid4()
    student = Student(
        id=uuid.uuid4(),
        auth_user_id=auth_id,
        display_name="Student A",
        department="CSE",
        semester=6,
        academic_year=3,
    )
    db_session.add(student)
    db_session.commit()
    db_session.refresh(student)
    return student, auth_id


@pytest.fixture
def student_b(db_session: Session) -> tuple[Student, uuid.UUID]:
    auth_id = uuid.uuid4()
    student = Student(
        id=uuid.uuid4(),
        auth_user_id=auth_id,
        display_name="Student B",
        department="ECE",
        semester=4,
        academic_year=2,
    )
    db_session.add(student)
    db_session.commit()
    db_session.refresh(student)
    return student, auth_id


@pytest.fixture
def parent_user(db_session: Session) -> tuple[Parent, uuid.UUID]:
    auth_id = uuid.uuid4()
    parent = Parent(
        id=uuid.uuid4(),
        auth_user_id=auth_id,
        display_name="Parent User",
    )
    db_session.add(parent)
    db_session.commit()
    db_session.refresh(parent)
    return parent, auth_id


def setup_token_mock(monkeypatch: pytest.MonkeyPatch, auth_id: uuid.UUID, email: str = "user@test.com"):
    def mock_verify(token: str):
        return {"id": str(auth_id), "email": email}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify)
