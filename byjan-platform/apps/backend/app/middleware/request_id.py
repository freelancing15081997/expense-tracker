"""
Request ID middleware for traceability
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import uuid
import structlog

log = structlog.get_logger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Add X-Request-ID header to all requests for traceability"""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        # Add to structlog context
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
