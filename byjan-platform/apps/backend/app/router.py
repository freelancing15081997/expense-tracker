"""
Main API router - aggregates all module routers
"""

from fastapi import APIRouter

from app.platform.api import router as platform_router
from app.business.api import router as business_router
from app.ca.api import router as ca_router
from app.console.api import router as console_router

api_router = APIRouter()

# Platform routes at /v1/auth, /v1/me, /v1/tenants (docs + frontend contract)
api_router.include_router(platform_router, tags=["Platform"])

# Include business routes (accounts, parties, items, documents, payments, bank, operations, tax, inbox, approvals, reports, imports, org, integrations)
api_router.include_router(business_router, prefix="/biz", tags=["Business"])

# Include CA practice routes (dashboard, clients, compliance, tasks, review, doc-requests, queries, team, time, billing, reports)
api_router.include_router(ca_router, prefix="/ca", tags=["CA Practice"])

# Include console routes (super-user console)
api_router.include_router(console_router, prefix="/console", tags=["Console"])
