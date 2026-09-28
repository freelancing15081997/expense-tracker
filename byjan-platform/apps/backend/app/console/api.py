"""
Console API router
All super-user console endpoints (overview, issues, traces, sessions, jobs, integrations, flags, tenants, view-as)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime

from app.shared.database import get_db_session
from app.deps import get_current_user, require_super
from app.console.service import ConsoleService

router = APIRouter()


# ============================================================================
# D. Super-User Console (/v1/console)
# ============================================================================

@router.get("/overview")
async def get_console_overview(principal = Depends(require_super), db: AsyncSession = Depends(get_db_session)):
    """Console overview - tenants, active users, error rate, job health, service status"""
    service = ConsoleService(db)
    overview = await service.get_overview()
    return overview


@router.get("/issues")
async def get_console_issues(
    sev: Optional[str] = None,
    status: Optional[str] = None,
    module: Optional[str] = None,
    principal = Depends(require_super),
    db: AsyncSession = Depends(get_db_session),
):
    """List console issues"""
    service = ConsoleService(db)
    issues = await service.get_console_issues(sev=sev, status=status, module=module)
    return issues


@router.post("/issues/{issue_id}/actions/resolve")
async def resolve_issue(issue_id: str, request: dict, principal = Depends(require_super), db: AsyncSession = Depends(get_db_session)):
    """Resolve console issue"""
    service = ConsoleService(db)
    result = await service.resolve_issue(issue_id, request.get("resolution", ""), principal.user_id)
    if result.is_err():
        raise HTTPException(status_code=404, detail=result.unwrap_err())
    return result.unwrap()


@router.post("/issues/{issue_id}/actions/reopen")
async def reopen_issue(issue_id: str, principal = Depends(require_super), db: AsyncSession = Depends(get_db_session)):
    """Reopen console issue"""
    service = ConsoleService(db)
    result = await service.reopen_issue(issue_id)
    if result.is_err():
        raise HTTPException(status_code=404, detail=result.unwrap_err())
    return result.unwrap()


@router.get("/trace/{trace_id}")
async def get_trace(trace_id: str, principal = Depends(require_super), db: AsyncSession = Depends(get_db_session)):
    """Trace timeline across logs, audit, jobs"""
    service = ConsoleService(db)
    # TODO: Implement trace retrieval
    return {}


@router.get("/traces")
async def get_traces(
    principal = Depends(require_super),
    limit: int = 100,
    severity: Optional[str] = None,
    module: Optional[str] = None,
    integration: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db_session),
):
    """Get trace events with filters"""
    service = ConsoleService(db)
    events = await service.get_trace_events(
        limit=limit,
        severity=severity,
        module=module,
        integration=integration,
        from_date=from_date,
        to_date=to_date,
    )
    return {"events": events, "total": len(events)}


@router.get("/integration-health")
async def get_integration_health_console(principal = Depends(require_super), db: AsyncSession = Depends(get_db_session)):
    """Get integration health status"""
    service = ConsoleService(db)
    health = await service.get_integration_health()
    return health


@router.get("/sessions")
async def get_console_sessions(
    tenant_id: Optional[str] = None,
    user_id: Optional[str] = None,
    principal = Depends(require_super),
    db: AsyncSession = Depends(get_db_session),
):
    """List all sessions"""
    service = ConsoleService(db)
    sessions = await service.get_sessions(tenant_id=tenant_id, user_id=user_id)
    return sessions


@router.delete("/sessions/{session_id}")
async def delete_console_session(session_id: str, principal = Depends(require_super), db: AsyncSession = Depends(get_db_session)):
    """Delete session"""
    service = ConsoleService(db)
    # TODO: Implement session deletion
    return {"status": "ok"}


@router.get("/jobs")
async def get_console_jobs(
    status: Optional[str] = None,
    principal = Depends(require_super),
    db: AsyncSession = Depends(get_db_session),
):
    """List all jobs"""
    service = ConsoleService(db)
    jobs = await service.get_jobs(status=status)
    return jobs


@router.post("/jobs/{job_id}/actions/retry")
async def retry_job(job_id: str, principal = Depends(require_super), db: AsyncSession = Depends(get_db_session)):
    """Retry failed job"""
    service = ConsoleService(db)
    # TODO: Implement job retry
    return {"status": "ok"}


@router.post("/jobs/{job_id}/actions/cancel")
async def cancel_job(job_id: str, principal = Depends(require_super), db: AsyncSession = Depends(get_db_session)):
    """Cancel job"""
    service = ConsoleService(db)
    # TODO: Implement job cancellation
    return {"status": "ok"}


@router.get("/integrations")
async def get_console_integrations(principal = Depends(require_super), db: AsyncSession = Depends(get_db_session)):
    """Integration health per tenant and provider"""
    service = ConsoleService(db)
    # TODO: Implement integrations list
    return {}


@router.get("/flags")
async def get_console_flags(principal = Depends(require_super), db: AsyncSession = Depends(get_db_session)):
    """Platform flags"""
    service = ConsoleService(db)
    flags = await service.get_console_flags()
    return flags


@router.put("/flags/{key}")
async def update_console_flag(key: str, request: dict, principal = Depends(require_super), db: AsyncSession = Depends(get_db_session)):
    """Update platform flag"""
    service = ConsoleService(db)
    result = await service.update_console_flag(key, request.get("enabled", False), request.get("tenant_ids"))
    if result.is_err():
        raise HTTPException(status_code=400, detail=result.unwrap_err())
    return result.unwrap()


@router.get("/tenants")
async def get_console_tenants(principal = Depends(require_super), db: AsyncSession = Depends(get_db_session)):
    """List all tenants"""
    service = ConsoleService(db)
    tenants = await service.get_tenants()
    return tenants


@router.post("/tenants/{tenant_id}/actions/suspend")
async def suspend_tenant(tenant_id: str, principal = Depends(require_super), db: AsyncSession = Depends(get_db_session)):
    """Suspend tenant"""
    service = ConsoleService(db)
    result = await service.suspend_tenant(tenant_id)
    if result.is_err():
        raise HTTPException(status_code=400, detail=result.unwrap_err())
    return result.unwrap()


@router.post("/tenants/{tenant_id}/actions/restore")
async def restore_tenant(tenant_id: str, principal = Depends(require_super), db: AsyncSession = Depends(get_db_session)):
    """Restore tenant"""
    service = ConsoleService(db)
    result = await service.restore_tenant(tenant_id)
    if result.is_err():
        raise HTTPException(status_code=400, detail=result.unwrap_err())
    return result.unwrap()


@router.post("/view-as")
async def console_view_as(request: dict, principal = Depends(require_super)):
    """Console view-as - read-only token"""
    # TODO: Implement console view-as
    return {"token": "console_view_as_token"}
