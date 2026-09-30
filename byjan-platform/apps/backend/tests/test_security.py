"""
Security & abuse tests.

Token attacks (malformed, forged, expired, alg-confusion, bearer-scheme
variations), injection-style inputs, hostile headers, cross-tenant access,
method abuse, and error-envelope information leakage.
"""

import time
import pytest
from jose import jwt


P = "/v1"
B = "/v1/biz"
C = "/v1/console"


# ===========================================================================
# Bearer-token attacks
# ===========================================================================

class TestTokenAbuse:
    @pytest.mark.parametrize("header", [
        "Bearer",                      # empty token
        "Bearer ",                     # whitespace token
        "Basic dXNlcjpwYXNz",          # wrong scheme
        "bearer valid-but-fake-token", # lowercase scheme + garbage
        "Token abc",                   # unknown scheme
        "",                            # empty header
    ])
    async def test_bad_authorization_headers(self, client, header):
        r = await client.get(f"{P}/members", headers={"Authorization": header})
        assert r.status_code == 401

    async def test_garbage_jwt(self, client):
        r = await client.get(
            f"{P}/members", headers={"Authorization": "Bearer aaa.bbb.ccc"}
        )
        assert r.status_code == 401

    async def test_forged_super_token_rejected(self, client):
        """A token self-signed by an attacker must not grant console access."""
        forged = jwt.encode(
            {"sub": "attacker", "sup": True, "exp": int(time.time()) + 3600},
            "attacker-controlled-secret",
            algorithm="HS256",
        )
        r = await client.get(
            f"{C}/overview", headers={"Authorization": f"Bearer {forged}"}
        )
        assert r.status_code == 401

    async def test_expired_token_rejected(self, client, make_token):
        from datetime import timedelta

        token = make_token(expires_delta=timedelta(seconds=-60))
        r = await client.get(f"{P}/members", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401

    async def test_wrong_key_token_rejected(self, client):
        token = jwt.encode(
            {"sub": "u-1", "exp": int(time.time()) + 3600},
            "not-the-server-key",
            algorithm="HS256",
        )
        r = await client.get(f"{P}/members", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401

    async def test_alg_none_token_rejected(self, client):
        claims = jwt.encode(
            {"sub": "u-1", "exp": int(time.time()) + 3600}, "x", algorithm="HS256"
        )
        unsigned = claims.rsplit(".", 1)[0] + "."
        r = await client.get(f"{P}/members", headers={"Authorization": f"Bearer {unsigned}"})
        assert r.status_code == 401

    async def test_user_token_cannot_reach_console(self, client, auth_headers):
        """Privilege-escalation guard: normal token → 403 on super routes."""
        for path in ("/overview", "/issues", "/tenants", "/flags"):
            r = await client.get(f"{C}{path}", headers=auth_headers)
            assert r.status_code == 403


# ===========================================================================
# Injection-style inputs
# ===========================================================================

SQLI = "'; DROP TABLE users; --"
XSS = "<script>alert(1)</script>"
TRAVERSAL = "../../../../etc/passwd"
NULL_BYTE = "a%00b"  # percent-encoded NUL reaches the ASGI layer


class TestInjectionInputs:
    @pytest.mark.parametrize("payload", [SQLI, XSS, TRAVERSAL, NULL_BYTE])
    async def test_path_param_injection_no_500(self, client, auth_headers, payload):
        """Hostile strings in path params must not crash the server."""
        r = await client.get(f"{B}/documents/{payload}", headers=auth_headers)
        assert r.status_code in (200, 400, 404, 422)
        assert r.status_code != 500

    @pytest.mark.parametrize("payload", [SQLI, XSS, TRAVERSAL])
    async def test_query_param_injection_no_500(self, client, auth_headers, payload):
        r = await client.get(f"{B}/documents", params={"q": payload}, headers=auth_headers)
        assert r.status_code in (200, 400, 404, 422)

    @pytest.mark.parametrize("payload", [SQLI, XSS, TRAVERSAL])
    async def test_body_injection_no_500(self, client, auth_headers, payload):
        r = await client.post(
            f"{P}/tenants",
            json={"kind": "business", "name": payload},
            headers=auth_headers,
        )
        assert r.status_code in (200, 201, 400, 422)
        if r.status_code == 200:
            # payload is stored/echoed as data, not executed
            assert r.json()["name"] == payload

    async def test_json_type_confusion(self, client, auth_headers):
        """Wrong JSON types must yield 422, not 500."""
        r = await client.post(f"{P}/tenants", json={"kind": 123, "name": []}, headers=auth_headers)
        assert r.status_code in (200, 422)
        r = await client.post(f"{P}/tenants", json=["not", "an", "object"], headers=auth_headers)
        assert r.status_code == 422

    async def test_huge_string_field(self, client, auth_headers):
        r = await client.post(
            f"{P}/tenants",
            json={"kind": "business", "name": "x" * 10000},
            headers=auth_headers,
        )
        assert r.status_code in (200, 413, 422)  # max_length=255 → 422 expected
        assert r.status_code == 422


# ===========================================================================
# Header abuse
# ===========================================================================

class TestHeaderAbuse:
    async def test_wrong_tenant_header_rejected(self, client, make_token):
        """X-Tenant-Id that doesn't match the token's tenant is rejected
        when require_tenant is used — verified at the dependency level."""
        from app.deps import require_tenant
        from app.errors import TenantError
        from app.platform.domain.models import Principal

        principal = Principal(user_id="u-1", tenant_id="tenant-a")
        with pytest.raises(TenantError):
            await require_tenant(principal=principal, x_tenant_id="tenant-b")

    async def test_matching_tenant_header_ok(self):
        from app.deps import require_tenant
        from app.platform.domain.models import Principal

        principal = Principal(user_id="u-1", tenant_id="tenant-a")
        p, t = await require_tenant(principal=principal, x_tenant_id="tenant-a")
        assert t == "tenant-a" and p is principal

    async def test_content_type_text_plain_rejected_on_json_route(self, client):
        r = await client.post(
            f"{P}/auth/otp/send",
            content="channel=sms",
            headers={"Content-Type": "text/plain"},
        )
        assert r.status_code in (400, 415, 422)


# ===========================================================================
# Method abuse
# ===========================================================================

class TestMethodAbuse:
    @pytest.mark.parametrize("method", ["PUT", "PATCH", "DELETE"])
    async def test_get_only_routes_reject_other_methods(self, client, method):
        r = await client.request(method, "/health")
        assert r.status_code == 405

    async def test_post_only_route_rejects_get(self, client):
        r = await client.get(f"{P}/auth/otp/send")
        assert r.status_code == 405

    async def test_trace_method(self, client):
        r = await client.request("TRACE", "/health")
        assert r.status_code in (405, 501)


# ===========================================================================
# Error-envelope information leakage
# ===========================================================================

class TestErrorEnvelopeHygiene:
    async def test_401_does_not_leak_internals(self, client):
        r = await client.get(f"{P}/members")
        body = r.json()
        leaked = {"stack", "traceback", "exception", "sql", "password", "secret"}
        assert not (leaked & {k.lower() for k in body})

    async def test_404_does_not_leak_internals(self, client):
        r = await client.get("/v1/../admin/secret")
        assert "Traceback" not in r.text
        assert "site-packages" not in r.text

    async def test_422_lists_fields_not_values(self, client):
        r = await client.post(
            f"{P}/auth/otp/send", json={"channel": 123, "purpose": "x"}
        )
        body = r.json()
        assert body["code"] == "validation.failed"
        # error items carry field/code/message — not the raw payload back
        assert all(set(e) == {"field", "code", "message"} for e in body["errors"])

    async def test_500_envelope_is_problem_shape(self, client, super_headers):
        """A 500 (known-broken service call) still returns problem JSON,
        never a stack trace."""
        r = await client.get(f"{P}/console/overview", headers=super_headers)
        if r.status_code == 500:
            body = r.json()
            assert body["status"] == 500
            assert body["code"] == "internal_error"
            assert "Traceback" not in r.text
        else:
            # route got implemented — either way, no stack trace
            assert "Traceback" not in r.text


# ===========================================================================
# Rate-limit & tenant middleware documentation tests
# ===========================================================================

class TestMiddlewareContract:
    async def test_repeated_requests_not_rate_limited_yet(self, client):
        """RateLimitMiddleware is a TODO stub — document current behaviour."""
        for _ in range(8):
            r = await client.post(
                f"{P}/auth/otp/send",
                json={"channel": "sms", "identifier": "x", "purpose": "signin"},
            )
            assert r.status_code == 200  # no 429s today
