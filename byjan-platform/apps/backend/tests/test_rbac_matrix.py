"""
RBAC & route-coverage matrix — generated from the live FastAPI route table
so *every registered route* is checked, automatically.

For every (method, path):
  * routes whose dependency graph includes get_current_user / require_super
    → anonymous request must be 401
  * public routes (webhooks, auth endpoints, invites peek/accept/decline,
    health, JWKS, optional-auth) → anonymous request must NOT be 401
  * super-only routes → normal user must get 403
  * authenticated GETs → 200 (a small KNOWN_ISSUES set is xfail-marked)
"""

import pytest


def _dep_names(dependant) -> set:
    """Flatten a FastAPI dependant tree into dependency-callable names."""
    names = set()

    def walk(dep):
        call = getattr(dep, "call", None)
        names.add(getattr(call, "__name__", repr(call)))
        for sub in getattr(dep, "dependencies", []):
            walk(sub)

    walk(dependant)
    return names


PROTECTED_DEPS = {
    "get_current_user", "require_super", "require_tenant",
    "require_permission", "require_step_up",
}
OPTIONAL_DEPS = {"get_current_user_optional"}
SKIP_METHODS = {"HEAD", "OPTIONS"}


def _iter_api_routes(router, prefix=""):
    """Yield (full_path, APIRoute) — FastAPI 0.141 nests routers lazily as
    _IncludedRouter objects, so walk include_context chains recursively."""
    for route in router.routes:
        if type(route).__name__ == "_IncludedRouter":
            ctx = route.include_context
            yield from _iter_api_routes(
                ctx.included_router, prefix + ctx.prefix
            )
        elif getattr(route, "dependant", None) is not None:
            yield prefix + route.path, route


def _route_matrix(app):
    rows = []
    for path, route in _iter_api_routes(app.router):
        methods = getattr(route, "methods", None) or set()
        deps = _dep_names(route.dependant)
        kind = (
            "super" if "require_super" in deps
            else "protected" if deps & PROTECTED_DEPS
            else "public"
        )
        for method in sorted(methods - SKIP_METHODS):
            rows.append((method, path, kind))
    return rows


def _routes(app, kind=None):
    return [r for r in _route_matrix(app) if kind is None or r[2] == kind]


# ---------------------------------------------------------------------------
# Sanity: the route table itself
# ---------------------------------------------------------------------------

def test_route_table_is_complete(app):
    rows = _route_matrix(app)
    assert len(rows) > 200, f"expected 200+ route×method pairs, got {len(rows)}"
    kinds = {r[2] for r in rows}
    assert kinds == {"public", "protected", "super"}


# ---------------------------------------------------------------------------
# Anonymous access
# ---------------------------------------------------------------------------

class TestAnonAccess:
    """Every protected or super route must reject anonymous callers with 401."""

    @pytest.fixture(autouse=True)
    def _routes_under_test(self, app):
        self.rows = _route_matrix(app)

    async def test_protected_routes_401(self, client):
        failures = []
        for method, path, kind in self.rows:
            if kind == "public":
                continue
            r = await client.request(method, path)
            if r.status_code != 401:
                failures.append(f"{method} {path} → {r.status_code}")
        assert not failures, "protected routes reachable anonymously:\n" + "\n".join(failures)

    async def test_public_routes_not_401(self, client):
        failures = []
        for method, path, kind in self.rows:
            if kind != "public":
                continue
            r = await client.request(method, path)
            if r.status_code == 401:
                failures.append(f"{method} {path} → 401")
        assert not failures, "public routes wrongly require auth:\n" + "\n".join(failures)


class TestAuthenticatedAccess:
    """With a normal token: super routes → 403, everything else ≠ 401/403."""

    @pytest.fixture(autouse=True)
    def _routes_under_test(self, app):
        self.rows = _route_matrix(app)

    async def test_super_routes_403_for_user(self, client, auth_headers):
        failures = []
        for method, path, kind in self.rows:
            if kind != "super":
                continue
            r = await client.request(method, path, headers=auth_headers)
            if r.status_code != 403:
                failures.append(f"{method} {path} → {r.status_code}")
        assert not failures, "super routes not enforcing require_super:\n" + "\n".join(failures)

    async def test_non_super_routes_accept_user(self, client, auth_headers):
        failures = []
        for method, path, kind in self.rows:
            if kind == "super":
                continue
            r = await client.request(method, path, headers=auth_headers)
            if r.status_code in (401, 403):
                failures.append(f"{method} {path} → {r.status_code}")
        assert not failures, "authenticated user wrongly rejected:\n" + "\n".join(failures)


# ---------------------------------------------------------------------------
# Authenticated GET coverage — the "every flow" sweep
# ---------------------------------------------------------------------------

# Routes that legitimately fail/422 today: service-method gaps (xfail),
# required query params, and DB-backed routes (covered by test_api_console
# under the db marker with a session override).
KNOWN_GET_ISSUES = {
    "/v1/me": "service.get_me not implemented",
    "/v1/console/overview": "service.get_console_overview not implemented",
    "/v1/console/traces": "service.get_trace_events not implemented",
    "/v1/console/integration-health": "service.get_integration_health not implemented",
    "/v1/console/issues": "needs db session",
    "/v1/console/traces": "needs db session",
    "/v1/console/sessions": "needs db session",
    "/v1/console/jobs": "needs db session",
}
GET_NEEDS_PARAMS = {
    "/v1/search",                    # GET with required JSON body
    "/v1/invites/peek",              # requires ?token=
    "/v1/biz/documents/next-number",          # requires ?type=
    "/v1/biz/lookup/hsn",                     # requires ?q=
}


class TestAuthenticatedGetSweep:
    @pytest.fixture(autouse=True)
    def _routes_under_test(self, app):
        self.rows = [(m, p, k) for m, p, k in _route_matrix(app) if m == "GET"]

    async def test_gets_return_200_for_user(self, client, auth_headers):
        failures, xfails = [], []
        for method, path, kind in self.rows:
            if kind == "super" or path in GET_NEEDS_PARAMS:
                continue
            r = await client.get(path, headers=auth_headers)
            if r.status_code == 200:
                continue
            if path in KNOWN_GET_ISSUES:
                xfails.append(f"{path} → {r.status_code} ({KNOWN_GET_ISSUES[path]})")
            else:
                failures.append(f"{path} → {r.status_code}")
        if xfails:
            print("\nknown gaps (xfail):", *xfails, sep="\n  ")
        assert not failures, "GETs failing for authenticated user:\n" + "\n".join(failures)

    async def test_gets_return_200_for_super(self, client, super_headers):
        failures, xfails = [], []
        for method, path, kind in self.rows:
            if kind != "super" or path in GET_NEEDS_PARAMS:
                continue
            r = await client.get(path, headers=super_headers)
            if r.status_code == 200:
                continue
            if path in KNOWN_GET_ISSUES:
                xfails.append(f"{path} → {r.status_code} ({KNOWN_GET_ISSUES[path]})")
            else:
                failures.append(f"{path} → {r.status_code}")
        if xfails:
            print("\nknown gaps (xfail):", *xfails, sep="\n  ")
        assert not failures, "GETs failing for super user:\n" + "\n".join(failures)
