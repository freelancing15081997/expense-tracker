"""
Platform domain events
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Any
from enum import Enum


class EventType(Enum):
    """Event type categories"""
    USER = "user"
    AUTH = "auth"
    TENANT = "tenant"
    MEMBERSHIP = "membership"
    RBAC = "rbac"
    FILE = "file"
    NOTIFICATION = "notification"
    SYSTEM = "system"


@dataclass(frozen=True)
class DomainEvent:
    """Base domain event"""
    event_id: str
    tenant_id: str
    type: str
    data: dict
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class UserCreated(DomainEvent):
    """User created event"""
    user_id: str
    email: Optional[str]
    phone: Optional[str]
    name: Optional[str]


@dataclass(frozen=True)
class UserSignedIn(DomainEvent):
    """User signed in event"""
    user_id: str
    method: str
    ip: str
    user_agent: str
    device: str
    location: Optional[str]


@dataclass(frozen=True)
class SessionRevoked(DomainEvent):
    """Session revoked event"""
    session_id: str
    user_id: str
    revoked_by: str
    reason: Optional[str]


@dataclass(frozen=True)
class TenantCreated(DomainEvent):
    """Tenant created event"""
    tenant_id: str
    kind: str
    name: str
    created_by: str


@dataclass(frozen=True)
class TenantDeleted(DomainEvent):
    """Tenant deleted event"""
    tenant_id: str
    deleted_by: str
    reason: str


@dataclass(frozen=True)
class MembershipCreated(DomainEvent):
    """Membership created event"""
    tenant_id: str
    user_id: str
    role_id: str
    kind: str


@dataclass(frozen=True)
class RolePermissionsChanged(DomainEvent):
    """Role permissions changed event"""
    tenant_id: str
    role_id: str
    changes: dict


@dataclass(frozen=True)
class IntegrationHealthChanged(DomainEvent):
    """Integration health status changed"""
    integration_key: str
    tenant_id: Optional[str]
    from_status: str
    to_status: str


@dataclass(frozen=True)
class SecurityEventDetected(DomainEvent):
    """Security event detected"""
    event_type: str
    user_id: str
    tenant_id: Optional[str]
    details: dict
    severity: str = "warning"


@dataclass(frozen=True)
class OutboxLagDetected(DomainEvent):
    """Outbox lag detected"""
    lag_seconds: int
    pending_count: int
