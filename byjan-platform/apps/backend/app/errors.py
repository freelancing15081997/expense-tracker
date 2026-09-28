"""
Error handlers for FastAPI application
RFC 9457 problem details format
"""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import structlog

log = structlog.get_logger(__name__)


class ByjanError(Exception):
    """Base exception for Byjan application errors"""

    def __init__(
        self,
        type: str,
        title: str,
        status_code: int,
        code: str,
        detail: str,
        errors: list[dict] | None = None,
    ):
        self.type = type
        self.title = title
        self.status_code = status_code
        self.code = code
        self.detail = detail
        self.errors = errors or []
        super().__init__(detail)


class AuthError(ByjanError):
    """Authentication errors"""

    def __init__(self, code: str, detail: str):
        super().__init__(
            type="https://example.com/probs/auth",
            title="Authentication error",
            status_code=status.HTTP_401_UNAUTHORIZED,
            code=code,
            detail=detail,
        )


class TenantError(ByjanError):
    """Tenant-related errors"""

    def __init__(self, code: str, detail: str):
        super().__init__(
            type="https://example.com/probs/tenant",
            title="Tenant error",
            status_code=status.HTTP_403_FORBIDDEN,
            code=code,
            detail=detail,
        )


class PermissionError(ByjanError):
    """Permission errors"""

    def __init__(self, code: str, detail: str):
        super().__init__(
            type="https://example.com/probs/permission",
            title="Permission denied",
            status_code=status.HTTP_403_FORBIDDEN,
            code=code,
            detail=detail,
        )


class ValidationError(ByjanError):
    """Validation errors"""

    def __init__(self, code: str, detail: str, errors: list[dict] | None = None):
        super().__init__(
            type="https://example.com/probs/validation",
            title="Validation error",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code=code,
            detail=detail,
            errors=errors,
        )


class ConflictError(ByjanError):
    """Conflict errors (state, version, duplicate)"""

    def __init__(self, code: str, detail: str):
        super().__init__(
            type="https://example.com/probs/conflict",
            title="Conflict",
            status_code=status.HTTP_409_CONFLICT,
            code=code,
            detail=detail,
        )


def register_error_handlers(app: FastAPI):
    """Register error handlers for FastAPI application"""

    @app.exception_handler(ByjanError)
    async def byjan_error_handler(request: Request, exc: ByjanError):
        log.warning(
            "application_error",
            code=exc.code,
            status=exc.status_code,
            path=request.url.path,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "type": exc.type,
                "title": exc.title,
                "status": exc.status_code,
                "code": exc.code,
                "detail": exc.detail,
                "errors": exc.errors,
                "trace_id": request.state.request_id if hasattr(request.state, "request_id") else None,
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        log.warning(
            "http_exception",
            status=exc.status_code,
            path=request.url.path,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "type": "https://example.com/probs/http",
                "title": exc.detail,
                "status": exc.status_code,
                "code": "http_error",
                "detail": exc.detail,
                "trace_id": request.state.request_id if hasattr(request.state, "request_id") else None,
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        log.warning(
            "validation_error",
            errors=exc.errors(),
            path=request.url.path,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "type": "https://example.com/probs/validation",
                "title": "Validation error",
                "status": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "code": "validation.failed",
                "detail": "Request validation failed",
                "errors": [
                    {
                        "field": ".".join(str(loc) for loc in error["loc"]),
                        "code": error["type"],
                        "message": error["msg"],
                    }
                    for error in exc.errors()
                ],
                "trace_id": request.state.request_id if hasattr(request.state, "request_id") else None,
            },
        )
