"""
CA practice ORM models (SQLAlchemy tables)
"""

from sqlalchemy import Column, String, Integer, Boolean, Date, DateTime, JSON, Numeric, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()


class ClientORM(Base):
    """Client table"""
    __tablename__ = "clients"
    __table_args__ = {"schema": "ca"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # pvt-ltd, llp, partnership, proprietorship, individual
    industry = Column(String(100), nullable=True)
    gstin = Column(String(255), nullable=True)
    pan_enc = Column(Text, nullable=True)
    staff_id = Column(UUID(as_uuid=True), nullable=True)
    fee_paise = Column(Integer, default=0)
    client_tenant_id = Column(UUID(as_uuid=True), nullable=True)
    health = Column(String(50), default="good")  # good, at-risk, critical
    books_status = Column(String(50), default="clean")  # clean, issues, unclean
    archived_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_clients_tenant_id", "tenant_id"),
        Index("ix_clients_staff_id", "staff_id"),
        Index("ix_clients_health", "health"),
        Index("ix_clients_archived_at", "archived_at"),
    )


class ComplianceItemORM(Base):
    """Compliance item table"""
    __tablename__ = "compliance_items"
    __table_args__ = {"schema": "ca"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    client_id = Column(UUID(as_uuid=True), nullable=False)
    return_type = Column(String(50), nullable=False)  # GSTR-1, GSTR-3B, GSTR-9, TDS, Advance Tax, ROC, ITR
    group = Column(String(50), nullable=False)  # GST, TDS, Advance Tax, ROC, ITR
    period = Column(String(10), nullable=False)  # e.g., "2026-01"
    due_date = Column(Date, nullable=False)
    status = Column(String(50), default="Not started")  # Not started, In progress, Filed, Overdue
    assignee_id = Column(UUID(as_uuid=True), nullable=True)
    arn = Column(String(100), nullable=True)  # Acknowledgement Reference Number
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_compliance_items_tenant_id", "tenant_id"),
        Index("ix_compliance_items_client_id", "client_id"),
        Index("ix_compliance_items_due_date", "due_date"),
        Index("ix_compliance_items_status", "status"),
    )


class TaskORM(Base):
    """Task table"""
    __tablename__ = "tasks"
    __table_args__ = {"schema": "ca"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    client_id = Column(UUID(as_uuid=True), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    assignee_id = Column(UUID(as_uuid=True), nullable=True)
    due = Column(Date, nullable=True)
    priority = Column(String(50), default="medium")  # low, medium, high
    column = Column(String(50), default="todo")  # todo, in-progress, review, done
    position = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_tasks_tenant_id", "tenant_id"),
        Index("ix_tasks_client_id", "client_id"),
        Index("ix_tasks_assignee_id", "assignee_id"),
        Index("ix_tasks_column", "column"),
        Index("ix_tasks_due", "due"),
    )


class ReviewItemORM(Base):
    """Review item table"""
    __tablename__ = "review_items"
    __table_args__ = {"schema": "ca"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    client_id = Column(UUID(as_uuid=True), nullable=False)
    rule_key = Column(String(100), nullable=False)
    entity_ref = Column(JSONB, nullable=True)
    issue = Column(Text, nullable=False)
    suggested_fix = Column(JSONB, nullable=True)
    amount_paise = Column(Integer, default=0)
    status = Column(String(50), default="pending")  # pending, accepted, rejected, fixed
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_review_items_tenant_id", "tenant_id"),
        Index("ix_review_items_client_id", "client_id"),
        Index("ix_review_items_status", "status"),
    )


class TeamMemberORM(Base):
    """Team member table"""
    __tablename__ = "team_members"
    __table_args__ = {"schema": "ca"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    title = Column(String(255), nullable=True)
    capacity_h = Column(Integer, default=0)  # Weekly capacity in hours
    rate_paise = Column(Integer, default=0)  # Hourly rate
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_team_members_tenant_id", "tenant_id"),
        Index("ix_team_members_user_id", "user_id"),
    )


class TimeEntryORM(Base):
    """Time entry table"""
    __tablename__ = "time_entries"
    __table_args__ = {"schema": "ca"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    client_id = Column(UUID(as_uuid=True), nullable=False)
    staff_id = Column(UUID(as_uuid=True), nullable=False)
    date = Column(Date, nullable=False)
    hours = Column(Numeric(5, 2), nullable=False)  # Hours worked
    rate_paise = Column(Integer, nullable=False)  # Hourly rate at time of entry
    billable = Column(Boolean, default=True)
    billed_invoice_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_time_entries_tenant_id", "tenant_id"),
        Index("ix_time_entries_client_id", "client_id"),
        Index("ix_time_entries_staff_id", "staff_id"),
        Index("ix_time_entries_date", "date"),
        Index("ix_time_entries_billed", "billed_invoice_id"),
    )
