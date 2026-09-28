"""
Pytest configuration and fixtures
"""

import pytest
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from typing import AsyncGenerator
import os
from dotenv import load_dotenv

# Load test environment variables
load_dotenv(".env.test")


# Test database URL
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/byjan_test"
)


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )
    
    # Create tables
    async with engine.begin() as conn:
        # Import all models to ensure they're registered
        from app.platform.infra.orm import Base
        from app.business.infra.orm import Base as BizBase
        from app.ca.infra.orm import Base as CABase
        
        # Create schemas
        await conn.execute("CREATE SCHEMA IF NOT EXISTS core")
        await conn.execute("CREATE SCHEMA IF NOT EXISTS biz")
        await conn.execute("CREATE SCHEMA IF NOT EXISTS ca")
        await conn.execute("CREATE SCHEMA IF NOT EXISTS console")
        
        # Create tables
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(BizBase.metadata.create_all)
        await conn.run_sync(CABase.metadata.create_all)
    
    yield engine
    
    # Cleanup
    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session"""
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
def sample_user_id() -> str:
    """Sample user ID for testing"""
    return "test-user-123"


@pytest.fixture
def sample_tenant_id() -> str:
    """Sample tenant ID for testing"""
    return "test-tenant-123"


@pytest.fixture
def sample_principal():
    """Sample principal for testing"""
    from app.deps import Principal
    
    return Principal(
        user_id="test-user-123",
        tenant_id="test-tenant-123",
        session_id="test-session-123",
        role="admin",
        permissions=["*"],
        ip="127.0.0.1",
        ua="test-agent",
        request_id="test-request-123",
    )
