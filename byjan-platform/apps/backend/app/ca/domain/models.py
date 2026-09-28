"""
CA Practice domain models
"""

from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum


class ClientStatus(Enum):
    """Client status"""
    ACTIVE = "active"
    ARCHIVED = "archived"
    INACTIVE = "inactive"


class ComplianceGroup(Enum):
    """Compliance group"""
    GST = "gst"
    ITR = "itr"
    ROC = "roc"


class ComplianceStatus(Enum):
    """Compliance status"""
    NOT_STARTED = "Not started"
    DATA_PENDING = "Data pending"
    IN_PROGRESS = "In progress"
    READY_FOR_REVIEW = "Ready for review"
    FILED = "Filed"


class TaskColumn(Enum):
    """Task column"""
    TODO = "todo"
    IN_PROGRESS = "in-progress"
    REVIEW = "review"
    DONE = "done"


@dataclass(frozen=True)
class Client:
    """Client entity"""
    id: str
    tenant_id: str
    name: str
    type: str
    industry: Optional[str] = None
    gstin: Optional[str] = None
    pan_enc: Optional[str] = None
    staff_id: Optional[str] = None
    fee_paise: int = 0
    client_tenant_id: Optional[str] = None
    health: str = "good"  # good, warning, critical
    books_status: str = "clean"  # clean, needs_review
    archived_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class ComplianceItem:
    """Compliance item"""
    id: str
    tenant_id: str
    client_id: str
    return_type: str
    group: ComplianceGroup
    period: str
    due_date: date
    status: ComplianceStatus = ComplianceStatus.NOT_STARTED
    assignee_id: Optional[str] = None
    arn: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class Task:
    """Task entity"""
    id: str
    tenant_id: str
    client_id: Optional[str] = None
    title: str = ""
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    due: Optional[date] = None
    priority: str = "medium"  # low, medium, high
    column: TaskColumn = TaskColumn.TODO
    position: int = 0  # Fractional index
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class ReviewItem:
    """Review item"""
    id: str
    tenant_id: str
    client_id: str
    rule_key: str
    entity_ref: Optional[Dict[str, Any]] = None
    issue: str = ""
    suggested_fix: Optional[Dict[str, Any]] = None
    amount_paise: int = 0
    status: str = "pending"  # pending, applied, dismissed
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())


@dataclass(frozen=True)
class TimeEntry:
    """Time entry"""
    id: str
    tenant_id: str
    client_id: str
    staff_id: str
    date: date
    hours: float
    rate_paise: int = 0
    billable: bool = True
    billed_invoice_id: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = field(default_factory=lambda: datetime.utcnow())
