"""
Super-user console API contract tests (section D, /v1/console).

Auth matrix: anon → 401, normal user → 403, super → 200.
DB-backed routes are additionally covered by @pytest.mark.db tests that run
against a real Postgres (TEST_DATABASE_URL or docker-compose).
"""

import pytest

C = "/v1/console"


# ===========================================================================
# Auth matrix — every console route
# ===========================================================================

CONSOLE_ROUTES = [
    ("GET", "/overview"), ("GET", "/issues"),
    ("POST", "/issues/i-1/actions/resolve"), ("POST", "/issues/i-1/actions/reopen"),
    ("GET", "/trace/t-1"), ("GET", "/traces"), ("GET", "/integration-health"),
    ("GET", "/sessions"), ("DELETE", "/sessions/s-1"),
    ("GET", "/jobs"), ("POST", "/jobs/j-1/actions/retry"),
    ("POST", "/jobs/j-1/actions/cancel"),
    ("GET", "/integrations"), ("GET", "/flags"), ("PUT", "/flags/k"),
    ("GET", "/tenants"),
    ("POST", "/tenants/t-1/actions/suspend"), ("POST", "/tenants/t-1/actions/restore"),
    ("POST", "/view-as"),
]


class TestConsoleAuthMatrix:
    @pytest.mark.parametrize("method,path", CONSOLE_ROUTES)
    async def test_anon_401(self, client, method, path):
        r = await client.request(method, f"{C}{path}")
        assert r.status_code == 401

    @pytest.mark.parametrize("method,path", CONSOLE_ROUTES)
    async def test_non_super_403(self, client, auth_headers, method, path):
        r = await client.request(method, f"{C}{path}", headers=auth_headers)
        assert r.status_code == 403
        assert r.json()["status"] == 403


# ===========================================================================
# Super-user flows that don't need a DB
# ===========================================================================

class TestConsoleSuperFlows:
    async def test_overview_shape(self, client, super_headers):
        r = await client.get(f"{C}/overview", headers=super_headers)
        assert r.status_code == 200
        body = r.json()
        for key in ("tenants", "active_users", "error_rate", "job_health", "service_status"):
            assert key in body, f"missing {key}"
        assert isinstance(body["tenants"], int)
        assert isinstance(body["error_rate"], float)
        assert isinstance(body["service_status"], dict)

    async def test_trace_placeholder(self, client, super_headers):
        assert (await client.get(f"{C}/trace/t-1", headers=super_headers)).status_code == 200

    async def test_integration_health(self, client, super_headers):
        r = await client.get(f"{C}/integration-health", headers=super_headers)
        assert r.status_code == 200
        body = r.json()
        for provider in ("firebase", "whatsapp", "gsp", "database", "redis", "storage", "email"):
            assert provider in body
            assert body[provider]["status"] in ("ok", "mock", "missing_key")
            assert "last_check" in body[provider]

    async def test_session_delete_job_actions(self, client, super_headers):
        assert (await client.delete(f"{C}/sessions/s-1", headers=super_headers)).status_code == 200
        for action in ("retry", "cancel"):
            r = await client.post(f"{C}/jobs/j-1/actions/{action}", headers=super_headers)
            assert r.status_code == 200

    async def test_integrations_placeholder(self, client, super_headers):
        assert (await client.get(f"{C}/integrations", headers=super_headers)).status_code == 200

    async def test_tenant_suspend_restore(self, client, super_headers):
        r = await client.post(f"{C}/tenants/t-1/actions/suspend", headers=super_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "suspended"
        r = await client.post(f"{C}/tenants/t-1/actions/restore", headers=super_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "restored"

    async def test_flag_update(self, client, super_headers):
        r = await client.put(
            f"{C}/flags/feature_einvoice",
            json={"enabled": True}, headers=super_headers,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["key"] == "feature_einvoice"
        assert body["enabled"] is True

    async def test_view_as(self, client, super_headers):
        r = await client.post(
            f"{C}/view-as", json={"tenant_id": "t-1", "user_id": "u-1"},
            headers=super_headers,
        )
        assert r.status_code == 200 and "token" in r.json()


# ===========================================================================
# DB-backed console flows — real Postgres only
# ===========================================================================

@pytest.mark.db
class TestConsoleDbBacked:
    async def test_overview_with_db(self, db_client, super_headers):
        r = await db_client.get(f"{C}/overview", headers=super_headers)
        assert r.status_code == 200

    async def test_issues_empty(self, db_client, super_headers):
        r = await db_client.get(f"{C}/issues", headers=super_headers)
        assert r.status_code == 200 and r.json() == []

    async def test_traces_empty_db(self, db_client, super_headers):
        r = await db_client.get(f"{C}/traces", headers=super_headers)
        assert r.status_code == 200
        assert r.json()["events"] == []
        assert r.json()["total"] == 0

    async def test_sessions_empty(self, db_client, super_headers):
        r = await db_client.get(f"{C}/sessions", headers=super_headers)
        assert r.status_code == 200 and r.json() == []

    async def test_jobs_empty(self, db_client, super_headers):
        r = await db_client.get(f"{C}/jobs", headers=super_headers)
        assert r.status_code == 200 and r.json() == []

    async def test_resolve_missing_issue_404(self, db_client, super_headers):
        r = await db_client.post(
            f"{C}/issues/00000000-0000-0000-0000-000000000000/actions/resolve",
            json={"resolution": "n/a"}, headers=super_headers,
        )
        assert r.status_code == 404

    async def test_issue_resolve_reopen_flow(self, db_client, super_headers, db_session):
        """Seed an issue, resolve it, reopen it — full lifecycle."""
        import uuid
        from app.platform.infra.orm import ConsoleIssueORM

        issue = ConsoleIssueORM(
            id=uuid.uuid4(), sev="warning", title="test issue",
            module="platform", occurrences=3, status="open",
        )
        db_session.add(issue)
        await db_session.commit()

        r = await db_client.get(f"{C}/issues", headers=super_headers)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) == 1
        assert rows[0]["title"] == "test issue"
        assert rows[0]["sev"] == "warning"
        assert rows[0]["module"] == "platform"
        assert rows[0]["occurrences"] == 3

        # filter by severity
        r = await db_client.get(f"{C}/issues", params={"sev": "critical"}, headers=super_headers)
        assert r.json() == []
        r = await db_client.get(f"{C}/issues", params={"sev": "warning"}, headers=super_headers)
        assert len(r.json()) == 1

        # resolve
        r = await db_client.post(
            f"{C}/issues/{issue.id}/actions/resolve",
            json={"resolution": "deployed fix"}, headers=super_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "resolved"

        # reopen
        r = await db_client.post(
            f"{C}/issues/{issue.id}/actions/reopen", headers=super_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "reopened"

    async def test_traces_include_audit_and_outbox(self, db_client, super_headers, db_session):
        import uuid
        from app.platform.infra.orm import AuditLogORM, OutboxORM

        tid, aid, eid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        db_session.add(AuditLogORM(
            id=uuid.uuid4(), tenant_id=tid, actor_id=aid,
            action="delete", entity_type="document", entity_id=eid,
        ))
        db_session.add(OutboxORM(
            id=uuid.uuid4(), tenant_id=tid, type="document.deleted",
            aggregate_type="document", aggregate_id=eid, payload={"n": 1},
        ))
        await db_session.commit()

        r = await db_client.get(f"{C}/traces", headers=super_headers)
        assert r.status_code == 200
        events = r.json()["events"]
        assert len(events) == 2
        audit_ev = next(e for e in events if e["module"] == "business")
        assert audit_ev["severity"] == "warning"  # delete maps to warning
        outbox_ev = next(e for e in events if e["module"] == "system")
        assert "document.deleted" in outbox_ev["message"]
