from collections.abc import Generator
from functools import lru_cache
import logging
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base
import app.models.entities  # noqa: F401 — ensure models are registered on Base.metadata

logger = logging.getLogger(__name__)

_LOCAL_SQLITE_PATH = Path(__file__).resolve().parents[2] / "focussense.db"
_REQUIRED_TABLES = {"students", "parents", "study_sessions", "behavioural_analyses"}


def _build_local_sqlite_engine():
    sqlite_url = f"sqlite:///{_LOCAL_SQLITE_PATH.as_posix()}"
    engine = create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
    return engine


class DatabaseConfigurationError(RuntimeError):
    """Raised when DATABASE_URL is missing, contains placeholders, or cannot connect."""


def _normalize_postgres_url(raw_url: str) -> str | None:
    cleaned = raw_url.strip()
    if not cleaned:
        return None
    upper = cleaned.upper()
    if "[YOUR-PASSWORD]" in upper or "[PASSWORD]" in upper or "YOUR-PASSWORD" in upper:
        return None

    if cleaned.startswith("postgres://"):
        cleaned = "postgresql+psycopg://" + cleaned[len("postgres://") :]
    elif cleaned.startswith("postgresql://"):
        cleaned = "postgresql+psycopg://" + cleaned[len("postgresql://") :]

    try:
        parsed = make_url(cleaned)
        if parsed.password and parsed.password.startswith("[") and parsed.password.endswith("]"):
            parsed = parsed.set(password=parsed.password[1:-1])
        return parsed.render_as_string(hide_password=False)
    except Exception:
        return cleaned


@lru_cache(maxsize=4)
def _cached_session_factory(raw_database_url: str) -> sessionmaker[Session]:
    cleaned = raw_database_url.strip()
    if not cleaned:
        raise DatabaseConfigurationError("DATABASE_URL must be configured before opening a database session")

    if cleaned.startswith("sqlite"):
        engine = create_engine(
            cleaned,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
        )
        return sessionmaker(bind=engine, autoflush=False, autocommit=False)

    upper = cleaned.upper()
    if "[YOUR-PASSWORD]" in upper or "[PASSWORD]" in upper or "YOUR-PASSWORD" in upper:
        raise DatabaseConfigurationError(
            "DATABASE_URL contains an unreplaced placeholder password ('[YOUR-PASSWORD]'). "
            "Please configure valid PostgreSQL credentials in backend/.env before running."
        )

    normalized = _normalize_postgres_url(cleaned)
    if not normalized:
        raise DatabaseConfigurationError(
            f"Invalid or unsupported DATABASE_URL scheme: {cleaned.split('://')[0] if '://' in cleaned else cleaned}"
        )

    try:
        connect_args = {"connect_timeout": 5} if normalized.startswith("postgresql") else {}
        engine = create_engine(normalized, pool_pre_ping=True, connect_args=connect_args)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return sessionmaker(bind=engine, autoflush=False, autocommit=False)
    except Exception as exc:
        err_msg = str(exc)
        if "@" in err_msg and "://" in err_msg:
            import re
            err_msg = re.sub(r"://([^:@]+):([^@]+)@", r"://\1:***@", err_msg)
        raise DatabaseConfigurationError(
            f"Configured PostgreSQL database is unreachable or misconfigured ({type(exc).__name__}: {err_msg}). "
            "Verify network access, credentials, and DATABASE_URL in backend/.env."
        ) from None


def get_session_factory() -> sessionmaker[Session]:
    """Create a session factory when a database URL is configured."""
    if not settings.database_url:
        raise DatabaseConfigurationError("DATABASE_URL must be configured before opening a database session")

    return _cached_session_factory(settings.database_url)


def get_db() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()