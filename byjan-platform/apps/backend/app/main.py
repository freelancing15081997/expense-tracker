"""
Main application entry point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import structlog

from app.settings import settings
from app.router import api_router
from app.shared.database import init_db, close_db
from app.shared.logging import set_log_context
from app.errors import register_error_handlers
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.errors import ErrorMiddleware

log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan"""
    # Startup
    log.info("application_starting", env=settings.APP_ENV)

    # Initialize database
    try:
        await init_db()
        log.info("database_initialized")
    except Exception as e:
        log.error("database_init_error", error=str(e))

    # Set logging context
    set_log_context("app_env", settings.APP_ENV)
    set_log_context("app_version", settings.APP_VERSION)

    yield

    # Shutdown
    log.info("application_shutting_down")

    try:
        await close_db()
        log.info("database_closed")
    except Exception as e:
        log.error("database_close_error", error=str(e))


# Create application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-Id"],
)

# Add GZip middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add custom middleware (last added runs outermost):
# RequestID -> Error -> SecurityHeaders -> GZip -> CORS -> routes
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ErrorMiddleware)
app.add_middleware(RequestIDMiddleware)

# Register RFC 9457 problem-details error handlers
register_error_handlers(app)

# Include API router
app.include_router(api_router, prefix="/v1")

# Health check endpoint
@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
    }


# Ops endpoints (A8) — liveness/readiness for load balancers and k8s
@app.get("/healthz")
async def healthz():
    """Liveness probe"""
    return {"status": "ok"}


@app.get("/readyz")
async def readyz():
    """Readiness probe"""
    return {"status": "ready"}


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs" if settings.DEBUG else None,
    }
