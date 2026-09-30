"""Cross-tenant isolation: membership gate rejects foreign tenants."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_party_list_rejects_foreign_tenant_without_membership(client: AsyncClient):
    """Wrong X-Tenant-Id must not succeed (auth or membership failure)."""
    r = await client.get(
        "/v1/biz/parties",
        headers={"X-Tenant-Id": "00000000-0000-0000-0000-000000000099"},
    )
    assert r.status_code in (401, 403)
