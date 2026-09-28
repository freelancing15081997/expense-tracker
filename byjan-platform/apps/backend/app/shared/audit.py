"""
Audit logging utilities
"""

import hashlib
import json
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.platform.infra.orm import AuditLogORM
from app.shared.ids import UUIDv7

log = structlog.get_logger(__name__)


class AuditLogger:
    """Audit logger with hash chain verification"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        tenant_id: str,
        actor_id: str,
        action: str,
        entity_type: str,
        entity_id: str,
        diff: Optional[Dict[str, Any]] = None,
        act_as: Optional[str] = None,
        ip: Optional[str] = None,
        ua: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> None:
        """Log audit event with hash chain"""
        # Get previous hash for chain
        prev_hash = await self._get_latest_hash(tenant_id)

        # Create audit log entry
        entry = {
            "id": UUIDv7.generate(),
            "tenant_id": tenant_id,
            "actor_id": actor_id,
            "act_as": act_as,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "diff": diff or {},
            "ip": ip,
            "ua": ua,
            "request_id": request_id,
            "prev_hash": prev_hash,
            "created_at": datetime.utcnow().isoformat(),
        }

        # Calculate hash
        entry_hash = self._calculate_hash(entry)
        entry["hash"] = entry_hash

        # Insert into database
        orm = AuditLogORM(**entry)
        self.db.add(orm)

        log.info(
            "audit_log_created",
            tenant_id=tenant_id,
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            hash=entry_hash,
        )

    async def _get_latest_hash(self, tenant_id: str) -> Optional[str]:
        """Get latest audit hash for chain"""
        from sqlalchemy import select
        stmt = (
            select(AuditLogORM.hash)
            .where(AuditLogORM.tenant_id == tenant_id)
            .order_by(AuditLogORM.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def _calculate_hash(self, entry: Dict[str, Any]) -> str:
        """Calculate SHA-256 hash of entry"""
        # Create canonical representation
        data = {
            "tenant_id": entry["tenant_id"],
            "actor_id": entry["actor_id"],
            "action": entry["action"],
            "entity_type": entry["entity_type"],
            "entity_id": entry["entity_id"],
            "diff": entry["diff"],
            "ip": entry["ip"],
            "ua": entry["ua"],
            "request_id": entry["request_id"],
            "prev_hash": entry["prev_hash"],
            "created_at": entry["created_at"],
        }

        # Serialize to JSON
        json_str = json.dumps(data, sort_keys=True, default=str)

        # Calculate hash
        return hashlib.sha256(json_str.encode()).hexdigest()

    async def verify_chain(self, tenant_id: str, limit: int = 1000) -> bool:
        """Verify audit log chain integrity"""
        from sqlalchemy import select
        stmt = (
            select(AuditLogORM)
            .where(AuditLogORM.tenant_id == tenant_id)
            .order_by(AuditLogORM.created_at)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        entries = result.scalars().all()

        if not entries:
            return True  # No entries, chain is valid

        prev_hash = None
        for entry in entries:
            # Verify hash
            calculated = self._calculate_hash({
                "id": str(entry.id),
                "tenant_id": str(entry.tenant_id),
                "actor_id": str(entry.actor_id),
                "act_as": str(entry.act_as) if entry.act_as else None,
                "action": entry.action,
                "entity_type": entry.entity_type,
                "entity_id": str(entry.entity_id),
                "diff": entry.diff or {},
                "ip": entry.ip,
                "ua": entry.ua,
                "request_id": entry.request_id,
                "prev_hash": entry.prev_hash,
                "created_at": entry.created_at.isoformat(),
            })

            if calculated != entry.hash:
                log.error(
                    "audit_chain_broken",
                    tenant_id=tenant_id,
                    entry_id=str(entry.id),
                    expected=entry.hash,
                    calculated=calculated,
                )
                return False

            prev_hash = entry.hash

        return True
