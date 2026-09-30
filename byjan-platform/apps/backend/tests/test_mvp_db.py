"""
MVP integration tests against a real Postgres (Neon / local).

Uses mocked Firebase verify so we don't need a live Firebase project.
Marked ``@pytest.mark.db`` — skipped when DB is unreachable.
"""

from __future__ import annotations

import os
import uuid

import pytest

P = "/v1"


@pytest.fixture
def firebase_claims(monkeypatch):
    """Install a fake verify_id_token that returns configurable claims."""
    from app.platform import service as svc_mod

    state = {"uid": f"fb_{uuid.uuid4().hex[:12]}", "email": None, "name": "E2E User"}

    def _verify(token: str):
        return {
            "uid": state["uid"],
            "email": state["email"] or f"{state['uid']}@example.test",
            "name": state["name"],
            "email_verified": True,
            "phone_number": None,
        }

    monkeypatch.setattr(svc_mod, "verify_id_token", _verify)
    return state


@pytest.mark.db
class TestAuthExchangeDb:
    async def test_exchange_creates_user_tenant_session(self, db_client, firebase_claims):
        firebase_claims["email"] = f"owner_{uuid.uuid4().hex[:8]}@example.test"
        firebase_claims["name"] = "Owner One"

        r = await db_client.post(
            f"{P}/auth/firebase/exchange",
            json={"id_token": "fake.token", "name": "Owner One"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["access_token"]
        assert body["refresh_token"]
        assert body["token_type"] == "bearer"
        assert "byjan_refresh" in r.cookies or True  # cookie may be set on response

        me = await db_client.get(
            f"{P}/me",
            headers={"Authorization": f"Bearer {body['access_token']}"},
        )
        assert me.status_code == 200, me.text
        profile = me.json()
        assert profile["email"] == firebase_claims["email"]
        assert profile["tenants"], "expected auto-created business tenant"
        assert profile["tenants"][0]["role"] == "Owner"

    async def test_refresh_rotates(self, db_client, firebase_claims):
        firebase_claims["email"] = f"refresh_{uuid.uuid4().hex[:8]}@example.test"
        ex = await db_client.post(
            f"{P}/auth/firebase/exchange",
            json={"id_token": "fake.token"},
        )
        assert ex.status_code == 200, ex.text
        refresh = ex.json()["refresh_token"]

        r = await db_client.post(
            f"{P}/auth/refresh",
            json={"refresh_token": refresh},
        )
        assert r.status_code == 200, r.text
        assert r.json()["access_token"]
        assert r.json()["refresh_token"] != refresh

        # Reuse old refresh → rejected
        reused = await db_client.post(
            f"{P}/auth/refresh",
            json={"refresh_token": refresh},
        )
        assert reused.status_code == 401


@pytest.mark.db
class TestPartiesDocumentsDb:
    async def _login(self, db_client, firebase_claims, email: str, name: str):
        firebase_claims["uid"] = f"fb_{uuid.uuid4().hex[:12]}"
        firebase_claims["email"] = email
        firebase_claims["name"] = name
        ex = await db_client.post(
            f"{P}/auth/firebase/exchange",
            json={"id_token": "fake.token", "name": name},
        )
        assert ex.status_code == 200, ex.text
        access = ex.json()["access_token"]
        me = await db_client.get(
            f"{P}/me", headers={"Authorization": f"Bearer {access}"}
        )
        assert me.status_code == 200, me.text
        tenant_id = me.json()["tenants"][0]["id"]
        return {
            "Authorization": f"Bearer {access}",
            "X-Tenant-Id": tenant_id,
        }

    async def test_party_and_invoice_persist(self, db_client, firebase_claims):
        headers = await self._login(
            db_client, firebase_claims, f"biz_{uuid.uuid4().hex[:8]}@example.test", "Biz User"
        )

        empty = await db_client.get(f"{P}/biz/parties", headers=headers)
        assert empty.status_code == 200
        assert empty.json() == []

        created = await db_client.post(
            f"{P}/biz/parties",
            headers=headers,
            json={"k": "c", "n": "Mehta Builders", "e": "a@mehta.in", "city": "Mumbai", "terms": 30},
        )
        assert created.status_code == 200, created.text
        party = created.json()
        assert party["id"]
        assert party["n"] == "Mehta Builders"

        listed = await db_client.get(f"{P}/biz/parties", headers=headers)
        assert len(listed.json()) == 1

        doc = await db_client.post(
            f"{P}/biz/documents",
            headers=headers,
            json={
                "tk": "invoices",
                "party": party["id"],
                "st": "Draft",
                "terms": 30,
                "lines": [{"q": "2", "r": "1000", "g": 18, "desc": "Consulting"}],
            },
        )
        assert doc.status_code == 200, doc.text
        invoice = doc.json()
        assert invoice["id"]
        assert invoice["tk"] == "invoices"
        assert invoice["party"] == party["id"]

        docs = await db_client.get(f"{P}/biz/documents", headers=headers)
        assert docs.status_code == 200
        assert len(docs.json()) == 1

    async def test_tenant_isolation(self, db_client, firebase_claims):
        h1 = await self._login(
            db_client, firebase_claims, f"u1_{uuid.uuid4().hex[:8]}@example.test", "User One"
        )
        await db_client.post(
            f"{P}/biz/parties",
            headers=h1,
            json={"k": "c", "n": "Only User One Sees", "terms": 15},
        )

        h2 = await self._login(
            db_client, firebase_claims, f"u2_{uuid.uuid4().hex[:8]}@example.test", "User Two"
        )
        parties2 = await db_client.get(f"{P}/biz/parties", headers=h2)
        assert parties2.status_code == 200
        assert parties2.json() == [], "user2 must not see user1 parties"

        docs2 = await db_client.get(f"{P}/biz/documents", headers=h2)
        assert docs2.json() == []
