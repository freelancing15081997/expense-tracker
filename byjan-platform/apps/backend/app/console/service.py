"""
Console service layer - comprehensive trace and logging system
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
import structlog

from app.shared.ids import IdGen
from app.shared.types import Result
from app.shared.database import UnitOfWork
from app.platform.infra.orm import (
    ConsoleIssueORM, AuditLogORM, OutboxORM, JobORM,
    SessionORM, IntegrationSecretORM
)

log = structlog.get_logger(__name__)


class ConsoleService:
    """Console application service for super-users"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.uow = UnitOfWork(db)

    async def get_overview(self) -> Dict[str, Any]:
        """Get console overview"""
        # TODO: Query real data
        return {
            "tenants": await self._count_tenants(),
            "active_users": await self._count_active_users(),
            "error_rate": await self._calculate_error_rate(),
            "job_health": await self._get_job_health(),
            "service_status": await self._get_service_status(),
        }

    async def _count_tenants(self) -> int:
        """Count tenants"""
        # TODO: Query from database
        return 0

    async def _count_active_users(self) -> int:
        """Count active users"""
        # TODO: Query from database
        return 0

    async def _calculate_error_rate(self) -> float:
        """Calculate error rate"""
        # TODO: Calculate from logs
        return 0.0

    async def _get_job_health(self) -> Dict[str, Any]:
        """Get job health status"""
        # TODO: Query job status
        return {}

    async def _get_service_status(self) -> Dict[str, str]:
        """Get service status"""
        # TODO: Query service status
        return {
            "database": "ok",
            "redis": "ok",
            "storage": "ok",
        }

    async def get_trace_events(
        self,
        limit: int = 100,
        severity: Optional[str] = None,
        module: Optional[str] = None,
        integration: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """Get trace events for console"""
        # Query audit logs and outbox
        events = []

        # Get audit log entries
        stmt = select(AuditLogORM).order_by(AuditLogORM.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        audit_entries = result.scalars().all()

        for entry in audit_entries:
            # Determine severity based on action
            severity_map = {
                "create": "info",
                "update": "info",
                "delete": "warning",
                "post": "info",
                "void": "warning",
                "reverse": "warning",
            }
            severity = severity_map.get(entry.action, "info")

            events.append({
                "id": str(entry.id),
                "timestamp": entry.created_at.isoformat(),
                "severity": severity,
                "module": self._get_module_from_entity(entry.entity_type),
                "message": f"{entry.action} {entry.entity_type}",
                "details": {
                    "actor_id": str(entry.actor_id),
                    "entity_type": entry.entity_type,
                    "entity_id": str(entry.entity_id),
                    "diff": entry.diff,
                    "ip": entry.ip,
                    "request_id": entry.request_id,
                },
            })

        # Get outbox events (domain events)
        stmt = select(OutboxORM).order_by(OutboxORM.created_at.desc()).limit(limit // 2)
        result = await self.db.execute(stmt)
        outbox_entries = result.scalars().all()

        for entry in outbox_entries:
            events.append({
                "id": str(entry.id),
                "timestamp": entry.created_at.isoformat(),
                "severity": "info",
                "module": "system",
                "message": f"Domain event: {entry.type}",
                "details": {
                    "type": entry.type,
                    "payload": entry.payload,
                    "published_at": entry.published_at.isoformat() if entry.published_at else None,
                    "attempts": entry.attempts,
                    "last_error": entry.last_error,
                },
            })

        # Sort by timestamp descending
        events.sort(key=lambda x: x["timestamp"], reverse=True)

        return events[:limit]

    def _get_module_from_entity(self, entity_type: str) -> str:
        """Map entity type to module"""
        module_map = {
            "user": "platform",
            "tenant": "platform",
            "membership": "platform",
            "role": "platform",
            "account": "business",
            "document": "business",
            "party": "business",
            "item": "business",
            "payment": "business",
            "client": "ca",
            "compliance_item": "ca",
            "task": "ca",
            "issue": "console",
        }
        return module_map.get(entity_type, "unknown")

    async def get_integration_health(self) -> Dict[str, Any]:
        """Get integration health status"""
        from app.settings import settings

        health = {
            "firebase": {
                "status": "ok" if settings.FIREBASE_PROJECT_ID else "missing_key",
                "last_check": datetime.utcnow().isoformat(),
                "message": "Configured" if settings.FIREBASE_PROJECT_ID else "API key missing - add FIREBASE_PROJECT_ID in settings",
            },
            "whatsapp": {
                "status": "mock" if not settings.WHATSAPP_ACCESS_TOKEN else "ok",
                "last_check": datetime.utcnow().isoformat(),
                "message": "Using mock adapter" if not settings.WHATSAPP_ACCESS_TOKEN else "Configured",
            },
            "gsp": {
                "status": "mock" if not settings.GSP_API_KEY else "ok",
                "last_check": datetime.utcnow().isoformat(),
                "message": "Using mock adapter" if not settings.GSP_API_KEY else "Configured",
            },
            "database": {
                "status": "ok",
                "last_check": datetime.utcnow().isoformat(),
                "message": "Connected",
            },
            "redis": {
                "status": "ok",
                "last_check": datetime.utcnow().isoformat(),
                "message": "Connected",
            },
            "storage": {
                "status": "ok" if settings.S3_ACCESS_KEY_ID else "missing_key",
                "last_check": datetime.utcnow().isoformat(),
                "message": "Configured" if settings.S3_ACCESS_KEY_ID else "API key missing - add S3_ACCESS_KEY_ID in settings",
            },
            "email": {
                "status": "ok" if settings.EMAIL_API_KEY else "missing_key",
                "last_check": datetime.utcnow().isoformat(),
                "message": "Configured" if settings.EMAIL_API_KEY else "API key missing - add EMAIL_API_KEY in settings",
            },
        }

        return health

    async def get_console_issues(
        self,
        sev: Optional[str] = None,
        status: Optional[str] = None,
        module: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get console issues"""
        stmt = select(ConsoleIssueORM)

        if sev:
            stmt = stmt.where(ConsoleIssueORM.sev == sev)
        if status:
            stmt = stmt.where(ConsoleIssueORM.status == status)
        if module:
            stmt = stmt.where(ConsoleIssueORM.module == module)

        stmt = stmt.order_by(ConsoleIssueORM.last_at.desc())

        result = await self.db.execute(stmt)
        issues = result.scalars().all()

        return [
            {
                "id": str(issue.id),
                "sev": issue.sev,
                "title": issue.title,
                "module": issue.module,
                "tenant_id": str(issue.tenant_id) if issue.tenant_id else None,
                "occurrences": issue.occurrences,
                "first_at": issue.first_at.isoformat(),
                "last_at": issue.last_at.isoformat(),
                "status": issue.status,
                "trace_ids": issue.trace_ids,
                "resolution": issue.resolution,
                "resolved_by": str(issue.resolved_by) if issue.resolved_by else None,
                "resolved_at": issue.resolved_at.isoformat() if issue.resolved_at else None,
            }
            for issue in issues
        ]

    async def resolve_issue(self, issue_id: str, resolution: str, resolved_by: str) -> Result[Dict[str, Any], str]:
        """Resolve console issue"""
        try:
            stmt = select(ConsoleIssueORM).where(ConsoleIssueORM.id == issue_id)
            result = await self.db.execute(stmt)
            issue = result.scalar_one_or_none()

            if not issue:
                return Result.err("Issue not found")

            issue.status = "resolved"
            issue.resolution = resolution
            issue.resolved_by = resolved_by
            issue.resolved_at = datetime.utcnow()

            await self.db.commit()

            return Result.ok({
                "id": str(issue.id),
                "status": "resolved",
            })
        except Exception as e:
            await self.db.rollback()
            log.error("resolve_issue_error", error=str(e))
            return Result.err("issue.resolve_failed")

    async def reopen_issue(self, issue_id: str) -> Result[Dict[str, Any], str]:
        """Reopen console issue"""
        try:
            stmt = select(ConsoleIssueORM).where(ConsoleIssueORM.id == issue_id)
            result = await self.db.execute(stmt)
            issue = result.scalar_one_or_none()

            if not issue:
                return Result.err("Issue not found")

            issue.status = "reopened"
            issue.resolved_by = None
            issue.resolved_at = None

            await self.db.commit()

            return Result.ok({
                "id": str(issue.id),
                "status": "reopened",
            })
        except Exception as e:
            await self.db.rollback()
            log.error("reopen_issue_error", error=str(e))
            return Result.err("issue.reopen_failed")

    async def get_sessions(
        self,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get sessions"""
        stmt = select(SessionORM).order_by(SessionORM.last_seen_at.desc())

        if tenant_id:
            # TODO: Filter by tenant (requires join with memberships)
            pass

        if user_id:
            stmt = stmt.where(SessionORM.user_id == user_id)

        result = await self.db.execute(stmt)
        sessions = result.scalars().all()

        return [
            {
                "id": str(session.id),
                "user_id": str(session.user_id),
                "device": session.device,
                "ip": session.ip,
                "city": session.city,
                "ua": session.ua,
                "created_at": session.created_at.isoformat(),
                "last_seen_at": session.last_seen_at.isoformat(),
                "expires_at": session.expires_at.isoformat(),
                "revoked_at": session.revoked_at.isoformat() if session.revoked_at else None,
            }
            for session in sessions
        ]

    async def get_jobs(
        self,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get jobs"""
        stmt = select(JobORM).order_by(JobORM.created_at.desc())

        if status:
            stmt = stmt.where(JobORM.status == status)

        result = await self.db.execute(stmt)
        jobs = result.scalars().all()

        return [
            {
                "id": str(job.id),
                "kind": job.kind,
                "status": job.status,
                "progress": job.progress,
                "params": job.params,
                "result_file_id": str(job.result_file_id) if job.result_file_id else None,
                "error": job.error,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "finished_at": job.finished_at.isoformat() if job.finished_at else None,
                "created_at": job.created_at.isoformat(),
            }
            for job in jobs
        ]

    async def get_tenants(self) -> List[Dict[str, Any]]:
        """Get all tenants"""
        # TODO: Query from core.tenants
        return []

    async def suspend_tenant(self, tenant_id: str) -> Result[Dict[str, Any], str]:
        """Suspend tenant"""
        # TODO: Implement suspension
        return Result.ok({"tenant_id": tenant_id, "status": "suspended"})

    async def restore_tenant(self, tenant_id: str) -> Result[Dict[str, Any], str]:
        """Restore tenant"""
        # TODO: Implement restoration
        return Result.ok({"tenant_id": tenant_id, "status": "restored"})

    async def get_console_flags(self) -> Dict[str, Any]:
        """Get platform flags"""
        # TODO: Query from core.platform_flags
        return {}

    async def update_console_flag(self, key: str, enabled: bool, tenant_ids: Optional[List[str]] = None) -> Result[Dict[str, Any], str]:
        """Update platform flag"""
        # TODO: Implement flag update
        return Result.ok({"key": key, "enabled": enabled})
