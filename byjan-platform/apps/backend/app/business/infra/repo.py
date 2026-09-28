"""
Business repositories - data access layer
"""

from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
import structlog

from app.business.infra.orm import (
    AccountORM, PeriodORM, JournalORM, GlEntryORM,
    PartyORM, ItemORM, LocationORM,
    DocumentORM, DocumentLineORM,
    PaymentORM, PaymentAllocationORM, PaymentRunORM,
    BankConnectionORM, BankLineORM, BankRuleORM,
    AssetORM, ProjectORM, BudgetORM, TaxReturnORM, ApprovalORM
)
from app.business.domain.models import (
    Account, Period, Journal, GlEntry,
    Party, Item, Location,
    Document, DocumentLine,
    Payment, PaymentAllocation, PaymentRun,
    BankConnection, BankLine, BankRule,
    Asset, Project, Budget, TaxReturn, Approval
)

log = structlog.get_logger(__name__)


class AccountRepository:
    """Account repository"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, account_id: str) -> Optional[Account]:
        """Get account by ID"""
        stmt = select(AccountORM).where(AccountORM.id == account_id)
        result = await self.db.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_tenant_accounts(self, tenant_id: str, include_archived: bool = False) -> List[Account]:
        """Get all accounts for a tenant"""
        stmt = select(AccountORM).where(AccountORM.tenant_id == tenant_id)
        if not include_archived:
            stmt = stmt.where(AccountORM.archived_at.is_(None))
        result = await self.db.execute(stmt)
        orms = result.scalars().all()
        return [self._to_domain(orm) for orm in orms]

    async def create(self, account: Account) -> Account:
        """Create account"""
        orm = AccountORM(
            id=account.id,
            tenant_id=account.tenant_id,
            code=account.code,
            name=account.name,
            type=account.type.value,
            group=account.group.value if account.group else None,
            parent_id=account.parent_id,
            is_bank=account.is_bank,
            is_system=account.is_system,
            bank_meta_enc=account.bank_meta_enc,
        )
        self.db.add(orm)
        await self.db.flush()
        await self.db.refresh(orm)
        return self._to_domain(orm)

    async def _to_domain(self, orm: AccountORM) -> Account:
        """Convert ORM to domain"""
        return Account(
            id=str(orm.id),
            tenant_id=str(orm.tenant_id),
            code=orm.code,
            name=orm.name,
            type=orm.type,
            group=orm.group,
            parent_id=str(orm.parent_id) if orm.parent_id else None,
            is_bank=orm.is_bank,
            is_system=orm.is_system,
            bank_meta_enc=orm.bank_meta_enc,
            archived_at=orm.archived_at,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )


class PeriodRepository:
    """Period repository"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, period_id: str) -> Optional[Period]:
        """Get period by ID"""
        stmt = select(PeriodORM).where(PeriodORM.id == period_id)
        result = await self.db.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_tenant_periods(self, tenant_id: str, fy: Optional[str] = None) -> List[Period]:
        """Get all periods for a tenant"""
        stmt = select(PeriodORM).where(PeriodORM.tenant_id == tenant_id)
        if fy:
            stmt = stmt.where(PeriodORM.fy == fy)
        result = await self.db.execute(stmt)
        orms = result.scalars().all()
        return [self._to_domain(orm) for orm in orms]

    async def create(self, period: Period) -> Period:
        """Create period"""
        orm = PeriodORM(
            id=period.id,
            tenant_id=period.tenant_id,
            fy=period.fy,
            month=period.month,
            status=period.status.value,
        )
        self.db.add(orm)
        await self.db.flush()
        await self.db.refresh(orm)
        return self._to_domain(orm)

    async def update(self, period_id: str, updates: Dict[str, Any]) -> Optional[Period]:
        """Update period"""
        stmt = update(PeriodORM).where(PeriodORM.id == period_id).values(**updates)
        await self.db.execute(stmt)
        await self.db.flush()
        return await self.get_by_id(period_id)

    async def _to_domain(self, orm: PeriodORM) -> Period:
        """Convert ORM to domain"""
        return Period(
            id=str(orm.id),
            tenant_id=str(orm.tenant_id),
            fy=orm.fy,
            month=orm.month,
            status=orm.status,
            closed_by=str(orm.closed_by) if orm.closed_by else None,
            closed_at=orm.closed_at,
            locked_by=str(orm.locked_by) if orm.locked_by else None,
            locked_at=orm.locked_at,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )


class PartyRepository:
    """Party repository"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, party_id: str) -> Optional[Party]:
        """Get party by ID"""
        stmt = select(PartyORM).where(PartyORM.id == party_id)
        result = await self.db.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_tenant_parties(
        self, tenant_id: str, kind: Optional[str] = None
    ) -> List[Party]:
        """Get all parties for a tenant"""
        stmt = select(PartyORM).where(PartyORM.tenant_id == tenant_id)
        if kind:
            stmt = stmt.where(PartyORM.kind == kind)
        result = await self.db.execute(stmt)
        orms = result.scalars().all()
        return [self._to_domain(orm) for orm in orms]

    async def create(self, party: Party) -> Party:
        """Create party"""
        orm = PartyORM(
            id=party.id,
            tenant_id=party.tenant_id,
            kind=party.kind,
            name=party.name,
            gstin=party.gstin,
            pan_enc=party.pan_enc,
            state_code=party.state_code,
            email=party.email,
            phone=party.phone,
            terms_days=party.terms_days,
            category_id=party.category_id,
            group_name=party.group_name,
            credit_limit=party.credit_limit,
            addresses=party.addresses,
            opening_balance=party.opening_balance,
        )
        self.db.add(orm)
        await self.db.flush()
        await self.db.refresh(orm)
        return self._to_domain(orm)

    async def _to_domain(self, orm: PartyORM) -> Party:
        """Convert ORM to domain"""
        return Party(
            id=str(orm.id),
            tenant_id=str(orm.tenant_id),
            kind=orm.kind,
            name=orm.name,
            gstin=orm.gstin,
            pan_enc=orm.pan_enc,
            state_code=orm.state_code,
            email=orm.email,
            phone=orm.phone,
            terms_days=orm.terms_days,
            category_id=str(orm.category_id) if orm.category_id else None,
            group_name=orm.group_name,
            credit_limit=orm.credit_limit,
            addresses=orm.addresses or {},
            opening_balance=orm.opening_balance,
            archived_at=orm.archived_at,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )


class DocumentRepository:
    """Document repository"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, document_id: str) -> Optional[Document]:
        """Get document by ID"""
        stmt = select(DocumentORM).where(DocumentORM.id == document_id)
        result = await self.db.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_tenant_documents(
        self,
        tenant_id: str,
        type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Document]:
        """Get all documents for a tenant"""
        stmt = select(DocumentORM).where(DocumentORM.tenant_id == tenant_id)
        if type:
            stmt = stmt.where(DocumentORM.type == type)
        if status:
            stmt = stmt.where(DocumentORM.status == status)
        result = await self.db.execute(stmt)
        orms = result.scalars().all()
        return [self._to_domain(orm) for orm in orms]

    async def create(self, document: Document) -> Document:
        """Create document"""
        orm = DocumentORM(
            id=document.id,
            tenant_id=document.tenant_id,
            type=document.type.value,
            number=document.number,
            status=document.status.value,
            party_id=document.party_id,
            entity_id=document.entity_id,
            date=document.date,
            due_date=document.due_date,
            terms_days=document.terms_days,
            reference=document.reference,
            salesperson_id=document.salesperson_id,
            project_id=document.project_id,
            org_unit_id=document.org_unit_id,
            tax_mode=document.tax_mode.value,
            place_of_supply=document.place_of_supply,
            totals=document.totals,
            paid_paise=document.paid_paise,
            balance_paise=document.balance_paise,
            options=document.options,
            notes=document.notes,
            narration=document.narration,
            recurring=document.recurring,
            source_doc_id=document.source_doc_id,
        )
        self.db.add(orm)
        await self.db.flush()
        await self.db.refresh(orm)
        return self._to_domain(orm)

    async def _to_domain(self, orm: DocumentORM) -> Document:
        """Convert ORM to domain"""
        return Document(
            id=str(orm.id),
            tenant_id=str(orm.tenant_id),
            type=orm.type,
            number=orm.number,
            status=orm.status,
            party_id=str(orm.party_id) if orm.party_id else None,
            entity_id=str(orm.entity_id) if orm.entity_id else None,
            date=orm.date,
            due_date=orm.due_date,
            terms_days=orm.terms_days,
            reference=orm.reference,
            salesperson_id=str(orm.salesperson_id) if orm.salesperson_id else None,
            project_id=str(orm.project_id) if orm.project_id else None,
            org_unit_id=str(orm.org_unit_id) if orm.org_unit_id else None,
            tax_mode=orm.tax_mode,
            place_of_supply=orm.place_of_supply,
            totals=orm.totals or {},
            paid_paise=orm.paid_paise,
            balance_paise=orm.balance_paise,
            options=orm.options or {},
            notes=orm.notes,
            narration=orm.narration,
            recurring=orm.recurring,
            source_doc_id=str(orm.source_doc_id) if orm.source_doc_id else None,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )


class PaymentRepository:
    """Payment repository"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, payment_id: str) -> Optional[Payment]:
        """Get payment by ID"""
        stmt = select(PaymentORM).where(PaymentORM.id == payment_id)
        result = await self.db.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_tenant_payments(
        self, tenant_id: str, direction: Optional[str] = None
    ) -> List[Payment]:
        """Get all payments for a tenant"""
        stmt = select(PaymentORM).where(PaymentORM.tenant_id == tenant_id)
        if direction:
            stmt = stmt.where(PaymentORM.direction == direction)
        result = await self.db.execute(stmt)
        orms = result.scalars().all()
        return [self._to_domain(orm) for orm in orms]

    async def create(self, payment: Payment) -> Payment:
        """Create payment"""
        orm = PaymentORM(
            id=payment.id,
            tenant_id=payment.tenant_id,
            direction=payment.direction.value,
            party_id=payment.party_id,
            date=payment.date,
            mode=payment.mode,
            account_id=payment.account_id,
            amount_paise=payment.amount_paise,
            reference=payment.reference,
            status=payment.status,
        )
        self.db.add(orm)
        await self.db.flush()
        await self.db.refresh(orm)
        return self._to_domain(orm)

    async def _to_domain(self, orm: PaymentORM) -> Payment:
        """Convert ORM to domain"""
        return Payment(
            id=str(orm.id),
            tenant_id=str(orm.tenant_id),
            direction=orm.direction,
            party_id=str(orm.party_id),
            date=orm.date,
            mode=orm.mode,
            account_id=str(orm.account_id) if orm.account_id else None,
            amount_paise=orm.amount_paise,
            reference=orm.reference,
            status=orm.status,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )
