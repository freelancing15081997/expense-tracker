"""
Basic tests for the main application
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_healthz(client: AsyncClient):
    """Test health check endpoint"""
    response = await client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_readyz(client: AsyncClient):
    """Test readiness check endpoint"""
    response = await client.get("/readyz")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


@pytest.mark.asyncio
async def test_platform_health(client: AsyncClient):
    """Test platform health check"""
    response = await client.get("/v1/platform/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "module": "platform"}


@pytest.mark.asyncio
async def test_request_id_middleware(client: AsyncClient):
    """Test that request ID middleware adds X-Request-ID header"""
    response = await client.get("/healthz")
    assert "X-Request-ID" in response.headers
    assert len(response.headers["X-Request-ID"]) > 0
