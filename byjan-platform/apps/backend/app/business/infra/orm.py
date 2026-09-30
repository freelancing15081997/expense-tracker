"""
Business ORM models (SQLAlchemy tables)
"""

from sqlalchemy import Column, String, Integer, Boolean, Date, DateTime, JSON, Numeric, ForeignKey, Index, ARRAY, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()


class AccountORM(Base):
    """Account table (Chart of Accounts)"""
    __tablename__ = "accounts"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # asset, liability, equity, income, expense
    group = Column(String(100), nullable=True)
    parent_id = Column(UUID(as_uuid=True), nullable=True)
    is_bank = Column(Boolean, default=False)
    is_system = Column(Boolean, default=False)
    bank_meta_enc = Column(Text, nullable=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_accounts_tenant_id", "tenant_id"),
        Index("ix_accounts_code", "code"),
        Index("ix_accounts_type", "type"),
        Index("ix_accounts_archived_at", "archived_at"),
    )


class PeriodORM(Base):
    """Period table"""
    __tablename__ = "periods"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    fy = Column(String(10), nullable=False)  # e.g., "2026-27"
    month = Column(Integer, nullable=False)
    status = Column(String(50), default="open")  # open, closed, locked
    closed_by = Column(UUID(as_uuid=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    locked_by = Column(UUID(as_uuid=True), nullable=True)
    locked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_periods_tenant_id", "tenant_id"),
        Index("ix_periods_fy_month", "tenant_id", "fy", "month", unique=True),
        Index("ix_periods_status", "status"),
    )


class JournalORM(Base):
    """Journal table"""
    __tablename__ = "journals"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    source_type = Column(String(100), nullable=True)
    source_id = Column(UUID(as_uuid=True), nullable=True)
    date = Column(Date, nullable=False)
    narration = Column(Text, default="")
    posted_at = Column(DateTime(timezone=True), nullable=True)
    reversed_by = Column(UUID(as_uuid=True), nullable=True)
    reversed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_journals_tenant_id", "tenant_id"),
        Index("ix_journals_date", "date"),
        Index("ix_journals_source", "source_type", "source_id"),
    )


class GlEntryORM(Base):
    """GL entry table (partitioned by month)"""
    __tablename__ = "gl_entries"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    journal_id = Column(UUID(as_uuid=True), nullable=False)
    account_id = Column(UUID(as_uuid=True), nullable=False)
    dr_paise = Column(Integer, default=0)
    cr_paise = Column(Integer, default=0)
    party_id = Column(UUID(as_uuid=True), nullable=True)
    org_unit_id = Column(UUID(as_uuid=True), nullable=True)
    project_id = Column(UUID(as_uuid=True), nullable=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_gl_entries_tenant_id", "tenant_id"),
        Index("ix_gl_entries_journal_id", "journal_id"),
        Index("ix_gl_entries_account_id", "account_id"),
        Index("ix_gl_entries_tenant_account_date", "tenant_id", "account_id", "date"),
    )


class PartyORM(Base):
    """Party table (customers, suppliers)"""
    __tablename__ = "parties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    kind = Column(String(50), nullable=False)  # customer, supplier, both
    name = Column(String(255), nullable=False)
    gstin = Column(String(255), nullable=True)
    pan_enc = Column(Text, nullable=True)
    state_code = Column(String(10), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    terms_days = Column(Integer, default=30)
    category_id = Column(UUID(as_uuid=True), nullable=True)
    group_name = Column(String(255), nullable=True)
    credit_limit = Column(Integer, nullable=True)
    addresses = Column(JSONB, nullable=True)  # billing, ship_to
    opening_balance = Column(Integer, default=0)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_parties_tenant_id", "tenant_id"),
        Index("ix_parties_kind", "kind"),
        Index("ix_parties_name", "name"),
        Index("ix_parties_gstin", "gstin"),
        Index("ix_parties_archived_at", "archived_at"),
        {"schema": "biz"},
    )


class ItemORM(Base):
    """Item table"""
    __tablename__ = "items"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    type = Column(String(50), nullable=False)  # goods, service
    sku = Column(String(100), nullable=True)
    name = Column(String(255), nullable=False)
    unit = Column(String(50), nullable=True)
    hsn = Column(String(10), nullable=True)
    gst_rate = Column(Numeric(5, 4), nullable=True)
    sale_rate = Column(Integer, nullable=True)
    purchase_rate = Column(Integer, nullable=True)
    reorder_level = Column(Numeric(18, 3), nullable=True)
    track_stock = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_items_tenant_id", "tenant_id"),
        Index("ix_items_sku", "sku"),
        Index("ix_items_type", "type"),
        Index("ix_items_hsn", "hsn"),
    )


class LocationORM(Base):
    """Location table"""
    __tablename__ = "locations"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_locations_tenant_id", "tenant_id"),
        Index("ix_locations_name", "name"),
    )


class DocumentORM(Base):
    """Document table (14 types)"""
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    type = Column(String(100), nullable=False)
    number = Column(String(100), nullable=False)
    status = Column(String(50), default="Draft")
    party_id = Column(UUID(as_uuid=True), nullable=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    terms_days = Column(Integer, default=30)
    reference = Column(String(255), nullable=True)
    salesperson_id = Column(UUID(as_uuid=True), nullable=True)
    project_id = Column(UUID(as_uuid=True), nullable=True)
    org_unit_id = Column(UUID(as_uuid=True), nullable=True)
    tax_mode = Column(String(50), default="exclusive")
    place_of_supply = Column(String(10), nullable=True)
    totals = Column(JSONB, nullable=True)
    paid_paise = Column(Integer, default=0)
    balance_paise = Column(Integer, default=0)
    options = Column(JSONB, nullable=True)
    notes = Column(Text, nullable=True)
    narration = Column(Text, nullable=True)
    recurring = Column(JSONB, nullable=True)
    source_doc_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_documents_tenant_id", "tenant_id"),
        Index("ix_documents_type", "type"),
        Index("ix_documents_number", "number"),
        Index("ix_documents_tenant_type", "tenant_id", "type"),
        Index("ix_documents_status", "status"),
        Index("ix_documents_date", "date"),
        Index("ix_documents_party_id", "party_id"),
        {"schema": "biz"},
    )


class DocumentLineORM(Base):
    """Document line table"""
    __tablename__ = "document_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    document_id = Column(UUID(as_uuid=True), nullable=False)
    position = Column(Integer, default=0)
    item_id = Column(UUID(as_uuid=True), nullable=True)
    account_id = Column(UUID(as_uuid=True), nullable=True)
    description = Column(Text, nullable=True)
    hsn = Column(String(10), nullable=True)
    qty = Column(Numeric(18, 3), default=0)
    rate_paise = Column(Integer, default=0)
    discount_pct = Column(Numeric(5, 4), default=0)
    gst_rate = Column(Numeric(5, 4), nullable=True)
    amount_paise = Column(Integer, default=0)
    dr_paise = Column(Integer, default=0)
    cr_paise = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_document_lines_document_id", "document_id"),
        Index("ix_document_lines_position", "document_id", "position"),
        {"schema": "biz"},
    )


class PaymentORM(Base):
    """Payment table"""
    __tablename__ = "payments"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    direction = Column(String(10), nullable=False)  # in, out
    party_id = Column(UUID(as_uuid=True), nullable=False)
    date = Column(Date, nullable=False)
    mode = Column(String(50), default="bank")
    account_id = Column(UUID(as_uuid=True), nullable=True)
    amount_paise = Column(Integer, nullable=False)
    reference = Column(String(255), nullable=True)
    status = Column(String(50), default="posted")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_payments_tenant_id", "tenant_id"),
        Index("ix_payments_party_id", "party_id"),
        Index("ix_payments_date", "date"),
        Index("ix_payments_status", "status"),
    )


class PaymentAllocationORM(Base):
    """Payment allocation table"""
    __tablename__ = "payment_allocations"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    payment_id = Column(UUID(as_uuid=True), nullable=False)
    document_id = Column(UUID(as_uuid=True), nullable=False)
    amount_paise = Column(Integer, nullable=False)
    tds_paise = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_payment_allocations_payment_id", "payment_id"),
        Index("ix_payment_allocations_document_id", "document_id"),
    )


class PaymentRunORM(Base):
    """Payment run table"""
    __tablename__ = "payment_runs"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    status = Column(String(50), default="draft")
    approver_id = Column(UUID(as_uuid=True), nullable=True)
    bank_file_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_payment_runs_tenant_id", "tenant_id"),
        Index("ix_payment_runs_status", "status"),
    )


class BankConnectionORM(Base):
    """Bank connection table"""
    __tablename__ = "bank_connections"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    account_id = Column(UUID(as_uuid=True), nullable=False)
    provider = Column(String(100), nullable=False)
    status = Column(String(50), default="active")
    consent_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_bank_connections_tenant_id", "tenant_id"),
        Index("ix_bank_connections_account_id", "account_id"),
    )


class BankLineORM(Base):
    """Bank line table"""
    __tablename__ = "bank_lines"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    account_id = Column(UUID(as_uuid=True), nullable=False)
    date = Column(Date, nullable=False)
    description = Column(Text, default="")
    amount_paise = Column(Integer, nullable=False)
    balance_paise = Column(Integer, nullable=False)
    ext_id = Column(String(255), nullable=True)
    status = Column(String(50), default="unmatched")
    matched = Column(JSONB, nullable=True)
    rule_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_bank_lines_tenant_id", "tenant_id"),
        Index("ix_bank_lines_account_id", "account_id"),
        Index("ix_bank_lines_date", "date"),
        Index("ix_bank_lines_status", "status"),
        Index("ix_bank_lines_ext_id", "ext_id", unique=True),
    )


class BankRuleORM(Base):
    """Bank rule table"""
    __tablename__ = "bank_rules"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    match = Column(JSONB, nullable=False)
    action = Column(JSONB, nullable=False)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_bank_rules_tenant_id", "tenant_id"),
        Index("ix_bank_rules_priority", "priority"),
    )


class AssetORM(Base):
    """Asset table"""
    __tablename__ = "assets"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    category = Column(String(100), nullable=False)
    acquired_on = Column(Date, nullable=False)
    cost = Column(Integer, nullable=False)
    rate_pct = Column(Numeric(5, 2), nullable=False)
    method = Column(String(50), default="straight-line")
    accumulated = Column(Integer, default=0)
    status = Column(String(50), default="in-use")
    disposed_on = Column(Date, nullable=True)
    proceeds_paise = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_assets_tenant_id", "tenant_id"),
        Index("ix_assets_category", "category"),
        Index("ix_assets_status", "status"),
    )


class ProjectORM(Base):
    """Project table"""
    __tablename__ = "projects"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    budget = Column(JSONB, nullable=True)
    spent = Column(Integer, default=0)
    invoiced = Column(Integer, default=0)
    margin = Column(Numeric(5, 2), nullable=True)
    status = Column(String(50), default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_projects_tenant_id", "tenant_id"),
        Index("ix_projects_status", "status"),
    )


class BudgetORM(Base):
    """Budget table"""
    __tablename__ = "budgets"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    fy = Column(String(10), nullable=False)
    account_id = Column(UUID(as_uuid=True), nullable=False)
    org_unit_id = Column(UUID(as_uuid=True), nullable=True)
    months = Column(ARRAY(Integer), nullable=False)  # 12 values
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_budgets_tenant_id", "tenant_id"),
        Index("ix_budgets_fy", "fy"),
        Index("ix_budgets_account_id", "account_id"),
    )


class TaxReturnORM(Base):
    """Tax return table"""
    __tablename__ = "tax_returns"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    type = Column(String(50), nullable=False)  # gstr1, gstr3b, etc.
    period = Column(String(10), nullable=False)  # e.g., "2026-27-Q1"
    status = Column(String(50), default="draft")
    working = Column(JSONB, nullable=True)
    arn = Column(String(100), nullable=True)
    filed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_tax_returns_tenant_id", "tenant_id"),
        Index("ix_tax_returns_period", "period"),
        Index("ix_tax_returns_status", "status"),
    )


class ApprovalORM(Base):
    """Approval table"""
    __tablename__ = "approvals"
    __table_args__ = {"schema": "biz"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    source_type = Column(String(100), nullable=False)
    source_id = Column(UUID(as_uuid=True), nullable=False)
    amount_paise = Column(Integer, default=0)
    reason = Column(Text, nullable=True)
    requested_by = Column(UUID(as_uuid=True), nullable=False)
    approver_id = Column(UUID(as_uuid=True), nullable=True)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_approvals_tenant_id", "tenant_id"),
        Index("ix_approvals_source", "source_type", "source_id"),
        Index("ix_approvals_status", "status"),
        Index("ix_approvals_requested_by", "requested_by"),
    )
