"""
Business domain models - entities and value objects
"""

from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum
from decimal import Decimal
from app.shared.types import Money, Qty


class AccountType(Enum):
    """Account type"""
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    INCOME = "income"
    EXPENSE = "expense"


class AccountGroup(Enum):
    """Account group"""
    CURRENT_ASSETS = "current-assets"
    NON_CURRENT_ASSETS = "non-current-assets"
    CURRENT_LIABILITIES = "current-liabilities"
    NON_CURRENT_LIABILITIES = "non-current-liabilities"
    EQUITY = "equity"
    OPERATING_INCOME = "operating-income"
    OPERATING_EXPENSES = "operating-expenses"
    OTHER_INCOME = "other-income"
    OTHER_EXPENSES = "other-expenses"


class PeriodStatus(Enum):
    """Period status"""
    OPEN = "open"
    CLOSED = "closed"
    LOCKED = "locked"


class DocumentType(Enum):
    """Document type (14 types)"""
    INVOICES = "invoices"
    ESTIMATES = "estimates"
    QUOTES = "quotes"
    SALES_ORDERS = "sales-orders"
    CREDIT_NOTES = "credit-notes"
    DEBIT_NOTES = "debit-notes"
    PURCHASE_REQUESTS = "purchase-requests"
    PURCHASE_ORDERS = "purchase-orders"
    PURCHASE_RECEIPTS = "purchase-receipts"
    BILLS = "bills"
    VENDOR_CREDITS = "vendor-credits"
    JOURNALS = "journals"
    RECURRING = "recurring"
    EXPENSES = "expenses"


class DocumentStatus(Enum):
    """Document status"""
    DRAFT = "Draft"
    SENT = "Sent"
    OVERDUE = "Overdue"
    PARTLY_PAID = "Partly paid"
    PAID = "Paid"
    VOID = "Void"
    ACCEPTED = "Accepted"
    DECLINED = "Declined"
    EXPIRED = "Expired"
    CONVERTED = "Converted"
    PENDING_APPROVAL = "Pending approval"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    ORDERED = "Ordered"
    PARTLY_RECEIVED = "Partly received"
    RECEIVED = "Received"
    BILLED = "Billed"
    OPEN = "Open"
    APPLIED = "Applied"
    POSTED = "Posted"
    REVERSED = "Reversed"
    ACTIVE = "Active"
    PAUSED = "Paused"
    REIMBURSED = "Reimbursed"


class PaymentDirection(Enum):
    """Payment direction"""
    IN = "in"  # Receivable (customer pays you)
    OUT = "out"  # Payable (you pay supplier)


class TaxMode(Enum):
    """Tax mode"""
    INCLUSIVE = "inclusive"
    EXCLUSIVE = "exclusive"


@dataclass(frozen=True)
class Account:
    """Account entity"""
    id: str
    tenant_id: str
    code: str
    name: str
    type: AccountType
    group: Optional[AccountGroup] = None
    parent_id: Optional[str] = None
    is_bank: bool = False
    is_system: bool = False
    bank_meta_enc: Optional[str] = None
    archived_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Period:
    """Period entity"""
    id: str
    tenant_id: str
    fy: str
    month: int
    status: PeriodStatus = PeriodStatus.OPEN
    closed_by: Optional[str] = None
    closed_at: Optional[datetime] = None
    locked_by: Optional[str] = None
    locked_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Journal:
    """Journal entry"""
    id: str
    tenant_id: str
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    date: date = field(default_factory=date.today)
    narration: str = ""
    posted_at: Optional[datetime] = None
    reversed_by: Optional[str] = None
    reversed_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class GlEntry:
    """GL entry (journal line)"""
    id: str
    tenant_id: str
    journal_id: str
    account_id: str
    dr_paise: int = 0
    cr_paise: int = 0
    party_id: Optional[str] = None
    org_unit_id: Optional[str] = None
    project_id: Optional[str] = None
    entity_id: Optional[str] = None
    date: date = field(default_factory=date.today)
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Party:
    """Party entity (customer, supplier)"""
    id: str
    tenant_id: str
    kind: str  # customer, supplier, both
    name: str
    gstin: Optional[str] = None
    pan_enc: Optional[str] = None
    state_code: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    terms_days: int = 30
    category_id: Optional[str] = None
    group_name: Optional[str] = None
    credit_limit: Optional[int] = None
    addresses: Dict[str, Any] = field(default_factory=dict)
    opening_balance: int = 0
    archived_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Item:
    """Item entity"""
    id: str
    tenant_id: str
    type: str  # goods, service
    sku: Optional[str] = None
    name: str = ""
    unit: str = ""
    hsn: Optional[str] = None
    gst_rate: Optional[Decimal] = None
    sale_rate: Optional[Money] = None
    purchase_rate: Optional[Money] = None
    reorder_level: Optional[Qty] = None
    track_stock: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Location:
    """Location entity (godown, warehouse)"""
    id: str
    tenant_id: str
    name: str
    address: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Document:
    """Document entity"""
    id: str
    tenant_id: str
    type: DocumentType
    number: str
    status: DocumentStatus = DocumentStatus.DRAFT
    party_id: Optional[str] = None
    entity_id: Optional[str] = None
    date: date = field(default_factory=date.today)
    due_date: Optional[date] = None
    terms_days: int = 30
    reference: Optional[str] = None
    salesperson_id: Optional[str] = None
    project_id: Optional[str] = None
    org_unit_id: Optional[str] = None
    tax_mode: TaxMode = TaxMode.EXCLUSIVE
    place_of_supply: Optional[str] = None
    totals: Dict[str, Any] = field(default_factory=dict)
    paid_paise: int = 0
    balance_paise: int = 0
    options: Dict[str, Any] = field(default_factory=dict)
    notes: Optional[str] = None
    narration: Optional[str] = None
    recurring: Optional[Dict[str, Any]] = None
    source_doc_id: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class DocumentLine:
    """Document line"""
    id: str
    document_id: str
    position: int = 0
    item_id: Optional[str] = None
    account_id: Optional[str] = None
    description: Optional[str] = None
    hsn: Optional[str] = None
    qty: Decimal = Decimal("0")
    rate_paise: int = 0
    discount_pct: Decimal = Decimal("0")
    gst_rate: Optional[Decimal] = None
    amount_paise: int = 0
    dr_paise: int = 0
    cr_paise: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Payment:
    """Payment entity"""
    id: str
    tenant_id: str
    direction: PaymentDirection
    party_id: str
    date: date = field(default_factory=date.today)
    mode: str = "bank"  # cash, upi, bank, cheque
    account_id: Optional[str] = None
    amount_paise: int = 0
    reference: Optional[str] = None
    status: str = "posted"
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class PaymentAllocation:
    """Payment allocation"""
    id: str
    payment_id: str
    document_id: str
    amount_paise: int = 0
    tds_paise: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class PaymentRun:
    """Payment run"""
    id: str
    tenant_id: str
    status: str = "draft"
    approver_id: Optional[str] = None
    bank_file_id: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class BankConnection:
    """Bank connection"""
    id: str
    tenant_id: str
    account_id: str
    provider: str  # e.g., "yapily", "plaid"
    status: str = "active"  # active, disconnected, expired
    consent_expires_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class BankLine:
    """Bank line"""
    id: str
    tenant_id: str
    account_id: str
    date: date = field(default_factory=date.today)
    description: str = ""
    amount_paise: int = 0
    balance_paise: int = 0
    ext_id: Optional[str] = None
    status: str = "unmatched"  # unmatched, matched, ignored
    matched: Dict[str, Any] = field(default_factory=dict)
    rule_id: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class BankRule:
    """Bank rule for auto-matching"""
    id: str
    tenant_id: str
    match: Dict[str, Any]
    action: Dict[str, Any]
    priority: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Asset:
    """Asset entity"""
    id: str
    tenant_id: str
    category: str
    acquired_on: date
    cost: int = 0
    rate_pct: Decimal = Decimal("0")
    method: str = "straight-line"
    accumulated: int = 0
    status: str = "in-use"  # in-use, disposed
    disposed_on: Optional[date] = None
    proceeds_paise: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Project:
    """Project entity"""
    id: str
    tenant_id: str
    name: str
    budget: Optional[Dict[str, Any]] = None
    spent: int = 0
    invoiced: int = 0
    margin: Optional[Decimal] = None
    status: str = "active"
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Budget:
    """Budget entity"""
    id: str
    tenant_id: str
    fy: str
    account_id: str
    org_unit_id: Optional[str] = None
    months: List[int] = field(default_factory=list)  # 12 values
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class TaxReturn:
    """Tax return entity"""
    id: str
    tenant_id: str
    type: str  # e.g., "gstr1", "gstr3b"
    period: str
    status: str = "draft"  # draft, working, filed
    working: Dict[str, Any] = field(default_factory=dict)
    arn: Optional[str] = None
    filed_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Approval:
    """Approval entity"""
    id: str
    tenant_id: str
    source_type: str
    source_id: str
    amount_paise: int = 0
    reason: Optional[str] = None
    requested_by: str = ""
    approver_id: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())
