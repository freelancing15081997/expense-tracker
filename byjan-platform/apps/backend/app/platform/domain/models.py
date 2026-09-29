"""
Platform domain models (entities and value objects)
Dataclasses, no SQLAlchemy ORM
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List
from enum import Enum
from app.shared.ids import UUIDv7


class TenantKind(Enum):
    """Tenant kind"""
    BUSINESS = "business"
    PRACTICE = "practice"
    DHANI = "dhani"


class MembershipKind(Enum):
    """Membership kind"""
    MEMBER = "member"
    CA = "ca"


class UserStatus(Enum):
    """User status"""
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"


class SessionStatus(Enum):
    """Session status"""
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"


@dataclass(frozen=True)
class User:
    """User entity"""
    id: str
    firebase_uid: str
    email: Optional[str] = None
    phone_enc: Optional[str] = None
    phone_bidx: Optional[str] = None
    name: Optional[str] = None
    lang: str = "en"
    ui: dict = field(default_factory=dict)
    sup: bool = False
    mfa_secret_enc: Optional[str] = None
    status: UserStatus = UserStatus.ACTIVE
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Tenant:
    """Tenant entity"""
    id: str
    kind: TenantKind
    name: str
    legal: Optional[dict] = None
    gstin: Optional[str] = None
    state_code: Optional[str] = None
    fy_start_month: int = 4
    lang: str = "en"
    settings: dict = field(default_factory=dict)
    status: str = "active"
    deleted_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Membership:
    """Membership entity"""
    tenant_id: str
    user_id: str
    role_id: Optional[str] = None
    kind: MembershipKind = MembershipKind.MEMBER
    org_unit_ids: List[str] = field(default_factory=list)
    status: str = "active"
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Role:
    """Role entity"""
    id: str
    tenant_id: str
    name: str
    system: bool = False
    locked: bool = False
    limits: dict = field(default_factory=dict)
    perm_version: int = 1
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class RolePermission:
    """Role permission entity"""
    role_id: str
    module: str
    action: str
    allowed: bool = True


@dataclass(frozen=True)
class Session:
    """Session entity"""
    id: str
    user_id: str
    refresh_hash: str
    family_id: Optional[str] = None
    device: Optional[str] = None
    ip: Optional[str] = None
    city: Optional[str] = None
    ua: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    last_seen_at: datetime = field(default_factory=lambda: datetime.utcnow())
    expires_at: datetime = field(default_factory=lambda: datetime.utcnow())
    revoked_at: Optional[datetime] = None
    ver: int = 1


@dataclass(frozen=True)
class Principal:
    """Authentication principal (from JWT)"""
    user_id: str
    tenant_id: Optional[str] = None
    role_id: Optional[str] = None
    amr: List[str] = field(default_factory=list)
    mfa: bool = False
    auth_time: Optional[datetime] = None
    session_id: Optional[str] = None
    is_super: bool = False
    view_as_role: Optional[str] = None


@dataclass(frozen=True)
class Invite:
    id: str
    tenant_id: str
    email: str = ""
    role_id: Optional[str] = None
    status: str = "pending"


@dataclass(frozen=True)
class File:
    id: str
    tenant_id: Optional[str] = None
    name: str = ""


@dataclass(frozen=True)
class Notification:
    id: str
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None


@dataclass(frozen=True)
class AuditLog:
    id: str
    tenant_id: Optional[str] = None
    action: str = ""


@dataclass(frozen=True)
class Job:
    id: str
    tenant_id: Optional[str] = None
    kind: str = ""
    status: str = "queued"


@dataclass(frozen=True)
class UndoToken:
    id: str
    tenant_id: Optional[str] = None


@dataclass(frozen=True)
class WebhookSub:
    id: str
    tenant_id: Optional[str] = None
    url: str = ""


@dataclass(frozen=True)
class Export:
    id: str
    tenant_id: Optional[str] = None
    status: str = "queued"
