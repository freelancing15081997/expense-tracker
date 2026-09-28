"""
Security headers middleware per OWASP ASVS Level 2
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # HSTS preload
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Referrer policy
        response.headers["Referrer-Policy"] = "no-referrer"

        # Cache control on authenticated responses
        if request.url.path.startswith("/v1") and not request.url.path.startswith("/v1/public"):
            response.headers["Cache-Control"] = "no-store"

        # Content Security Policy
        response.headers["Content-Security-Policy"] = "default-src 'none'"

        # Cross-Origin Resource Policy
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"

        return response
