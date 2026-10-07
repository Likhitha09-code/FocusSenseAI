from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


def get_session_factory() -> sessionmaker[Session]:
	"""Create a session factory only when a database URL is configured."""
	if not settings.database_url:
		raise RuntimeError("DATABASE_URL must be configured before opening a database session")

	engine = create_engine(settings.database_url, pool_pre_ping=True)
	return sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
	session = get_session_factory()()
	try:
		yield session
	finally:
		session.close()