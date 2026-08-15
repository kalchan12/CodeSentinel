"""Pytest configuration.

Integration tests run against a PostgreSQL/Redis pair; the engine unit
tests do not require any infrastructure. ``CODESENTINEL_*`` variables for
the test environment are forced here (before any app import) so a
developer's dev database is never touched.
"""

from __future__ import annotations

import os

import pytest

os.environ["CODESENTINEL_DATABASE_URL"] = os.environ.get(
    "CODESENTINEL_TEST_DATABASE_URL",
    "postgresql+psycopg://codesentinel:codesentinel@localhost:5432/codesentinel_test",
)
os.environ["CODESENTINEL_REDIS_URL"] = os.environ.get(
    "CODESENTINEL_TEST_REDIS_URL",
    "redis://localhost:6379/1",
)
os.environ["CODESENTINEL_DATA_DIR"] = "/tmp/codesentinel-test-data"


def _postgres_available() -> bool:
    try:
        import psycopg

        url = os.environ["CODESENTINEL_DATABASE_URL"].replace(
            "postgresql+psycopg://", "postgresql://"
        )
        with psycopg.connect(url, connect_timeout=2):
            return True
    except Exception:  # noqa: BLE001
        return False


def _redis_available() -> bool:
    try:
        import redis

        return bool(redis.from_url(os.environ["CODESENTINEL_REDIS_URL"], socket_timeout=2).ping())
    except Exception:  # noqa: BLE001
        return False


POSTGRES_AVAILABLE = _postgres_available()
REDIS_AVAILABLE = _redis_available()
INFRA_AVAILABLE = POSTGRES_AVAILABLE and REDIS_AVAILABLE

requires_infrastructure = pytest.mark.skipif(
    not INFRA_AVAILABLE,
    reason="requires PostgreSQL and Redis (docker compose up; see README)",
)


@pytest.fixture(scope="session")
def db_engine():
    """Engine with all tables created (containers provide the database)."""
    from app.db.base import Base
    from app.db.session import engine

    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)


@pytest.fixture
def clean_db(db_engine):
    """Truncate all tables before each test."""
    from app.db.base import Base

    with db_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


@pytest.fixture
async def client():
    """In-process ASGI test client for the FastAPI app."""
    from app.main import create_app
    from httpx import ASGITransport, AsyncClient

    transport = ASGITransport(app=create_app())
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


@pytest.fixture(scope="session")
def sample_project_dir(tmp_path_factory):
    """A small repo with known issues for the mock analyzer."""
    root = tmp_path_factory.mktemp("sample_project")
    (root / "app.py").write_text(
        "import os\n"
        'API_PASSWORD = "sup3r-secret-value"\n'
        'DB_TOKEN = "another-leak"\n'
        'result = eval(os.environ.get("QUERY", "1"))\n'
    )
    (root / "config.yml").write_text("debug: true\n")
    (root / "healthy.py").write_text("def f():\n    return 42\n")
    return root
