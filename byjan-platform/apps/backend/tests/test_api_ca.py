"""
CA Practice module API contract tests (section C).

Every /v1/ca flow: dashboard, clients, compliance, tasks, review,
doc-requests, queries, team, time tracking, billing and CA reports.
All endpoints require auth.
"""

import pytest

C = "/v1/ca"


class TestCaDashboardAndClients:
    async def test_dashboard(self, client, auth_headers):
        assert (await client.get(f"{C}/dashboard", headers=auth_headers)).status_code == 200

    async def test_clients_list_filters(self, client, auth_headers):
        r = await client.get(
            f"{C}/clients",
            params={"staff_id": "s-1", "health": "risk", "type": "gst", "q": "mehta"},
            headers=auth_headers,
        )
        assert r.status_code == 200 and r.json() == []

    async def test_client_crud(self, client, auth_headers):
        r = await client.post(f"{C}/clients", json={"name": "Sharma Traders"}, headers=auth_headers)
        assert r.status_code == 200 and "id" in r.json()
        assert (await client.get(f"{C}/clients/c-1", headers=auth_headers)).status_code == 200
        assert (await client.patch(f"{C}/clients/c-1", json={}, headers=auth_headers)).status_code == 200
        assert (await client.post(f"{C}/clients/c-1/actions/archive", headers=auth_headers)).status_code == 200

    async def test_client_link(self, client, auth_headers):
        r = await client.post(f"{C}/clients/c-1/actions/link", json={}, headers=auth_headers)
        assert r.status_code == 200

    async def test_client_open_books_banner(self, client, auth_headers):
        """Opening client books returns the CA-context tenant + banner."""
        r = await client.post(f"{C}/clients/c-1/actions/open-books", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["tenant_id"]
        assert "books as their CA" in body["banner"]


class TestCompliance:
    async def test_compliance_list_filters(self, client, auth_headers):
        r = await client.get(
            f"{C}/compliance",
            params={"group": "gst", "period": "2026-09", "status": "pending",
                    "client_id": "c-1", "staff_id": "s-1"},
            headers=auth_headers,
        )
        assert r.status_code == 200 and r.json() == []

    async def test_compliance_calendar(self, client, auth_headers):
        r = await client.get(f"{C}/compliance/calendar", params={"month": "2026-10"}, headers=auth_headers)
        assert r.status_code == 200

    async def test_compliance_generate(self, client, auth_headers):
        r = await client.post(f"{C}/compliance/generate", json={"period": "2026-10"}, headers=auth_headers)
        assert r.status_code == 200

    async def test_compliance_update_advance_file(self, client, auth_headers):
        assert (await client.patch(f"{C}/compliance/k-1", json={}, headers=auth_headers)).status_code == 200
        assert (await client.post(f"{C}/compliance/k-1/actions/advance", json={}, headers=auth_headers)).status_code == 200
        r = await client.post(f"{C}/compliance/k-1/actions/file", json={}, headers=auth_headers)
        assert r.status_code == 200 and "arn" in r.json()

    async def test_batch_file(self, client, auth_headers):
        r = await client.post(f"{C}/compliance/actions/batch-file", json={"ids": ["k-1"]}, headers=auth_headers)
        assert r.status_code == 200 and "job_id" in r.json()


class TestTasks:
    async def test_tasks_board(self, client, auth_headers):
        r = await client.get(
            f"{C}/tasks",
            params={"view": "board", "client_id": "c-1", "assignee": "s-1"},
            headers=auth_headers,
        )
        assert r.status_code == 200 and r.json() == []

    async def test_task_crud(self, client, auth_headers):
        r = await client.post(f"{C}/tasks", json={"title": "File GSTR-1"}, headers=auth_headers)
        assert r.status_code == 200 and "id" in r.json()
        assert (await client.patch(f"{C}/tasks/t-1", json={"col": "Doing"}, headers=auth_headers)).status_code == 200
        assert (await client.delete(f"{C}/tasks/t-1", headers=auth_headers)).status_code == 200

    async def test_task_move(self, client, auth_headers):
        r = await client.post(
            f"{C}/tasks/t-1/actions/move",
            json={"column": "Done", "position": 0}, headers=auth_headers,
        )
        assert r.status_code == 200

    async def test_task_checklist(self, client, auth_headers):
        r = await client.post(
            f"{C}/tasks/t-1/checklist", json={"item": "Collect bank stmt"},
            headers=auth_headers,
        )
        assert r.status_code == 200 and "id" in r.json()
        r = await client.patch(
            f"{C}/tasks/t-1/checklist/i-1", json={"done": True}, headers=auth_headers
        )
        assert r.status_code == 200


class TestReviewAndDocRequests:
    async def test_review_items(self, client, auth_headers):
        r = await client.get(
            f"{C}/review", params={"client_id": "c-1", "issue": "gst_mismatch"},
            headers=auth_headers,
        )
        assert r.status_code == 200 and r.json() == []

    @pytest.mark.parametrize("action", ["apply-fix", "dismiss"])
    async def test_review_actions(self, client, auth_headers, action):
        r = await client.post(f"{C}/review/r-1/actions/{action}", headers=auth_headers)
        assert r.status_code == 200

    async def test_review_ask_client(self, client, auth_headers):
        r = await client.post(
            f"{C}/review/r-1/actions/ask-client",
            json={"question": "share bill?"}, headers=auth_headers,
        )
        assert r.status_code == 200

    async def test_review_scan(self, client, auth_headers):
        r = await client.post(f"{C}/review/actions/scan", json={"client_id": "c-1"}, headers=auth_headers)
        assert r.status_code == 200 and "job_id" in r.json()

    async def test_doc_requests(self, client, auth_headers):
        assert (await client.get(f"{C}/doc-requests", headers=auth_headers)).status_code == 200
        r = await client.post(f"{C}/doc-requests", json={"client_id": "c-1"}, headers=auth_headers)
        assert r.status_code == 200 and "id" in r.json()
        assert (await client.post(f"{C}/doc-requests/d-1/actions/remind", headers=auth_headers)).status_code == 200
        assert (await client.patch(f"{C}/doc-requests/d-1/items/i-1", json={}, headers=auth_headers)).status_code == 200


class TestCaQueriesTeamTime:
    async def test_queries(self, client, auth_headers):
        assert (await client.get(f"{C}/queries", params={"status": "open"}, headers=auth_headers)).status_code == 200
        r = await client.post(f"{C}/queries", json={"client_id": "c-1", "text": "?"}, headers=auth_headers)
        assert r.status_code == 200 and "id" in r.json()
        assert (await client.post(f"{C}/queries/q-1/reply", json={"text": "ok"}, headers=auth_headers)).status_code == 200
        assert (await client.post(f"{C}/queries/q-1/actions/close", headers=auth_headers)).status_code == 200

    async def test_team(self, client, auth_headers):
        assert (await client.get(f"{C}/team", headers=auth_headers)).status_code == 200
        r = await client.patch(f"{C}/team/u-1", json={"capacity": 40}, headers=auth_headers)
        assert r.status_code == 200

    async def test_time_entries(self, client, auth_headers):
        r = await client.get(
            f"{C}/time",
            params={"staff_id": "s-1", "client_id": "c-1",
                    "from_date": "2026-09-01", "to_date": "2026-09-30",
                    "billable": True},
            headers=auth_headers,
        )
        assert r.status_code == 200 and r.json() == []

        r = await client.post(
            f"{C}/time",
            json={"client_id": "c-1", "hours": 2.5, "billable": True},
            headers=auth_headers,
        )
        assert r.status_code == 200 and "id" in r.json()
        assert (await client.patch(f"{C}/time/t-1", json={}, headers=auth_headers)).status_code == 200
        assert (await client.delete(f"{C}/time/t-1", headers=auth_headers)).status_code == 200


class TestCaBillingAndReports:
    async def test_wip(self, client, auth_headers):
        assert (await client.get(f"{C}/billing/wip", headers=auth_headers)).status_code == 200

    async def test_bill_wip(self, client, auth_headers):
        r = await client.post(
            f"{C}/billing/actions/bill",
            json={"client_id": "c-1", "entry_ids": ["t-1"]},
            headers=auth_headers,
        )
        assert r.status_code == 200 and "invoice_id" in r.json()

    @pytest.mark.parametrize("key", [
        "realisation", "utilisation", "client-profitability",
        "deadline-performance", "wip-aging",
    ])
    async def test_ca_reports(self, client, auth_headers, key):
        r = await client.get(f"{C}/reports/{key}", headers=auth_headers)
        assert r.status_code == 200


class TestCaAuthRequired:
    @pytest.mark.parametrize("method,path", [
        ("GET", "/dashboard"), ("GET", "/clients"), ("POST", "/clients"),
        ("GET", "/compliance"), ("GET", "/tasks"), ("POST", "/tasks"),
        ("GET", "/review"), ("GET", "/doc-requests"), ("GET", "/queries"),
        ("GET", "/team"), ("GET", "/time"), ("POST", "/time"),
        ("GET", "/billing/wip"), ("POST", "/billing/actions/bill"),
        ("GET", "/reports/realisation"),
    ])
    async def test_ca_routes_require_auth(self, client, method, path):
        r = await client.request(method, f"{C}{path}")
        assert r.status_code == 401
