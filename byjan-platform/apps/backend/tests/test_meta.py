"""
Meta & response-cosmetics tests.

Covers: liveness/readiness, root document, X-Request-ID, OWASP security
headers, gzip negotiation, CORS behaviour, and the RFC 9457 problem-details
error envelope (404 / 405 / 422 / unhandled).
"""

import pytest


# ---------------------------------------------------------------------------
# Liveness / readiness / root
# ---------------------------------------------------------------------------

async def test_health_returns_healthy(client):
    r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert "version" in body and body["version"]
    assert body["environment"] == "test"


async def test_healthz_liveness(client):
    r = await client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


async def test_readyz_readiness(client):
    r = await client.get("/readyz")
    assert r.status_code == 200
    assert r.json() == {"status": "ready"}


async def test_root_returns_app_document(client):
    r = await client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Byjan Business"
    assert "version" in body
    assert "docs" in body


async def test_platform_module_health(client):
    r = await client.get("/v1/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "module": "platform"}


# ---------------------------------------------------------------------------
# X-Request-ID cosmetics
# ---------------------------------------------------------------------------

async def test_request_id_generated(client):
    r = await client.get("/health")
    rid = r.headers.get("X-Request-ID")
    assert rid, "X-Request-ID header missing"
    assert len(rid) >= 8


async def test_request_id_echoes_incoming_header(client):
    r = await client.get("/health", headers={"X-Request-ID": "req-abc-123"})
    assert r.headers["X-Request-ID"] == "req-abc-123"


async def test_request_id_unique_per_request(client):
    r1 = await client.get("/health")
    r2 = await client.get("/health")
    assert r1.headers["X-Request-ID"] != r2.headers["X-Request-ID"]


async def test_request_id_present_on_error_responses(client):
    r = await client.get("/v1/me")  # 401 without token
    assert r.status_code == 401
    assert r.headers.get("X-Request-ID")


# ---------------------------------------------------------------------------
# Security headers cosmetics (OWASP ASVS L2)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("path", ["/health", "/", "/v1/health"])
async def test_security_headers_present(client, path):
    r = await client.get(path)
    h = r.headers
    assert h["Strict-Transport-Security"] == (
        "max-age=31536000; includeSubDomains; preload"
    )
    assert h["X-Content-Type-Options"] == "nosniff"
    assert h["Referrer-Policy"] == "no-referrer"
    assert h["Content-Security-Policy"] == "default-src 'none'"
    assert h["Cross-Origin-Resource-Policy"] == "same-site"


async def test_cache_control_no_store_on_api(client):
    r = await client.get("/v1/health")
    assert r.headers.get("Cache-Control") == "no-store"


async def test_cache_control_not_forced_on_non_api(client):
    r = await client.get("/health")
    assert "no-store" not in r.headers.get("Cache-Control", "")


# ---------------------------------------------------------------------------
# Content negotiation cosmetics
# ---------------------------------------------------------------------------

async def test_gzip_encoding_for_large_responses(client):
    # /openapi.json is well over the 1000-byte GZip threshold
    r = await client.get("/openapi.json", headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200
    assert r.headers.get("Content-Encoding") == "gzip"
    # httpx transparently decompresses; body is still valid JSON
    assert "paths" in r.json()


async def test_no_gzip_without_accept_encoding(client):
    r = await client.get("/openapi.json", headers={"Accept-Encoding": "identity"})
    assert r.status_code == 200
    assert r.headers.get("Content-Encoding") in (None, "identity")


async def test_json_content_type(client):
    r = await client.get("/health")
    assert r.headers["Content-Type"].startswith("application/json")


# ---------------------------------------------------------------------------
# CORS cosmetics
# ---------------------------------------------------------------------------

async def test_cors_preflight_allowed_origin(client):
    r = await client.options(
        "/v1/auth/otp/send",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert r.status_code in (200, 204)
    assert r.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"


async def test_cors_preflight_disallowed_origin(client):
    r = await client.options(
        "/v1/auth/otp/send",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert r.headers.get("Access-Control-Allow-Origin") != "https://evil.example.com"


# ---------------------------------------------------------------------------
# RFC 9457 problem-details envelope
# ---------------------------------------------------------------------------

def _assert_problem_shape(body: dict, status: int):
    for key in ("type", "title", "status", "code", "detail", "trace_id"):
        assert key in body, f"problem details missing '{key}': {body}"
    assert body["status"] == status
    assert body["type"].startswith("https://")


async def test_404_problem_details_shape(client):
    r = await client.get("/v1/definitely/not/a/route")
    assert r.status_code == 404
    _assert_problem_shape(r.json(), 404)


async def test_405_problem_details_shape(client):
    r = await client.delete("/health")  # GET-only route
    assert r.status_code == 405
    _assert_problem_shape(r.json(), 405)


async def test_401_problem_details_shape(client):
    r = await client.get("/v1/members")
    assert r.status_code == 401
    body = r.json()
    _assert_problem_shape(body, 401)
    assert body["code"] == "auth.invalid_token"


async def test_422_validation_problem_details_shape(client):
    r = await client.post(
        "/v1/auth/otp/send",
        json={"channel": "pigeon", "identifier": "x", "purpose": "signin"},
    )
    assert r.status_code == 422
    body = r.json()
    _assert_problem_shape(body, 422)
    assert body["code"] == "validation.failed"
    assert isinstance(body["errors"], list) and body["errors"]
    first = body["errors"][0]
    assert {"field", "code", "message"} <= set(first)


async def test_trace_id_in_error_matches_request_id(client):
    r = await client.get(
        "/v1/members", headers={"X-Request-ID": "trace-check-1"}
    )
    assert r.status_code == 401
    assert r.json()["trace_id"] == "trace-check-1"


# ---------------------------------------------------------------------------
# OpenAPI / docs cosmetics
# ---------------------------------------------------------------------------

async def test_openapi_lists_all_module_prefixes(client):
    r = await client.get("/openapi.json")
    assert r.status_code == 200
    paths = r.json()["paths"]
    for prefix in ("/v1/", "/v1/biz/", "/v1/ca/", "/v1/console/"):
        assert any(p.startswith(prefix) for p in paths), f"no routes under {prefix}"


async def test_docs_ui_available_in_debug(client):
    r = await client.get("/docs")
    assert r.status_code == 200
    assert "swagger" in r.text.lower()
