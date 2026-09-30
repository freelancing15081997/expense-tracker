"""
Pytest configuration and fixtures.

Environment contract
--------------------
Test environment variables are set BEFORE the `app` package is imported
(settings are read once at import time).

Database
--------
* Unit tests and API contract tests need **no database** — the ASGI transport
  never fires the lifespan hook, so the engine is never connected.
* Tests marked ``@pytest.mark.db`` use ``TEST_DATABASE_URL`` when it is set.
  If it is not set, the fixture probes the docker-compose Postgres
  (``postgresql+asyncpg://byjan:byjan@localhost:5432/byjan``) and runs against
  it when reachable; otherwise the test is skipped.
"""

import os
import socket
from typing import AsyncGenerator, Optional

# ---------------------------------------------------------------------------
# Test environment — must run before any `app.*` import.
# ---------------------------------------------------------------------------
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")
# shared/auth.py signs and verifies HS256 tokens with these extra settings.
os.environ.setdefault("JWT_PRIVATE_KEYS", "test-signing-key")
os.environ.setdefault("JWT_PUBLIC_KEYS", "test-signing-key")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://byjan:byjan@localhost:5432/byjan_test",
)
os.environ.setdefault("ALLOWED_ORIGINS", '["http://localhost:5173","http://testserver"]')

import pytest
import httpx

# pydantic-settings only picks up *declared* fields from env vars — extra keys
# (JWT_PRIVATE_KEYS / JWT_PUBLIC_KEYS) only arrive via a dotenv file. Patch the
# settings object directly so token signing works in tests.
from app.settings import settings as _settings

if not getattr(_settings, "JWT_PRIVATE_KEYS", None):
    _settings.JWT_PRIVATE_KEYS = "test-signing-key"
if not getattr(_settings, "JWT_PUBLIC_KEYS", None):
    _settings.JWT_PUBLIC_KEYS = "test-signing-key"

DEFAULT_TEST_DB_URL = "postgresql+asyncpg://byjan:byjan@localhost:5432/byjan"


# ---------------------------------------------------------------------------
# App + HTTP client
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def app():
    """The FastAPI application under test (imported after env is set)."""
    from app.main import app as fastapi_app

    return fastapi_app


@pytest.fixture
async def client(app) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Async HTTP client wired to the app via ASGI transport (no real socket)."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        yield client


# ---------------------------------------------------------------------------
# Tokens / principals
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def make_token():
    """Factory: build a signed access token for a synthetic Principal."""
    from app.shared.auth import create_access_token
    from app.platform.domain.models import Principal

    def _make(
        user_id: str = "user-test-1",
        tenant_id: Optional[str] = None,
        role_id: Optional[str] = None,
        is_super: bool = False,
        mfa: bool = False,
        session_id: str = "sess-test-1",
        expires_delta=None,
        **kw,
    ) -> str:
        principal = Principal(
            user_id=user_id,
            tenant_id=tenant_id,
            role_id=role_id,
            is_super=is_super,
            mfa=mfa,
            session_id=session_id,
            **kw,
        )
        return create_access_token(principal, expires_delta=expires_delta)

    return _make


@pytest.fixture(scope="session")
def user_token(make_token) -> str:
    return make_token()


@pytest.fixture(scope="session")
def super_token(make_token) -> str:
    return make_token(user_id="user-super-1", is_super=True)


@pytest.fixture(scope="session")
def tenant_token(make_token) -> str:
    return make_token(tenant_id="tenant-test-1")


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers(user_token) -> dict:
    return bearer(user_token)


@pytest.fixture
def super_headers(super_token) -> dict:
    return bearer(super_token)


@pytest.fixture
def tenant_headers(tenant_token) -> dict:
    return {
        "Authorization": f"Bearer {tenant_token}",
        "X-Tenant-Id": "tenant-test-1",
    }


# ---------------------------------------------------------------------------
# Database (only for @pytest.mark.db tests)
# ---------------------------------------------------------------------------

def _db_reachable(url: str) -> bool:
    """Cheap TCP probe so DB tests auto-skip when Postgres is down."""
    try:
        from sqlalchemy.engine.url import make_url

        u = make_url(url)
        host, port = u.host or "localhost", u.port or 5432
        with socket.create_connection((host, port), timeout=5.0):
            return True
    except Exception:
        return False


@pytest.fixture(scope="session")
def db_url() -> str:
    # Prefer explicit test URL; else reuse app DATABASE_URL when it is not the
    # default localhost stub (e.g. Neon via .env).
    from app.settings import settings as _app_settings

    url = os.getenv("TEST_DATABASE_URL") or ""
    if not url:
        candidate = getattr(_app_settings, "DATABASE_URL", "") or ""
        if candidate and "localhost" not in candidate and "127.0.0.1" not in candidate:
            url = candidate
    if not url:
        url = DEFAULT_TEST_DB_URL
    # Match app.settings asyncpg URL normalization
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]
    for token in ("sslmode=require", "sslmode=verify-full", "sslmode=prefer", "channel_binding=require"):
        url = url.replace(token, "")
    url = url.replace("?&", "?").replace("&&", "&").rstrip("?&")
    if url.startswith("postgresql+asyncpg://") and "ssl=" not in url:
        url += "&ssl=require" if "?" in url else "?ssl=require"
    if not _db_reachable(url):
        pytest.skip(
            "No test database reachable. Set TEST_DATABASE_URL or run "
            "`docker-compose up postgres` (byjan-platform/docker-compose.yml)."
        )
    return url


@pytest.fixture(scope="session")
async def db_engine(db_url):
    """Engine bound to the test Postgres; schemas+tables created once."""
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import NullPool

    engine = create_async_engine(db_url, echo=False, poolclass=NullPool)

    from app.shared.database import Base
    import app.platform.infra.orm  # noqa: F401 — register tables
    import app.business.infra.orm  # noqa: F401
    import app.ca.infra.orm  # noqa: F401

    async with engine.begin() as conn:
        for schema in ("core", "biz", "ca", "console"):
            await conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
        await conn.run_sync(Base.metadata.create_all)

    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine) -> AsyncGenerator:
    """Function-scoped session; rolled back after each test."""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def db_client(app, db_session) -> AsyncGenerator[httpx.AsyncClient, None]:
    """HTTP client whose get_db_session dependency is bound to the test DB."""
    from app.shared.database import get_db_session

    async def _override() -> AsyncGenerator:
        yield db_session

    app.dependency_overrides[get_db_session] = _override
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        yield client
    app.dependency_overrides.pop(get_db_session, None)
