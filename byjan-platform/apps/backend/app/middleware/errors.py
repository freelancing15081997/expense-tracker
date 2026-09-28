"""
Error handling middleware for RFC 9457 problem details
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR
import structlog

log = structlog.get_logger(__name__)


class ErrorMiddleware(BaseHTTPMiddleware):
    """Global error handler for RFC 9457 problem details"""

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as exc:
            log.exception("unhandled_exception", path=request.url.path)
            return JSONResponse(
                status_code=HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "type": "https://example.com/probs/internal-error",
                    "title": "Internal server error",
                    "status": HTTP_500_INTERNAL_SERVER_ERROR,
                    "code": "internal_error",
                    "detail": "An unexpected error occurred",
                    "trace_id": request.state.request_id if hasattr(request.state, "request_id") else None,
                },
            )
