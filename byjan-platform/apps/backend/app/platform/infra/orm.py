"""
Platform ORM models - SQLAlchemy models for platform entities
"""

from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Text, JSONB,
    ForeignKey, UniqueConstraint, Index, CheckConstraint, Date, Numeric
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.shared.database import Base
from datetime import datetime
import uuid


class UserORM(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_uid = Column(String(255), unique=True, nullable=True)
    phone = Column(String(50), unique=True, nullable=True)
    email = Column(String(255), unique=True, nullable=True)
    name = Column(String(255), nullable=True)
    avatar_file_id = Column(UUID(as_uuid=True), nullable=True)
    lang = Column(String(10), default="en")
    ui = Column(JSONB, default=dict)
    sup = Column(Boolean, default=False)
    mfa_enabled = Column(Boolean, default=False)
    totp_secret_enc = Column(Text, nullable=True)
    phone_verified_at = Column(DateTime(timezone=True), nullable=True)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    recovery_email = Column(String(255), nullable=True)
    recovery_email_verified_at = Column(DateTime(timezone=True), nullable=True)
    passkeys = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    memberships = relationship("MembershipORM", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("SessionORM", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("NotificationORM", back_populates="user", cascade="all, delete-orphan")


class TenantORM(Base):
    __tablename__ = "tenants"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    kind = Column(String(50), nullable=False)  # company | practice
    slug = Column(String(100), unique=True, nullable=True)
    status = Column(String(50), default="active")  # active | suspended
    logo_file_id = Column(UUID(as_uuid=True), nullable=True)
    settings = Column(JSONB, default=dict)
    suspended_at = Column(DateTime(timezone=True), nullable=True)
    suspended_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    memberships = relationship("MembershipORM", back_populates="tenant", cascade="all, delete-orphan")


class MembershipORM(Base):
    __tablename__ = "memberships"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("core.tenants.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("core.users.id"), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("core.roles.id"), nullable=True)
    status = Column(String(50), default="active")  # active | suspended
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    tenant = relationship("TenantORM", back_populates="memberships")
    user = relationship("UserORM", back_populates="memberships")
    role = relationship("RoleORM")


class RoleORM(Base):
    __tablename__ = "roles"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    key = Column(String(50), nullable=False)
    permissions = Column(ARRAY(String), nullable=False)
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class InviteORM(Base):
    __tablename__ = "invites"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    role_id = Column(UUID(as_uuid=True), nullable=False)
    token = Column(String(255), unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    invited_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SessionORM(Base):
    __tablename__ = "sessions"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("core.users.id"), nullable=False)
    device = Column(String(255), nullable=True)
    ip = Column(String(45), nullable=True)
    city = Column(String(255), nullable=True)
    ua = Column(Text, nullable=True)
    refresh_token_hash = Column(String(255), nullable=False)
    refresh_expires_at = Column(DateTime(timezone=True), nullable=False)
    rotated_from = Column(UUID(as_uuid=True), nullable=True)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("UserORM", back_populates="sessions")


class FileORM(Base):
    __tablename__ = "files"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    kind = Column(String(50), nullable=False)
    original_name = Column(String(255), nullable=False)
    mime = Column(String(255), nullable=False)
    size = Column(Integer, nullable=False)
    hash = Column(String(255), nullable=False)
    encrypted = Column(Boolean, default=False)
    scan_status = Column(String(50), default="pending")  # pending | clean | infected
    version = Column(Integer, default=1)
    s3_key = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NotificationORM(Base):
    __tablename__ = "notifications"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("core.users.id"), nullable=False)
    type = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)
    data = Column(JSONB, nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("UserORM", back_populates="notifications")


class AuditLogORM(Base):
    __tablename__ = "audit_log"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    actor_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    diff = Column(JSONB, nullable=True)
    ip = Column(String(45), nullable=True)
    ua = Column(Text, nullable=True)
    request_id = Column(UUID(as_uuid=True), nullable=True)
    prev_hash = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OutboxORM(Base):
    __tablename__ = "outbox"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    type = Column(String(100), nullable=False)
    aggregate_type = Column(String(100), nullable=False)
    aggregate_id = Column(UUID(as_uuid=True), nullable=False)
    payload = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    published_at = Column(DateTime(timezone=True), nullable=True)
    attempts = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)


class JobORM(Base):
    __tablename__ = "jobs"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    kind = Column(String(100), nullable=False)
    status = Column(String(50), default="pending")  # pending | running | succeeded | failed | cancelled
    progress = Column(Integer, default=0)
    params = Column(JSONB, nullable=True)
    result_file_id = Column(UUID(as_uuid=True), nullable=True)
    error = Column(JSONB, nullable=True)
    retry_of = Column(UUID(as_uuid=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UndoTokenORM(Base):
    __tablename__ = "undo_tokens"
    __table_args__ = {"schema": "core"}

    token = Column(String(255), primary_key=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    previous_state = Column(JSONB, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class IntegrationSecretORM(Base):
    __tablename__ = "integration_secrets"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    provider = Column(String(100), nullable=False)
    status = Column(String(50), default="configured")  # configured | missing_key | mock
    key_hint = Column(String(255), nullable=True)
    ciphertext = Column(Text, nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class WebhookSubORM(Base):
    __tablename__ = "webhook_subs"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    url = Column(String(255), nullable=False)
    events = Column(ARRAY(String), nullable=False)
    secret_hash = Column(String(255), nullable=False)
    status = Column(String(50), default="active")  # active | paused | failed
    fail_count = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ExportORM(Base):
    __tablename__ = "exports"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    entity = Column(String(100), nullable=False)
    format = Column(String(50), nullable=False)
    filters = Column(JSONB, nullable=True)
    status = Column(String(50), default="pending")  # pending | running | succeeded | failed
    file_id = Column(UUID(as_uuid=True), nullable=True)
    error = Column(JSONB, nullable=True)
    progress = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ConsoleIssueORM(Base):
    __tablename__ = "console_issues"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sev = Column(String(50), nullable=False)  # critical | warning | info
    title = Column(String(255), nullable=False)
    module = Column(String(50), nullable=False)  # platform | business | ca | console
    tenant_id = Column(UUID(as_uuid=True), nullable=True)
    occurrences = Column(Integer, default=1)
    first_at = Column(DateTime(timezone=True), server_default=func.now())
    last_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(50), default="open")  # open | resolved | reopened
    trace_ids = Column(ARRAY(UUID), nullable=True)
    resolution = Column(Text, nullable=True)
    resolved_by = Column(UUID(as_uuid=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PlatformFlagORM(Base):
    __tablename__ = "platform_flags"
    __table_args__ = {"schema": "core"}

    key = Column(String(100), primary_key=True)
    enabled = Column(Boolean, default=False)
    tenant_ids = Column(ARRAY(UUID), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ServiceMetricORM(Base):
    __tablename__ = "service_metrics"
    __table_args__ = {"schema": "core"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service = Column(String(100), nullable=False)
    metric = Column(String(100), nullable=False)
    value = Column(Numeric(18, 4), nullable=False)
    unit = Column(String(50), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())


# Indexes for performance
Index("ix_users_firebase_uid", UserORM.firebase_uid)
Index("ix_users_phone", UserORM.phone)
Index("ix_users_email", UserORM.email)
Index("ix_tenants_slug", TenantORM.slug)
Index("ix_tenants_status", TenantORM.status)
Index("ix_memberships_tenant_user", MembershipORM.tenant_id, MembershipORM.user_id)
Index("ix_sessions_user_id", SessionORM.user_id)
Index("ix_sessions_expires_at", SessionORM.refresh_expires_at)
Index("ix_files_tenant_id", FileORM.tenant_id)
Index("ix_notifications_tenant_user", NotificationORM.tenant_id, NotificationORM.user_id)
Index("ix_audit_log_tenant_entity", AuditLogORM.tenant_id, AuditLogORM.entity_type, AuditLogORM.entity_id)
Index("ix_audit_log_created_at", AuditLogORM.created_at)
Index("ix_outbox_tenant", OutboxORM.tenant_id)
Index("ix_outbox_published_at", OutboxORM.published_at)
Index("ix_jobs_tenant_id", JobORM.tenant_id)
Index("ix_jobs_status", JobORM.status)
Index("ix_console_issues_tenant_id", ConsoleIssueORM.tenant_id)
Index("ix_console_issues_sev", ConsoleIssueORM.sev)
Index("ix_console_issues_status", ConsoleIssueORM.status)
Index("ix_service_metrics_service", ServiceMetricORM.service)
Index("ix_service_metrics_timestamp", ServiceMetricORM.timestamp)
