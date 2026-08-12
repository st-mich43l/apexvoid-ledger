import os

# Must be set before importing anything that touches app.database / app.main,
# since both read these from the environment at import time.
os.environ.setdefault("DATABASE_URL", "postgresql://unused:unused@localhost/unused")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

from typing import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import hash_password
from app.database import Base, get_db
from app.main import app
from app.models import User

DEFAULT_PASSWORD = "hunter22222"


@pytest.fixture()
def db_session():
    # In-memory SQLite, isolated per test - never touches the real Postgres
    # database (which the dev/prod app instances actually use).
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client_factory(db_session: Session) -> Callable[[], TestClient]:
    """Each call returns a fresh TestClient (its own cookie jar) sharing the
    same in-memory database, so tests can hold two independently-authenticated
    sessions (e.g. to check that one user can't see another's data)."""

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    clients: list[TestClient] = []

    def make() -> TestClient:
        c = TestClient(app)
        clients.append(c)
        return c

    yield make

    app.dependency_overrides.clear()


@pytest.fixture()
def client(client_factory: Callable[[], TestClient]) -> TestClient:
    return client_factory()


def _make_user(db_session: Session, username: str, is_admin: bool = False) -> User:
    user = User(
        username=username,
        hashed_password=hash_password(DEFAULT_PASSWORD),
        is_admin=is_admin,
        must_change_password=False,
        preferred_currency="USD",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def user(db_session: Session) -> User:
    return _make_user(db_session, "alice")


@pytest.fixture()
def other_user(db_session: Session) -> User:
    return _make_user(db_session, "bob")


def _login(client: TestClient, username: str) -> TestClient:
    res = client.post("/api/auth/login", json={"username": username, "password": DEFAULT_PASSWORD})
    assert res.status_code == 200
    return client


@pytest.fixture()
def auth_client(client_factory: Callable[[], TestClient], user: User) -> TestClient:
    return _login(client_factory(), user.username)


@pytest.fixture()
def other_auth_client(client_factory: Callable[[], TestClient], other_user: User) -> TestClient:
    return _login(client_factory(), other_user.username)
