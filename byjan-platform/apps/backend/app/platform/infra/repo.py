"""
Platform repositories - data access layer
"""

from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.orm import selectinload
import structlog

from app.platform.infra.orm import (
    UserORM, TenantORM, MembershipORM, RoleORM, RolePermissionORM,
    SessionORM, OtpCodeORM, RecoveryCodeORM, FeatureSwitchORM,
    FileORM, NotificationORM, NotificationPrefORM, DeviceORM,
    MessageORM, AuditLogORM, OutboxORM, ChangeLogORM,
    IdempotencyKeyORM, UndoTokenORM, JobORM, NumberSeriesORM,
    IntegrationSecretORM, WebhookEventORM, ConsoleIssueORM, ConsentORM
)
from app.platform.domain.models import User, Tenant, Membership, Role, Session
from app.shared.ids import UUIDv7

log = structlog.get_logger(__name__)


class UserRepository:
    """User repository"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        stmt = select(UserORM).where(UserORM.id == user_id)
        result = await self.db.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_by_firebase_uid(self, firebase_uid: str) -> Optional[User]:
        """Get user by Firebase UID"""
        stmt = select(UserORM).where(UserORM.firebase_uid == firebase_uid)
        result = await self.db.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        stmt = select(UserORM).where(UserORM.email == email)
        result = await self.db.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def create(self, user: User) -> User:
        """Create new user"""
        orm = UserORM(
            id=user.id,
            firebase_uid=user.firebase_uid,
            email=user.email,
            phone_enc=user.phone_enc,
            phone_bidx=user.phone_bidx,
            name=user.name,
            lang=user.lang,
            ui=user.ui,
            sup=user.sup,
            mfa_secret_enc=user.mfa_secret_enc,
            status=user.status.value,
        )
        self.db.add(orm)
        await self.db.flush()
        await self.db.refresh(orm)
        return self._to_domain(orm)

    async def update(self, user_id: str, updates: Dict[str, Any]) -> User:
        """Update user"""
        stmt = update(UserORM).where(UserORM.id == user_id).values(**updates)
        await self.db.execute(stmt)
        await self.db.flush()
        return await self.get_by_id(user_id)

    async def _to_domain(self, orm: UserORM) -> User:
        """Convert ORM to domain"""
        return User(
            id=str(orm.id),
            firebase_uid=orm.firebase_uid,
            email=orm.email,
            phone_enc=orm.phone_enc,
            phone_bidx=orm.phone_bidx,
            name=orm.name,
            lang=orm.lang,
            ui=orm.ui or {},
            sup=orm.sup,
            mfa_secret_enc=orm.mfa_secret_enc,
            status=orm.status,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )


class TenantRepository:
    """Tenant repository"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, tenant_id: str) -> Optional[Tenant]:
        """Get tenant by ID"""
        stmt = select(TenantORM).where(TenantORM.id == tenant_id)
        result = await self.db.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def create(self, tenant: Tenant) -> Tenant:
        """Create new tenant"""
        orm = TenantORM(
            id=tenant.id,
            kind=tenant.kind.value,
            name=tenant.name,
            legal=tenant.legal,
            gstin=tenant.gstin,
            state_code=tenant.state_code,
            fy_start_month=tenant.fy_start_month,
            lang=tenant.lang,
            settings=tenant.settings,
        )
        self.db.add(orm)
        await self.db.flush()
        await self.db.refresh(orm)
        return self._to_domain(orm)

    async def update(self, tenant_id: str, updates: Dict[str, Any]) -> Tenant:
        """Update tenant"""
        stmt = update(TenantORM).where(TenantORM.id == tenant_id).values(**updates)
        await self.db.execute(stmt)
        await self.db.flush()
        return await self.get_by_id(tenant_id)

    async def soft_delete(self, tenant_id: str) -> None:
        """Soft delete tenant"""
        stmt = update(TenantORM).where(TenantORM.id == tenant_id).values(
            status="deleted",
            deleted_at=func.now()
        )
        await self.db.execute(stmt)
        await self.db.flush()

    async def _to_domain(self, orm: TenantORM) -> Tenant:
        """Convert ORM to domain"""
        return Tenant(
            id=str(orm.id),
            kind=orm.kind,
            name=orm.name,
            legal=orm.legal,
            gstin=orm.gstin,
            state_code=orm.state_code,
            fy_start_month=orm.fy_start_month,
            lang=orm.lang,
            settings=orm.settings or {},
            status=orm.status,
            deleted_at=orm.deleted_at,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )


class MembershipRepository:
    """Membership repository"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_membership(self, tenant_id: str, user_id: str) -> Optional[Membership]:
        """Get membership"""
        stmt = select(MembershipORM).where(
            and_(
                MembershipORM.tenant_id == tenant_id,
                MembershipORM.user_id == user_id
            )
        )
        result = await self.db.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_user_tenants(self, user_id: str) -> List[Membership]:
        """Get all tenants for a user"""
        stmt = select(MembershipORM).where(MembershipORM.user_id == user_id)
        result = await self.db.execute(stmt)
        orms = result.scalars().all()
        return [self._to_domain(orm) for orm in orms]

    async def create(self, membership: Membership) -> Membership:
        """Create membership"""
        orm = MembershipORM(
            tenant_id=membership.tenant_id,
            user_id=membership.user_id,
            role_id=membership.role_id,
            kind=membership.kind.value,
            org_unit_ids=membership.org_unit_ids,
            status=membership.status,
        )
        self.db.add(orm)
        await self.db.flush()
        await self.db.refresh(orm)
        return self._to_domain(orm)

    async def update(self, tenant_id: str, user_id: str, updates: Dict[str, Any]) -> Optional[Membership]:
        """Update membership"""
        stmt = update(MembershipORM).where(
            and_(
                MembershipORM.tenant_id == tenant_id,
                MembershipORM.user_id == user_id
            )
        ).values(**updates)
        await self.db.execute(stmt)
        await self.db.flush()
        return await self.get_membership(tenant_id, user_id)

    async def _to_domain(self, orm: MembershipORM) -> Membership:
        """Convert ORM to domain"""
        return Membership(
            tenant_id=str(orm.tenant_id),
            user_id=str(orm.user_id),
            role_id=str(orm.role_id) if orm.role_id else None,
            kind=orm.kind,
            org_unit_ids=[str(oid) for oid in (orm.org_unit_ids or [])],
            status=orm.status,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )


class RoleRepository:
    """Role repository"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, role_id: str) -> Optional[Role]:
        """Get role by ID"""
        stmt = select(RoleORM).where(RoleORM.id == role_id)
        result = await self.db.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_tenant_roles(self, tenant_id: str) -> List[Role]:
        """Get all roles for a tenant"""
        stmt = select(RoleORM).where(RoleORM.tenant_id == tenant_id)
        result = await self.db.execute(stmt)
        orms = result.scalars().all()
        return [self._to_domain(orm) for orm in orms]

    async def create(self, role: Role) -> Role:
        """Create role"""
        orm = RoleORM(
            id=role.id,
            tenant_id=role.tenant_id,
            name=role.name,
            system=role.system,
            locked=role.locked,
            limits=role.limits,
            perm_version=role.perm_version,
        )
        self.db.add(orm)
        await self.db.flush()
        await self.db.refresh(orm)
        return self._to_domain(orm)

    async def update(self, role_id: str, updates: Dict[str, Any]) -> Optional[Role]:
        """Update role"""
        stmt = update(RoleORM).where(RoleORM.id == role_id).values(**updates)
        await self.db.execute(stmt)
        await self.db.flush()
        return await self.get_by_id(role_id)

    async def delete(self, role_id: str) -> None:
        """Delete role"""
        stmt = delete(RoleORM).where(RoleORM.id == role_id)
        await self.db.execute(stmt)
        await self.db.flush()

    async def _to_domain(self, orm: RoleORM) -> Role:
        """Convert ORM to domain"""
        return Role(
            id=str(orm.id),
            tenant_id=str(orm.tenant_id),
            name=orm.name,
            system=orm.system,
            locked=orm.locked,
            limits=orm.limits or {},
            perm_version=orm.perm_version,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )


class SessionRepository:
    """Session repository"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, session_id: str) -> Optional[Session]:
        """Get session by ID"""
        stmt = select(SessionORM).where(SessionORM.id == session_id)
        result = await self.db.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_by_refresh_hash(self, refresh_hash: str) -> Optional[Session]:
        """Get session by refresh hash"""
        stmt = select(SessionORM).where(SessionORM.refresh_hash == refresh_hash)
        result = await self.db.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def create(self, session: Session) -> Session:
        """Create session"""
        orm = SessionORM(
            id=session.id,
            user_id=session.user_id,
            family_id=session.family_id,
            refresh_hash=session.refresh_hash,
            device=session.device,
            ip=session.ip,
            city=session.city,
            ua=session.ua,
            expires_at=session.expires_at,
            ver=session.ver,
        )
        self.db.add(orm)
        await self.db.flush()
        await self.db.refresh(orm)
        return self._to_domain(orm)

    async def update(self, session_id: str, updates: Dict[str, Any]) -> Optional[Session]:
        """Update session"""
        stmt = update(SessionORM).where(SessionORM.id == session_id).values(**updates)
        await self.db.execute(stmt)
        await self.db.flush()
        return await self.get_by_id(session_id)

    async def revoke(self, session_id: str) -> None:
        """Revoke session"""
        stmt = update(SessionORM).where(SessionORM.id == session_id).values(
            revoked_at=func.now()
        )
        await self.db.execute(stmt)
        await self.db.flush()

    async def _to_domain(self, orm: SessionORM) -> Session:
        """Convert ORM to domain"""
        return Session(
            id=str(orm.id),
            user_id=str(orm.user_id),
            family_id=str(orm.family_id) if orm.family_id else None,
            refresh_hash=orm.refresh_hash,
            device=orm.device,
            ip=orm.ip,
            city=orm.city,
            ua=orm.ua,
            created_at=orm.created_at,
            last_seen_at=orm.last_seen_at,
            expires_at=orm.expires_at,
            revoked_at=orm.revoked_at,
            ver=orm.ver,
        )
