"""
Business service layer
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
import structlog

from app.business.domain.models import Document, DocumentType, DocumentStatus, Account, Party, Item, Period, Payment
from app.business.domain.rules import calculate_document_totals, validate_gstin, validate_pan, validate_phone, validate_email
from app.shared.ids import IdGen
from app.shared.types import Result
from app.shared.database import UnitOfWork

log = structlog.get_logger(__name__)


class BusinessService:
    """Business application service"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.uow = UnitOfWork(db)

    async def get_dashboard(self, tenant_id: str) -> Dict[str, Any]:
        """Get business dashboard data"""
        # TODO: Query real dashboard data
        return {
            "kpis": {},
            "work_waiting": {},
            "cash_and_bank": {},
            "receivables": {},
            "payables": {},
        }

    async def get_accounts(self, tenant_id: str, view: Optional[str] = None) -> List[Account]:
        """Get chart of accounts"""
        # TODO: Query from database
        return []

    async def create_account(self, tenant_id: str, data: Dict[str, Any]) -> Account:
        """Create account"""
        # TODO: Validate and create
        account = Account(
            id=IdGen.document_id(),
            tenant_id=tenant_id,
            code=data.get("code", ""),
            name=data.get("name", ""),
            type=data.get("type", "expense"),
            group=data.get("group"),
            parent_id=data.get("parent_id"),
            is_bank=data.get("is_bank", False),
        )
        return account

    async def get_document(
        self, tenant_id: str, document_id: str
    ) -> Optional[Document]:
        """Get document"""
        # TODO: Query from database
        return None

    async def create_document(
        self, tenant_id: str, data: Dict[str, Any]
    ) -> Result[Document, str]:
        """Create document"""
        try:
            # Calculate totals
            calculation = calculate_document_totals(
                lines=data.get("lines", []),
                party_state_code=data.get("party_state_code"),
                company_state_code=data.get("company_state_code", ""),
                document_type=data.get("type", "invoices"),
                discount=data.get("discount", 0),
            )

            # Create document
            document = Document(
                id=IdGen.document_id(),
                tenant_id=tenant_id,
                type=data.get("type"),
                number=data.get("number", ""),
                status=DocumentStatus.DRAFT,
                party_id=data.get("party_id"),
                date=data.get("date", date.today()),
                totals=calculation.__dict__,
            )

            return Result.ok(document)
        except Exception as e:
            log.error("create_document_error", error=str(e))
            return Result.err("document.create_failed")

    async def calculate_document_preview(
        self, tenant_id: str, data: Dict[str, Any]
    ) -> Result[Dict[str, Any], str]:
        """Calculate document totals for preview"""
        try:
            calculation = calculate_document_totals(
                lines=data.get("lines", []),
                party_state_code=data.get("party_state_code"),
                company_state_code=data.get("company_state_code", ""),
                document_type=data.get("type", "invoices"),
                discount=data.get("discount", 0),
            )
            return Result.ok(calculation.__dict__)
        except Exception as e:
            log.error("calculate_document_error", error=str(e))
            return Result.err("validation.failed")

    async def validate_party_data(self, data: Dict[str, Any]) -> Result[Dict[str, Any], List[str]]:
        """Validate party data"""
        errors = []

        if data.get("gstin"):
            if not validate_gstin(data["gstin"]):
                errors.append("Invalid GSTIN format")

        if data.get("pan"):
            if not validate_pan(data["pan"]):
                errors.append("Invalid PAN format")

        if data.get("phone"):
            if not validate_phone(data["phone"]):
                errors.append("Invalid phone format")

        if data.get("email"):
            if not validate_email(data["email"]):
                errors.append("Invalid email format")

        if errors:
            return Result.err(errors)
        return Result.ok(data)

    async def get_tax_returns(self, tenant_id: str, period: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get tax returns"""
        # TODO: Query from database
        return []

    async def get_gstr2b_mismatches(self, tenant_id: str, period: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get GSTR-2B mismatches"""
        # TODO: Query from database
        return []
