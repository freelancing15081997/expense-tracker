"""
Platform service layer - auth, users, tenants, files, notifications, audit, etc.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
import structlog

from app.platform.domain.models import (
    User, Tenant, Membership, Role, Invite, Session, File, Notification,
    AuditLog, Job, UndoToken, WebhookSub, Export
)
from app.platform.infra.orm import (
    UserORM, TenantORM, MembershipORM, RoleORM, InviteORM,
    SessionORM, FileORM, NotificationORM, AuditLogORM, OutboxORM,
    JobORM, UndoTokenORM, IntegrationSecretORM, WebhookSubORM, ExportORM
)
from app.shared.ids import IdGen
from app.shared.types import Result
from app.shared.database import UnitOfWork
from app.shared.logging import log_security_event, log_business_event

log = structlog.get_logger(__name__)


class PlatformService:
    """Platform application service"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.uow = UnitOfWork(db)

    # ============================================================================
    # Auth & Sessions
    # ============================================================================

    async def exchange_firebase_token(self, id_token: str) -> Result[Dict[str, Any], str]:
        """Exchange Firebase ID token for session"""
        try:
            # TODO: Verify Firebase token
            # For now, create a test user
            user = User(
                id=IdGen.user_id(),
                firebase_uid="test_firebase_uid",
                email="test@example.com",
                name="Test User",
            )

            # Create session
            session = Session(
                id=IdGen.session_id(),
                user_id=user.id,
                device="test_device",
                ip="127.0.0.1",
                city="Test City",
                ua="test_ua",
            )

            # Generate tokens
            access_token = self._generate_access_token(user.id, session.id)
            refresh_token = self._generate_refresh_token(session.id)

            # Log security event
            log_security_event(
                user_id=str(user.id),
                action="auth.firebase_exchange",
                ip="127.0.0.1",
                details={"session_id": str(session.id)},
            )

            return Result.ok({
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "Bearer",
                "expires_in": 900,  # 15 minutes
            })
        except Exception as e:
            log.error("firebase_exchange_error", error=str(e))
            return Result.err("auth.exchange_failed")

    async def refresh_token(self, refresh_token: str) -> Result[Dict[str, Any], str]:
        """Refresh access token"""
        try:
            # TODO: Verify refresh token
            # For now, generate new tokens
            user_id = IdGen.user_id()
            session_id = IdGen.session_id()

            access_token = self._generate_access_token(user_id, session_id)
            new_refresh_token = self._generate_refresh_token(session_id)

            return Result.ok({
                "access_token": access_token,
                "refresh_token": new_refresh_token,
                "token_type": "Bearer",
                "expires_in": 900,
            })
        except Exception as e:
            log.error("refresh_token_error", error=str(e))
            return Result.err("auth.refresh_failed")

    def _generate_access_token(self, user_id: str, session_id: str) -> str:
        """Generate access token"""
        # TODO: Implement JWT generation
        return f"access_token_{user_id}_{session_id}"

    def _generate_refresh_token(self, session_id: str) -> str:
        """Generate refresh token"""
        # TODO: Implement refresh token generation
        return f"refresh_token_{session_id}"

    async def logout(self, session_id: str, user_id: str) -> Result[None, str]:
        """Logout session"""
        try:
            # TODO: Revoke session
            log_security_event(
                user_id=user_id,
                action="auth.logout",
                details={"session_id": session_id},
            )
            return Result.ok(None)
        except Exception as e:
            log.error("logout_error", error=str(e))
            return Result.err("auth.logout_failed")

    async def get_current_user(self, user_id: str) -> Optional[User]:
        """Get current user"""
        stmt = select(UserORM).where(UserORM.id == user_id)
        result = await self.db.execute(stmt)
        user_orm = result.scalar_one_or_none()

        if not user_orm:
            return None

        return User(
            id=str(user_orm.id),
            firebase_uid=user_orm.firebase_uid,
            email=user_orm.email,
            phone=user_orm.phone,
            name=user_orm.name,
            avatar_file_id=str(user_orm.avatar_file_id) if user_orm.avatar_file_id else None,
            lang=user_orm.lang,
            ui=user_orm.ui,
            sup=user_orm.sup,
            mfa_enabled=user_orm.mfa_enabled,
        )

    async def update_user(self, user_id: str, data: Dict[str, Any]) -> Result[User, str]:
        """Update user profile"""
        try:
            stmt = select(UserORM).where(UserORM.id == user_id)
            result = await self.db.execute(stmt)
            user_orm = result.scalar_one_or_none()

            if not user_orm:
                return Result.err("user.not_found")

            # Update fields
            if "name" in data:
                user_orm.name = data["name"]
            if "phone" in data:
                user_orm.phone = data["phone"]
            if "avatar_file_id" in data:
                user_orm.avatar_file_id = data["avatar_file_id"]
            if "lang" in data:
                user_orm.lang = data["lang"]
            if "ui" in data:
                user_orm.ui = data["ui"]

            await self.db.commit()

            # Log audit
            log_business_event(
                tenant_id="",  # TODO: Get tenant_id
                module="platform",
                action="user.update",
                entity_type="user",
                entity_id=user_id,
                details=data,
            )

            return Result.ok(self._user_orm_to_domain(user_orm))
        except Exception as e:
            await self.db.rollback()
            log.error("update_user_error", error=str(e))
            return Result.err("user.update_failed")

    async def get_sessions(self, user_id: str) -> List[Session]:
        """Get user sessions"""
        stmt = select(SessionORM).where(
            and_(
                SessionORM.user_id == user_id,
                SessionORM.revoked_at.is_(None),
            )
        ).order_by(SessionORM.last_seen_at.desc())

        result = await self.db.execute(stmt)
        sessions = result.scalars().all()

        return [self._session_orm_to_domain(session) for session in sessions]

    async def revoke_session(self, session_id: str, user_id: str) -> Result[None, str]:
        """Revoke session"""
        try:
            stmt = select(SessionORM).where(
                and_(
                    SessionORM.id == session_id,
                    SessionORM.user_id == user_id,
                )
            )
            result = await self.db.execute(stmt)
            session_orm = result.scalar_one_or_none()

            if not session_orm:
                return Result.err("session.not_found")

            session_orm.revoked_at = datetime.utcnow()
            await self.db.commit()

            # Log security event
            log_security_event(
                user_id=user_id,
                action="session.revoke",
                details={"session_id": session_id},
            )

            return Result.ok(None)
        except Exception as e:
            await self.db.rollback()
            log.error("revoke_session_error", error=str(e))
            return Result.err("session.revoke_failed")

    # ============================================================================
    # Tenants
    # ============================================================================

    async def get_tenant(self, tenant_id: str) -> Optional[Tenant]:
        """Get tenant"""
        stmt = select(TenantORM).where(TenantORM.id == tenant_id)
        result = await self.db.execute(stmt)
        tenant_orm = result.scalar_one_or_none()

        if not tenant_orm:
            return None

        return self._tenant_orm_to_domain(tenant_orm)

    async def create_tenant(self, data: Dict[str, Any]) -> Result[Tenant, str]:
        """Create tenant"""
        try:
            tenant_orm = TenantORM(
                id=IdGen.tenant_id(),
                name=data.get("name", ""),
                kind=data.get("kind", "company"),
                slug=data.get("slug"),
                status="active",
            )

            self.db.add(tenant_orm)
            await self.db.commit()

            # Log audit
            log_business_event(
                tenant_id=str(tenant_orm.id),
                module="platform",
                action="tenant.create",
                entity_type="tenant",
                entity_id=str(tenant_orm.id),
                details=data,
            )

            return Result.ok(self._tenant_orm_to_domain(tenant_orm))
        except Exception as e:
            await self.db.rollback()
            log.error("create_tenant_error", error=str(e))
            return Result.err("tenant.create_failed")

    async def get_memberships(self, tenant_id: str) -> List[Membership]:
        """Get tenant memberships"""
        stmt = select(MembershipORM).where(MembershipORM.tenant_id == tenant_id)
        result = await self.db.execute(stmt)
        memberships = result.scalars().all()

        return [self._membership_orm_to_domain(m) for m in memberships]

    async def invite_member(self, tenant_id: str, data: Dict[str, Any]) -> Result[Invite, str]:
        """Invite member to tenant"""
        try:
            invite_orm = InviteORM(
                id=IdGen.invite_id(),
                tenant_id=tenant_id,
                email=data.get("email"),
                phone=data.get("phone"),
                role_id=data.get("role_id"),
                token=IdGen.invite_token(),
                expires_at=datetime.utcnow() + timedelta(days=7),
                invited_by=data.get("invited_by"),
            )

            self.db.add(invite_orm)
            await self.db.commit()

            # Log audit
            log_business_event(
                tenant_id=tenant_id,
                module="platform",
                action="invite.create",
                entity_type="invite",
                entity_id=str(invite_orm.id),
                details=data,
            )

            return Result.ok(self._invite_orm_to_domain(invite_orm))
        except Exception as e:
            await self.db.rollback()
            log.error("invite_member_error", error=str(e))
            return Result.err("invite.create_failed")

    # ============================================================================
    # Files
    # ============================================================================

    async def create_file_upload(self, tenant_id: str, data: Dict[str, Any]) -> Result[File, str]:
        """Create file upload"""
        try:
            file_orm = FileORM(
                id=IdGen.file_id(),
                tenant_id=tenant_id,
                kind=data.get("kind", "document"),
                original_name=data.get("original_name", ""),
                mime=data.get("mime", ""),
                size=data.get("size", 0),
                hash=data.get("hash", ""),
                s3_key=f"{tenant_id}/{IdGen.file_id()}.{data.get('original_name', '').split('.')[-1]}",
            )

            self.db.add(file_orm)
            await self.db.commit()

            return Result.ok(self._file_orm_to_domain(file_orm))
        except Exception as e:
            await self.db.rollback()
            log.error("create_file_error", error=str(e))
            return Result.err("file.create_failed")

    async def get_file(self, file_id: str) -> Optional[File]:
        """Get file"""
        stmt = select(FileORM).where(FileORM.id == file_id)
        result = await self.db.execute(stmt)
        file_orm = result.scalar_one_or_none()

        if not file_orm:
            return None

        return self._file_orm_to_domain(file_orm)

    # ============================================================================
    # Audit & Logging
    # ============================================================================

    async def get_audit_log(self, tenant_id: str, filters: Dict[str, Any]) -> List[AuditLog]:
        """Get audit log"""
        stmt = select(AuditLogORM).where(AuditLogORM.tenant_id == tenant_id)

        if "entity_type" in filters:
            stmt = stmt.where(AuditLogORM.entity_type == filters["entity_type"])
        if "action" in filters:
            stmt = stmt.where(AuditLogORM.action == filters["action"])

        stmt = stmt.order_by(AuditLogORM.created_at.desc())

        result = await self.db.execute(stmt)
        audit_entries = result.scalars().all()

        return [self._audit_log_orm_to_domain(entry) for entry in audit_entries]

    async def create_audit_log(self, audit: AuditLog) -> None:
        """Create audit log entry"""
        audit_orm = AuditLogORM(
            id=audit.id,
            tenant_id=audit.tenant_id,
            actor_id=audit.actor_id,
            action=audit.action,
            entity_type=audit.entity_type,
            entity_id=audit.entity_id,
            diff=audit.diff,
            ip=audit.ip,
            ua=audit.ua,
            request_id=audit.request_id,
            prev_hash=audit.prev_hash,
        )

        self.db.add(audit_orm)
        await self.db.commit()

    async def create_outbox_event(self, event: Dict[str, Any]) -> None:
        """Create outbox event"""
        outbox_orm = OutboxORM(
            id=IdGen.outbox_id(),
            tenant_id=event["tenant_id"],
            type=event["type"],
            aggregate_type=event["aggregate_type"],
            aggregate_id=event["aggregate_id"],
            payload=event["payload"],
        )

        self.db.add(outbox_orm)
        await self.db.commit()

    # ============================================================================
    # Helper Methods
    # ============================================================================

    def _user_orm_to_domain(self, user_orm: UserORM) -> User:
        """Convert ORM to domain model"""
        return User(
            id=str(user_orm.id),
            firebase_uid=user_orm.firebase_uid,
            email=user_orm.email,
            phone=user_orm.phone,
            name=user_orm.name,
            avatar_file_id=str(user_orm.avatar_file_id) if user_orm.avatar_file_id else None,
            lang=user_orm.lang,
            ui=user_orm.ui,
            sup=user_orm.sup,
            mfa_enabled=user_orm.mfa_enabled,
        )

    def _tenant_orm_to_domain(self, tenant_orm: TenantORM) -> Tenant:
        """Convert ORM to domain model"""
        return Tenant(
            id=str(tenant_orm.id),
            name=tenant_orm.name,
            kind=tenant_orm.kind,
            slug=tenant_orm.slug,
            status=tenant_orm.status,
        )

    def _membership_orm_to_domain(self, membership_orm: MembershipORM) -> Membership:
        """Convert ORM to domain model"""
        return Membership(
            id=str(membership_orm.id),
            tenant_id=str(membership_orm.tenant_id),
            user_id=str(membership_orm.user_id),
            role_id=str(membership_orm.role_id) if membership_orm.role_id else None,
            status=membership_orm.status,
        )

    def _invite_orm_to_domain(self, invite_orm: InviteORM) -> Invite:
        """Convert ORM to domain model"""
        return Invite(
            id=str(invite_orm.id),
            tenant_id=str(invite_orm.tenant_id),
            email=invite_orm.email,
            phone=invite_orm.phone,
            role_id=str(invite_orm.role_id),
            token=invite_orm.token,
            expires_at=invite_orm.expires_at,
            accepted_at=invite_orm.accepted_at,
            revoked_at=invite_orm.revoked_at,
            invited_by=str(invite_orm.invited_by),
        )

    def _session_orm_to_domain(self, session_orm: SessionORM) -> Session:
        """Convert ORM to domain model"""
        return Session(
            id=str(session_orm.id),
            user_id=str(session_orm.user_id),
            device=session_orm.device,
            ip=session_orm.ip,
            city=session_orm.city,
            ua=session_orm.ua,
            refresh_token_hash=session_orm.refresh_token_hash,
            refresh_expires_at=session_orm.refresh_expires_at,
            last_seen_at=session_orm.last_seen_at,
            revoked_at=session_orm.revoked_at,
        )

    def _file_orm_to_domain(self, file_orm: FileORM) -> File:
        """Convert ORM to domain model"""
        return File(
            id=str(file_orm.id),
            tenant_id=str(file_orm.tenant_id),
            kind=file_orm.kind,
            original_name=file_orm.original_name,
            mime=file_orm.mime,
            size=file_orm.size,
            hash=file_orm.hash,
            encrypted=file_orm.encrypted,
            scan_status=file_orm.scan_status,
            version=file_orm.version,
            s3_key=file_orm.s3_key,
        )

    def _audit_log_orm_to_domain(self, audit_orm: AuditLogORM) -> AuditLog:
        """Convert ORM to domain model"""
        return AuditLog(
            id=str(audit_orm.id),
            tenant_id=str(audit_orm.tenant_id),
            actor_id=str(audit_orm.actor_id),
            action=audit_orm.action,
            entity_type=audit_orm.entity_type,
            entity_id=str(audit_orm.entity_id),
            diff=audit_orm.diff,
            ip=audit_orm.ip,
            ua=audit_orm.ua,
            request_id=str(audit_orm.request_id) if audit_orm.request_id else None,
            prev_hash=audit_orm.prev_hash,
            created_at=audit_orm.created_at,
        )
