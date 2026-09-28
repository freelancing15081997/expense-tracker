"""
Tenant resolution middleware
Sets app.tenant_id and app.user_id for RLS
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.status import HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN
import structlog

log = structlog.get_logger(__name__)


class TenantMiddleware(BaseHTTPMiddleware):
    """Resolve tenant from X-Tenant-Id header and set for RLS"""

    # Public routes that don't require tenant header
    PUBLIC_ROUTES = {
        "/v1/auth",
        "/v1/public",
        "/v1/webhooks",
        "/v1/invites/peek",
        "/v1/invites/accept",
        "/v1/invites/decline",
        "/healthz",
        "/readyz",
        "/metrics",
    }

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip tenant resolution for public routes
        if any(path.startswith(route) for route in self.PUBLIC_ROUTES):
            return await call_next(request)

        # Get tenant ID from header
        tenant_id = request.headers.get("X-Tenant-Id")
        if not tenant_id:
            return JSONResponse(
                status_code=HTTP_401_UNAUTHORIZED,
                content={"type": "https://example.com/probs/auth", "title": "Missing tenant header"},
            )

        # TODO: Validate tenant exists and user is member
        # For now, set the values
        request.state.tenant_id = tenant_id
        request.state.user_id = request.headers.get("X-User-Id")  # From JWT

        # TODO: Execute SET LOCAL app.tenant_id = ... for RLS
        # This will be done in the database session

        return await call_next(request)
