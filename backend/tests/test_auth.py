import uuid
from collections.abc import Generator

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth import UserRole
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.entities import Parent, Student
from app.services import supabase

# SQLite in-memory engine for test isolation
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_database():
    """Create all tables before each test and drop them after."""
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


def test_health_check(client: TestClient):
    response = client.get("/health")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok", "service": "focussense-api"}


def test_auth_me_missing_token_returns_401(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "detail" in response.json()


def test_auth_me_invalid_token_returns_401(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    def mock_verify_access_token(token: str):
        raise supabase.SupabaseConfigurationError("Invalid token")

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_access_token)

    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer bad-token"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_auth_me_unknown_profile_returns_401(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    unknown_uuid = uuid.uuid4()

    def mock_verify_access_token(token: str):
        return {"id": str(unknown_uuid), "email": "unknown@example.com"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_access_token)

    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer valid-token"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Application profile not found" in response.json()["detail"]


def test_student_profile_resolution(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
):
    student_auth_id = uuid.uuid4()
    student = Student(
        id=uuid.uuid4(),
        auth_user_id=student_auth_id,
        display_name="Alice Student",
        department="Computer Science",
        semester=6,
        academic_year=3,
    )
    db_session.add(student)
    db_session.commit()

    def mock_verify_access_token(token: str):
        return {"id": str(student_auth_id), "email": "alice@university.edu"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_access_token)

    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer student-token"})
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["auth_user_id"] == str(student_auth_id)
    assert data["role"] == UserRole.STUDENT
    assert data["student_id"] == str(student.id)
    assert data["parent_id"] is None
    assert data["name"] == "Alice Student"
    assert data["email"] == "alice@university.edu"
    assert data["department"] == "Computer Science"
    assert data["semester"] == 6
    assert data["academic_year"] == 3


def test_parent_profile_resolution(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
):
    parent_auth_id = uuid.uuid4()
    parent = Parent(
        id=uuid.uuid4(),
        auth_user_id=parent_auth_id,
        display_name="Bob Parent",
    )
    db_session.add(parent)
    db_session.commit()

    def mock_verify_access_token(token: str):
        return {"id": str(parent_auth_id), "email": "bob@family.org"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_access_token)

    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer parent-token"})
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["auth_user_id"] == str(parent_auth_id)
    assert data["role"] == UserRole.PARENT
    assert data["parent_id"] == str(parent.id)
    assert data["student_id"] is None
    assert data["name"] == "Bob Parent"
    assert data["email"] == "bob@family.org"


def test_ambiguous_profile_rejection(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
):
    shared_auth_id = uuid.uuid4()
    student = Student(id=uuid.uuid4(), auth_user_id=shared_auth_id, display_name="Dual Identity")
    parent = Parent(id=uuid.uuid4(), auth_user_id=shared_auth_id, display_name="Dual Identity")
    db_session.add_all([student, parent])
    db_session.commit()

    def mock_verify_access_token(token: str):
        return {"id": str(shared_auth_id), "email": "dual@example.com"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_access_token)

    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer dual-token"})
    assert response.status_code == status.HTTP_409_CONFLICT
    assert "Ambiguous application profile" in response.json()["detail"]


def test_student_role_protection(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
):
    student_auth_id = uuid.uuid4()
    parent_auth_id = uuid.uuid4()

    student = Student(id=uuid.uuid4(), auth_user_id=student_auth_id, display_name="Student User")
    parent = Parent(id=uuid.uuid4(), auth_user_id=parent_auth_id, display_name="Parent User")
    db_session.add_all([student, parent])
    db_session.commit()

    def mock_verify_access_token(token: str):
        if token == "student-token":
            return {"id": str(student_auth_id), "email": "student@example.com"}
        return {"id": str(parent_auth_id), "email": "parent@example.com"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_access_token)

    # Student accessing student-test: 200 OK
    resp_student = client.get(
        "/api/v1/auth/student-test", headers={"Authorization": "Bearer student-token"}
    )
    assert resp_student.status_code == status.HTTP_200_OK
    assert resp_student.json()["message"] == "Student access verified"

    # Parent accessing student-test: 403 Forbidden
    resp_parent = client.get(
        "/api/v1/auth/student-test", headers={"Authorization": "Bearer parent-token"}
    )
    assert resp_parent.status_code == status.HTTP_403_FORBIDDEN


def test_parent_role_protection(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
):
    student_auth_id = uuid.uuid4()
    parent_auth_id = uuid.uuid4()

    student = Student(id=uuid.uuid4(), auth_user_id=student_auth_id, display_name="Student User")
    parent = Parent(id=uuid.uuid4(), auth_user_id=parent_auth_id, display_name="Parent User")
    db_session.add_all([student, parent])
    db_session.commit()

    def mock_verify_access_token(token: str):
        if token == "parent-token":
            return {"id": str(parent_auth_id), "email": "parent@example.com"}
        return {"id": str(student_auth_id), "email": "student@example.com"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_access_token)

    # Parent accessing parent-test: 200 OK
    resp_parent = client.get(
        "/api/v1/auth/parent-test", headers={"Authorization": "Bearer parent-token"}
    )
    assert resp_parent.status_code == status.HTTP_200_OK
    assert resp_parent.json()["message"] == "Parent access verified"

    # Student accessing parent-test: 403 Forbidden
    resp_student = client.get(
        "/api/v1/auth/parent-test", headers={"Authorization": "Bearer student-token"}
    )
    assert resp_student.status_code == status.HTTP_403_FORBIDDEN


def test_provision_student_profile(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
):
    new_auth_id = uuid.uuid4()

    def mock_verify_access_token(token: str):
        return {"id": str(new_auth_id), "email": "newstudent@example.com"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_access_token)

    payload = {
        "name": "Jane Doe",
        "department": "Electrical Engineering",
        "semester": 4,
        "academic_year": 2,
    }

    # First provisioning: 201 Created
    response = client.post(
        "/api/v1/auth/provision/student",
        json=payload,
        headers={"Authorization": "Bearer new-token"},
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["role"] == UserRole.STUDENT
    assert data["auth_user_id"] == str(new_auth_id)
    assert data["name"] == "Jane Doe"
    assert data["student_id"] is not None

    # Duplicate provisioning attempt: 409 Conflict
    dup_response = client.post(
        "/api/v1/auth/provision/student",
        json=payload,
        headers={"Authorization": "Bearer new-token"},
    )
    assert dup_response.status_code == status.HTTP_409_CONFLICT


def test_provision_parent_profile(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
):
    new_auth_id = uuid.uuid4()

    def mock_verify_access_token(token: str):
        return {"id": str(new_auth_id), "email": "newparent@example.com"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_access_token)

    payload = {"name": "Robert Doe"}

    # First provisioning: 201 Created
    response = client.post(
        "/api/v1/auth/provision/parent",
        json=payload,
        headers={"Authorization": "Bearer parent-token"},
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["role"] == UserRole.PARENT
    assert data["auth_user_id"] == str(new_auth_id)
    assert data["name"] == "Robert Doe"
    assert data["parent_id"] is not None

    # Duplicate provisioning attempt: 409 Conflict
    dup_response = client.post(
        "/api/v1/auth/provision/parent",
        json=payload,
        headers={"Authorization": "Bearer parent-token"},
    )
    assert dup_response.status_code == status.HTTP_409_CONFLICT


def test_provision_student_validation(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    auth_id = uuid.uuid4()

    def mock_verify_access_token(token: str):
        return {"id": str(auth_id), "email": "test@example.com"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_access_token)

    # Empty name should fail validation (422)
    resp_empty_name = client.post(
        "/api/v1/auth/provision/student",
        json={"name": ""},
        headers={"Authorization": "Bearer token"},
    )
    assert resp_empty_name.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Invalid semester should fail validation (422)
    resp_bad_semester = client.post(
        "/api/v1/auth/provision/student",
        json={"name": "Valid Name", "semester": 99},
        headers={"Authorization": "Bearer token"},
    )
    assert resp_bad_semester.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_auto_provision_student_from_user_metadata_on_me_lookup(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
):
    auth_id = uuid.uuid4()

    def mock_verify_access_token(token: str):
        return {
            "id": str(auth_id),
            "email": "confirmed_student@university.edu",
            "user_metadata": {
                "role": "student",
                "name": "Maya Lin",
                "department": "Data Science",
                "semester": 5,
                "academic_year": 3,
            },
        }

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_access_token)

    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer valid-token"})
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["auth_user_id"] == str(auth_id)
    assert data["role"] == UserRole.STUDENT
    assert data["name"] == "Maya Lin"
    assert data["department"] == "Data Science"
    assert data["semester"] == 5
    assert data["academic_year"] == 3
    assert data["student_id"] is not None

    # Verify record was persisted in students table
    persisted = db_session.query(Student).filter(Student.auth_user_id == auth_id).one_or_none()
    assert persisted is not None
    assert persisted.display_name == "Maya Lin"


def test_auto_provision_parent_from_user_metadata_on_me_lookup(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
):
    auth_id = uuid.uuid4()

    def mock_verify_access_token(token: str):
        return {
            "id": str(auth_id),
            "email": "confirmed_parent@family.org",
            "user_metadata": {
                "role": "parent",
                "name": "David Lin",
            },
        }

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_access_token)

    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer valid-token"})
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["auth_user_id"] == str(auth_id)
    assert data["role"] == UserRole.PARENT
    assert data["name"] == "David Lin"
    assert data["parent_id"] is not None

    persisted = db_session.query(Parent).filter(Parent.auth_user_id == auth_id).one_or_none()
    assert persisted is not None
    assert persisted.display_name == "David Lin"


def test_cors_preflight_allows_frontend_origin(client: TestClient):
    response = client.options(
        "/api/v1/auth/me",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        },
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_supabase_and_database_url_normalization():
    from app.db.session import _normalize_postgres_url
    from app.services.supabase import _normalize_supabase_url

    assert (
        _normalize_supabase_url("https://example.supabase.co/rest/v1/")
        == "https://example.supabase.co"
    )
    assert (
        _normalize_supabase_url("https://example.supabase.co/")
        == "https://example.supabase.co"
    )
    assert (
        _normalize_postgres_url("postgresql://postgres:[YOUR-PASSWORD]@db.example.supabase.co:5432/postgres")
        is None
    )
    normalized_pg = _normalize_postgres_url(
        "postgresql://postgres:secret123@db.example.supabase.co:5432/postgres"
    )
    assert normalized_pg is not None
    assert normalized_pg.startswith("postgresql+psycopg://")


def test_session_factory_fails_closed_without_silent_fallback():
    from app.db.session import _cached_session_factory

    # Placeholder password raises clear RuntimeError
    with pytest.raises(RuntimeError, match="unreplaced placeholder password"):
        _cached_session_factory("postgresql://postgres:[YOUR-PASSWORD]@db.example.supabase.co:5432/postgres")

    # Unreachable postgresql URL raises clear RuntimeError instead of silently using SQLite
    with pytest.raises(RuntimeError, match="Configured PostgreSQL database is unreachable or misconfigured"):
        _cached_session_factory("postgresql://postgres:secret@127.0.0.1:59999/nonexistent_db")

    # Explicit SQLite URL works as expected
    factory = _cached_session_factory("sqlite:///:memory:")
    assert factory is not None


def test_database_configuration_error_returns_503_json_with_cors(monkeypatch: pytest.MonkeyPatch):
    from app.db.session import DatabaseConfigurationError

    def broken_get_db():
        raise DatabaseConfigurationError(
            "DATABASE_URL contains an unreplaced placeholder password ('[YOUR-PASSWORD]'). "
            "Please configure valid PostgreSQL credentials in backend/.env before running."
        )

    def mock_verify_access_token(token: str):
        return {"id": str(uuid.uuid4()), "email": "student@example.com"}

    monkeypatch.setattr(supabase, "verify_access_token", mock_verify_access_token)
    app.dependency_overrides[get_db] = broken_get_db
    try:
        with TestClient(app, raise_server_exceptions=False) as raw_client:
            response = raw_client.get(
                "/api/v1/auth/me",
                headers={
                    "Authorization": "Bearer valid-token",
                    "Origin": "http://localhost:5173",
                },
            )
            assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
            assert "unreplaced placeholder password" in response.json()["detail"]
            assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    finally:
        app.dependency_overrides.clear()





