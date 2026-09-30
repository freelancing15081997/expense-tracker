"""
Platform service layer - auth, users, tenants, files, notifications, audit, etc.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
import structlog

from app.platform.domain.models import (
    User, Tenant, Membership, Role, Invite, Session, File, Notification,
    AuditLog, Job, UndoToken, WebhookSub, Export, Principal,
)
from app.platform.infra.orm import (
    UserORM, TenantORM, MembershipORM, RoleORM, InviteORM,
    SessionORM, FileORM, NotificationORM, AuditLogORM, OutboxORM,
    JobORM, UndoTokenORM, IntegrationSecretORM, WebhookSubORM, ExportORM
)
from app.platform.infra.firebase import verify_id_token, FirebaseVerifyError
from app.shared.ids import IdGen
from app.shared.types import Result
from app.shared.database import UnitOfWork
from app.shared.logging import log_security_event, log_business_event
from app.shared.auth import (
    create_access_token,
    create_refresh_token,
    hash_refresh_token,
)
from app.settings import settings

log = structlog.get_logger(__name__)


def _as_uuid(value: str) -> UUID:
    return UUID(str(value))


class PlatformService:
    """Platform application service"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.uow = UnitOfWork(db)

    # ============================================================================
    # Auth & Sessions
    # ============================================================================

    async def firebase_exchange(
        self,
        id_token: str,
        *,
        name: Optional[str] = None,
        ip: Optional[str] = None,
        ua: Optional[str] = None,
    ) -> Result[Dict[str, Any], str]:
        """Verify Firebase ID token → upsert user/tenant → issue session tokens."""
        try:
            claims = verify_id_token(id_token)
        except FirebaseVerifyError:
            return Result.err("auth.invalid_firebase_token")

        try:
            firebase_uid = claims["uid"]
            email = claims.get("email")
            display_name = name or claims.get("name") or (email.split("@")[0] if email else "User")

            stmt = select(UserORM).where(UserORM.firebase_uid == firebase_uid)
            result = await self.db.execute(stmt)
            user_orm = result.scalar_one_or_none()

            if not user_orm and email:
                # Link existing email row if created earlier
                stmt = select(UserORM).where(UserORM.email == email)
                result = await self.db.execute(stmt)
                user_orm = result.scalar_one_or_none()
                if user_orm and not user_orm.firebase_uid:
                    user_orm.firebase_uid = firebase_uid

            if not user_orm:
                user_orm = UserORM(
                    id=_as_uuid(IdGen.user_id()),
                    firebase_uid=firebase_uid,
                    email=email,
                    name=display_name,
                    phone_enc=claims.get("phone_number"),
                    status="active",
                )
                self.db.add(user_orm)
                await self.db.flush()
            else:
                if display_name and (not user_orm.name or user_orm.name != display_name):
                    if name or not user_orm.name:
                        user_orm.name = display_name
                if email and not user_orm.email:
                    user_orm.email = email

            tenant_id, role_name = await self._ensure_business_tenant(user_orm, display_name)
            tokens = await self._issue_session(
                user_orm,
                tenant_id=tenant_id,
                role_id=None,
                ip=ip,
                ua=ua,
            )
            await self.db.commit()

            log_security_event(
                user_id=str(user_orm.id),
                action="auth.firebase_exchange",
                ip=ip or "",
                details={"session_id": tokens["session_id"], "tenant_id": tenant_id},
            )
            return Result.ok(tokens)
        except Exception as e:
            await self.db.rollback()
            log.error("firebase_exchange_error", error=str(e))
            return Result.err("auth.exchange_failed")

    # Alias used by older call sites
    async def exchange_firebase_token(self, id_token: str, **kwargs) -> Result[Dict[str, Any], str]:
        return await self.firebase_exchange(id_token, **kwargs)

    async def _ensure_business_tenant(self, user_orm: UserORM, display_name: str) -> tuple[str, str]:
        """Return (tenant_id, role_name), creating a personal business tenant if needed."""
        stmt = (
            select(MembershipORM, TenantORM)
            .join(TenantORM, TenantORM.id == MembershipORM.tenant_id)
            .where(
                MembershipORM.user_id == user_orm.id,
                MembershipORM.status == "active",
            )
            .order_by(MembershipORM.created_at.asc())
        )
        result = await self.db.execute(stmt)
        row = result.first()
        if row:
            membership, tenant = row
            role_name = "Owner"
            if membership.role_id:
                role = await self.db.get(RoleORM, membership.role_id)
                if role:
                    role_name = role.name or "Owner"
            return str(tenant.id), role_name

        tenant_id = _as_uuid(IdGen.tenant_id())
        role_id = _as_uuid(IdGen.user_id())
        biz_name = f"{(display_name or 'My').split(' ')[0]}'s business"
        tenant = TenantORM(
            id=tenant_id,
            name=biz_name,
            kind="business",
            status="active",
            settings={},
        )
        role = RoleORM(
            id=role_id,
            tenant_id=tenant_id,
            name="Owner",
            system=True,
            locked=False,
            limits={},
            perm_version=1,
        )
        membership = MembershipORM(
            tenant_id=tenant_id,
            user_id=user_orm.id,
            role_id=role_id,
            kind="member",
            status="active",
        )
        self.db.add(tenant)
        self.db.add(role)
        self.db.add(membership)
        await self.db.flush()
        return str(tenant_id), "Owner"

    async def _issue_session(
        self,
        user_orm: UserORM,
        *,
        tenant_id: Optional[str],
        role_id: Optional[str],
        ip: Optional[str],
        ua: Optional[str],
        family_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        session_id = _as_uuid(IdGen.session_id())
        refresh_plain = create_refresh_token()
        refresh_hash = hash_refresh_token(refresh_plain)
        expires = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

        session = SessionORM(
            id=session_id,
            user_id=user_orm.id,
            family_id=family_id or session_id,
            device=(ua or "")[:255] or None,
            ip=ip,
            ua=ua,
            refresh_hash=refresh_hash,
            expires_at=expires,
            ver=1,
        )
        self.db.add(session)
        await self.db.flush()

        principal = Principal(
            user_id=str(user_orm.id),
            tenant_id=tenant_id,
            role_id=role_id,
            amr=["firebase"],
            mfa=bool(user_orm.mfa_secret_enc),
            auth_time=datetime.utcnow(),
            session_id=str(session_id),
            is_super=bool(user_orm.sup),
        )
        access = create_access_token(principal)
        return {
            "access_token": access,
            "refresh_token": refresh_plain,
            "token_type": "bearer",
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "session_id": str(session_id),
            "user_id": str(user_orm.id),
            "tenant_id": tenant_id,
        }

    async def refresh_token(self, refresh_token: str) -> Result[Dict[str, Any], str]:
        """Rotate refresh token and issue a new access token."""
        if not refresh_token:
            return Result.err("auth.refresh_missing")

        try:
            token_hash = hash_refresh_token(refresh_token)
            stmt = select(SessionORM).where(SessionORM.refresh_hash == token_hash)
            result = await self.db.execute(stmt)
            session_orm = result.scalar_one_or_none()

            if not session_orm:
                # Possible reuse of an already-rotated token — revoke family if we can
                return Result.err("auth.refresh_reused")

            if session_orm.revoked_at is not None:
                return Result.err("auth.refresh_revoked")

            expires_at = session_orm.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < datetime.now(timezone.utc):
                session_orm.revoked_at = datetime.now(timezone.utc)
                await self.db.commit()
                return Result.err("auth.refresh_expired")

            user_orm = await self.db.get(UserORM, session_orm.user_id)
            if not user_orm:
                return Result.err("auth.refresh_failed")

            # Revoke current session (rotation)
            session_orm.revoked_at = datetime.now(timezone.utc)
            await self.db.flush()

            tenant_id, _ = await self._ensure_business_tenant(user_orm, user_orm.name or "User")
            tokens = await self._issue_session(
                user_orm,
                tenant_id=tenant_id,
                role_id=None,
                ip=session_orm.ip,
                ua=session_orm.ua,
                family_id=session_orm.family_id or session_orm.id,
            )
            await self.db.commit()
            return Result.ok(tokens)
        except Exception as e:
            await self.db.rollback()
            log.error("refresh_token_error", error=str(e))
            return Result.err("auth.refresh_failed")

    async def logout(self, session_id: str, user_id: str) -> Result[None, str]:
        """Revoke the current session."""
        try:
            if session_id:
                stmt = select(SessionORM).where(
                    and_(
                        SessionORM.id == _as_uuid(session_id),
                        SessionORM.user_id == _as_uuid(user_id),
                    )
                )
                result = await self.db.execute(stmt)
                session_orm = result.scalar_one_or_none()
                if session_orm and session_orm.revoked_at is None:
                    session_orm.revoked_at = datetime.now(timezone.utc)
                    await self.db.commit()

            log_security_event(
                user_id=user_id,
                action="auth.logout",
                details={"session_id": session_id},
            )
            return Result.ok(None)
        except Exception as e:
            await self.db.rollback()
            log.error("logout_error", error=str(e))
            return Result.err("auth.logout_failed")

    async def get_me(self, user_id: str) -> Result[Dict[str, Any], str]:
        """Profile + tenants for /v1/me."""
        try:
            user_orm = await self.db.get(UserORM, _as_uuid(user_id))
            if not user_orm:
                return Result.err("user.not_found")

            stmt = (
                select(MembershipORM, TenantORM, RoleORM)
                .join(TenantORM, TenantORM.id == MembershipORM.tenant_id)
                .outerjoin(RoleORM, RoleORM.id == MembershipORM.role_id)
                .where(
                    MembershipORM.user_id == user_orm.id,
                    MembershipORM.status == "active",
                )
            )
            result = await self.db.execute(stmt)
            tenants = []
            for membership, tenant, role in result.all():
                tenants.append({
                    "id": str(tenant.id),
                    "name": tenant.name,
                    "kind": tenant.kind,
                    "role": (role.name if role else "Member"),
                    "role_id": str(membership.role_id) if membership.role_id else None,
                })

            sess_stmt = select(func.count()).select_from(SessionORM).where(
                and_(
                    SessionORM.user_id == user_orm.id,
                    SessionORM.revoked_at.is_(None),
                )
            )
            sess_count = (await self.db.execute(sess_stmt)).scalar() or 0

            return Result.ok({
                "id": str(user_orm.id),
                "firebase_uid": user_orm.firebase_uid or "",
                "email": user_orm.email,
                "phone": user_orm.phone_enc,
                "name": user_orm.name,
                "lang": user_orm.lang or "en",
                "ui": user_orm.ui or {},
                "sup": bool(user_orm.sup),
                "mfa_enabled": bool(user_orm.mfa_secret_enc),
                "tenants": tenants,
                "session_timeout_min": 30,
                "other_sessions": max(0, int(sess_count) - 1),
            })
        except Exception as e:
            log.error("get_me_error", error=str(e))
            return Result.err("user.not_found")

    async def get_current_user(self, user_id: str) -> Optional[User]:
        """Get current user (domain-ish dict via ORM)."""
        try:
            user_orm = await self.db.get(UserORM, _as_uuid(user_id))
        except Exception:
            return None
        if not user_orm:
            return None
        return self._user_orm_to_domain(user_orm)

    async def user_is_tenant_member(self, user_id: str, tenant_id: str) -> bool:
        stmt = select(MembershipORM.user_id).where(
            and_(
                MembershipORM.user_id == _as_uuid(user_id),
                MembershipORM.tenant_id == _as_uuid(tenant_id),
                MembershipORM.status == "active",
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() is not None

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
                user_orm.phone_enc = data["phone"]
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
                kind=data.get("kind", "business"),
                status="active",
                settings=data.get("settings") or {},
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
            firebase_uid=user_orm.firebase_uid or "",
            email=user_orm.email,
            phone_enc=user_orm.phone_enc,
            phone_bidx=user_orm.phone_bidx,
            name=user_orm.name,
            lang=user_orm.lang or "en",
            ui=user_orm.ui or {},
            sup=bool(user_orm.sup),
            mfa_secret_enc=user_orm.mfa_secret_enc,
        )

    def _tenant_orm_to_domain(self, tenant_orm: TenantORM) -> Tenant:
        """Convert ORM to domain model"""
        from app.platform.domain.models import TenantKind
        kind = tenant_orm.kind
        if isinstance(kind, str):
            try:
                kind = TenantKind(kind if kind != "company" else "business")
            except ValueError:
                kind = TenantKind.BUSINESS
        return Tenant(
            id=str(tenant_orm.id),
            name=tenant_orm.name,
            kind=kind,
            legal=tenant_orm.legal,
            gstin=tenant_orm.gstin,
            state_code=tenant_orm.state_code,
            fy_start_month=tenant_orm.fy_start_month or 4,
            lang=tenant_orm.lang or "en",
            settings=tenant_orm.settings or {},
            status=tenant_orm.status or "active",
            deleted_at=tenant_orm.deleted_at,
        )

    def _membership_orm_to_domain(self, membership_orm: MembershipORM) -> Membership:
        """Convert ORM to domain model"""
        from app.platform.domain.models import MembershipKind
        kind_raw = membership_orm.kind or "member"
        try:
            kind = MembershipKind(kind_raw)
        except ValueError:
            kind = MembershipKind.MEMBER
        return Membership(
            tenant_id=str(membership_orm.tenant_id),
            user_id=str(membership_orm.user_id),
            role_id=str(membership_orm.role_id) if membership_orm.role_id else None,
            kind=kind,
            org_unit_ids=[str(oid) for oid in (membership_orm.org_unit_ids or [])],
            status=membership_orm.status,
        )

    def _invite_orm_to_domain(self, invite_orm: InviteORM) -> Invite:
        """Convert ORM to domain model"""
        status = "pending"
        if invite_orm.accepted_at is not None:
            status = "accepted"
        elif invite_orm.revoked_at is not None:
            status = "revoked"
        return Invite(
            id=str(invite_orm.id),
            tenant_id=str(invite_orm.tenant_id),
            email=invite_orm.email or "",
            role_id=str(invite_orm.role_id) if invite_orm.role_id else None,
            status=status,
        )

    def _session_orm_to_domain(self, session_orm: SessionORM) -> Session:
        """Convert ORM to domain model"""
        return Session(
            id=str(session_orm.id),
            user_id=str(session_orm.user_id),
            family_id=str(session_orm.family_id) if session_orm.family_id else None,
            refresh_hash=session_orm.refresh_hash,
            device=session_orm.device,
            ip=session_orm.ip,
            city=session_orm.city,
            ua=session_orm.ua,
            created_at=session_orm.created_at or datetime.utcnow(),
            last_seen_at=session_orm.last_seen_at or datetime.utcnow(),
            expires_at=session_orm.expires_at or datetime.utcnow(),
            revoked_at=session_orm.revoked_at,
            ver=session_orm.ver or 1,
        )

    def _file_orm_to_domain(self, file_orm: FileORM) -> File:
        """Convert ORM to domain model"""
        return File(
            id=str(file_orm.id),
            tenant_id=str(file_orm.tenant_id) if file_orm.tenant_id else None,
            name=getattr(file_orm, "original_name", None) or "",
        )

    def _audit_log_orm_to_domain(self, audit_orm: AuditLogORM) -> AuditLog:
        """Convert ORM to domain model"""
        return AuditLog(
            id=str(audit_orm.id),
            tenant_id=str(audit_orm.tenant_id) if audit_orm.tenant_id else None,
            action=audit_orm.action or "",
        )
