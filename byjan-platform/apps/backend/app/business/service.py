"""
Business application service — parties and documents (MVP).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

import structlog
from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.business.domain.models import Document, DocumentStatus, DocumentType, Party, TaxMode
from app.business.domain.rules import (
    build_gl_proposals,
    calculate_document_totals,
    normalize_discount_paise,
    normalize_document_action,
    normalize_document_lines_for_calc,
    line_rate_paise,
    resolve_document_transition,
    should_post_to_gl,
    totals_dict_from_calc,
    validate_gl_proposals,
    validate_journal_balance,
)
from app.business.infra.orm import (
    AccountORM,
    DocumentLineORM,
    DocumentORM,
    GlEntryORM,
    ItemORM,
    JournalORM,
    PartyORM,
    PaymentAllocationORM,
    PaymentORM,
)
from app.shared.ids import IdGen
from app.shared.types import Result

log = structlog.get_logger(__name__)


def _as_uuid(value: str) -> UUID:
    return UUID(str(value))


def _party_kind_from_ui(kind: Optional[str]) -> str:
    if not kind:
        return "customer"
    k = kind.lower()
    if k in ("c", "customer", "customers"):
        return "customer"
    if k in ("v", "s", "supplier", "vendor", "vendors", "suppliers"):
        return "supplier"
    if k == "both":
        return "both"
    return kind


def _party_to_dict(orm: PartyORM) -> Dict[str, Any]:
    kind = orm.kind or "customer"
    ui_k = "c" if kind == "customer" else "v" if kind == "supplier" else "b"
    addresses = orm.addresses or {}
    city = ""
    if isinstance(addresses, dict):
        billing = addresses.get("billing") or addresses.get("ship_to") or {}
        if isinstance(billing, dict):
            city = billing.get("city") or ""
        city = city or addresses.get("city") or ""
    return {
        "id": str(orm.id),
        "tenant_id": str(orm.tenant_id),
        "kind": kind,
        "name": orm.name,
        "gstin": orm.gstin,
        "state_code": orm.state_code,
        "email": orm.email,
        "phone": orm.phone,
        "terms_days": orm.terms_days or 30,
        "addresses": addresses,
        "opening_balance": orm.opening_balance or 0,
        "archived_at": orm.archived_at.isoformat() if orm.archived_at else None,
        # UI-friendly aliases used by BizLogic
        "k": ui_k,
        "n": orm.name,
        "g": orm.gstin or "",
        "e": orm.email or "",
        "ph": orm.phone or "",
        "city": city,
        "terms": orm.terms_days or 30,
        "st": orm.state_code or "",
    }


def _doc_type(value: str) -> DocumentType:
    try:
        return DocumentType(value)
    except ValueError:
        # allow enum name
        for t in DocumentType:
            if t.name.lower() == value.lower().replace("-", "_"):
                return t
        return DocumentType.INVOICES


def _doc_to_dict(orm: DocumentORM, lines: Optional[List[DocumentLineORM]] = None) -> Dict[str, Any]:
    totals = orm.totals or {}
    total_rupees = (totals.get("total") or totals.get("total_paise") or 0)
    if isinstance(total_rupees, (int, float)) and total_rupees > 100000:
        # likely paise
        total_display = total_rupees / 100.0
    else:
        total_display = float(total_rupees or 0)
    paid = (orm.paid_paise or 0) / 100.0
    ui_lines = []
    for ln in lines or []:
        ui_lines.append({
            "id": str(ln.id),
            "item": str(ln.item_id) if ln.item_id else "",
            "desc": ln.description or "",
            "q": str(ln.qty or 0),
            "r": str((ln.rate_paise or 0) / 100),
            "g": float(ln.gst_rate or 0) * 100 if ln.gst_rate and float(ln.gst_rate) <= 1 else float(ln.gst_rate or 0),
            "hsn": ln.hsn or "",
        })
    return {
        "id": str(orm.id),
        "tenant_id": str(orm.tenant_id),
        "type": orm.type,
        "number": orm.number,
        "status": orm.status,
        "party_id": str(orm.party_id) if orm.party_id else None,
        "date": orm.date.isoformat() if orm.date else None,
        "due_date": orm.due_date.isoformat() if orm.due_date else None,
        "terms_days": orm.terms_days or 30,
        "totals": totals,
        "paid_paise": orm.paid_paise or 0,
        "balance_paise": orm.balance_paise or 0,
        "notes": orm.notes,
        "narration": orm.narration,
        "lines": ui_lines,
        # UI aliases
        "tk": orm.type,
        "no": orm.number,
        "st": orm.status,
        "party": str(orm.party_id) if orm.party_id else "",
        "dt": 0,
        "due": orm.terms_days or 30,
        "terms": orm.terms_days or 30,
        "paid": paid,
        "disc": totals.get("disc") or 0,
        "notes": orm.notes or "",
        "nar": orm.narration or "",
        "act": [],
    }


def _account_to_dict(orm: AccountORM) -> Dict[str, Any]:
    return {
        "id": str(orm.id),
        "tenant_id": str(orm.tenant_id),
        "code": orm.code,
        "name": orm.name,
        "type": orm.type,
        "group": orm.group,
        "is_bank": bool(orm.is_bank),
        "is_system": bool(orm.is_system),
        "archived_at": orm.archived_at.isoformat() if orm.archived_at else None,
    }


def _item_to_dict(orm: ItemORM) -> Dict[str, Any]:
    gst = float(orm.gst_rate or 0)
    if gst <= 1:
        gst = gst * 100
    return {
        "id": str(orm.id),
        "tenant_id": str(orm.tenant_id),
        "type": orm.type,
        "sku": orm.sku,
        "name": orm.name,
        "unit": orm.unit,
        "hsn": orm.hsn,
        "gst_rate": gst,
        "sale_rate_paise": orm.sale_rate or 0,
        "purchase_rate_paise": orm.purchase_rate or 0,
        "sale_rate": (orm.sale_rate or 0) / 100,
        "purchase_rate": (orm.purchase_rate or 0) / 100,
        "track_stock": bool(orm.track_stock),
    }


def _payment_to_dict(orm: PaymentORM) -> Dict[str, Any]:
    return {
        "id": str(orm.id),
        "tenant_id": str(orm.tenant_id),
        "direction": orm.direction,
        "party_id": str(orm.party_id) if orm.party_id else None,
        "date": orm.date.isoformat() if orm.date else None,
        "mode": orm.mode,
        "account_id": str(orm.account_id) if orm.account_id else None,
        "amount_paise": orm.amount_paise or 0,
        "amount": (orm.amount_paise or 0) / 100,
        "reference": orm.reference,
        "status": orm.status,
    }


class BusinessService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _company_state_code(self, tenant_id: str, data: Dict[str, Any], party_state: Optional[str]) -> str:
        return str(data.get("company_state_code") or data.get("place_of_supply") or party_state or "27")

    async def _document_calc(
        self,
        tenant_id: str,
        doc_type: str,
        raw_lines: List[Dict[str, Any]],
        data: Dict[str, Any],
        party_id: Optional[str],
    ):
        party_state = None
        if party_id:
            p = await self.db.get(PartyORM, _as_uuid(str(party_id)))
            if p and str(p.tenant_id) == tenant_id:
                party_state = p.state_code
        calc_lines = normalize_document_lines_for_calc(raw_lines, doc_type)
        company_state = await self._company_state_code(tenant_id, data, party_state)
        discount_paise = normalize_discount_paise(data)
        return calculate_document_totals(
            calc_lines,
            party_state_code=party_state,
            company_state_code=company_state,
            document_type=doc_type,
            discount=discount_paise,
            terms_days=int(data.get("terms_days") or data.get("terms") or 30),
        )

    async def ensure_default_coa(self, tenant_id: str, *, commit: bool = True) -> None:
        """Idempotent seed of system GL accounts required for document posting."""
        existing = await self._accounts_by_code(tenant_id)
        defaults = [
            ("1100", "Sundry debtors", "asset", True),
            ("1310", "GST input credit", "asset", True),
            ("2100", "Sundry creditors", "liability", True),
            ("2310", "GST payable", "liability", True),
            ("4000", "Sales", "income", True),
            ("5000", "Expenses", "expense", True),
            ("1000", "Cash in hand", "asset", False),
            ("1010", "Bank account", "asset", False),
        ]
        added = False
        for code, name, acc_type, is_system in defaults:
            if code in existing:
                continue
            self.db.add(
                AccountORM(
                    id=_as_uuid(IdGen.document_id()),
                    tenant_id=_as_uuid(tenant_id),
                    code=code,
                    name=name,
                    type=acc_type,
                    is_bank=(code == "1010"),
                    is_system=is_system,
                )
            )
            added = True
        if added and commit:
            await self.db.commit()

    async def get_dashboard(self, tenant_id: str) -> Dict[str, Any]:
        tid = _as_uuid(tenant_id)
        docs = list(
            (
                await self.db.execute(
                    select(DocumentORM).where(DocumentORM.tenant_id == tid)
                )
            ).scalars().all()
        )
        open_ar = ("Sent", "Overdue", "Partly paid")
        open_ap = ("Open", "Overdue", "Partly paid")
        recv = sum(
            max(0, d.balance_paise or 0)
            for d in docs
            if d.type == "invoices" and d.status in open_ar
        )
        pay = sum(
            max(0, d.balance_paise or 0)
            for d in docs
            if d.type == "bills" and d.status in open_ap
        )
        overdue_n = sum(1 for d in docs if d.status == "Overdue")
        drafts = sum(1 for d in docs if d.status == "Draft")
        return {
            "kpis": {
                "receivables_paise": recv,
                "payables_paise": pay,
                "overdue_count": overdue_n,
                "draft_count": drafts,
                "document_count": len(docs),
            },
            "work_waiting": {
                "overdue": overdue_n,
                "drafts": drafts,
                "approvals": sum(1 for d in docs if d.status == "Pending approval"),
            },
            "cash_and_bank": {},
            "receivables": {"open_paise": recv},
            "payables": {"open_paise": pay},
        }

    async def list_parties(
        self,
        tenant_id: str,
        kind: Optional[str] = None,
        q: Optional[str] = None,
        archived: Optional[bool] = None,
    ) -> List[Dict[str, Any]]:
        stmt = select(PartyORM).where(PartyORM.tenant_id == _as_uuid(tenant_id))
        if kind:
            stmt = stmt.where(PartyORM.kind == _party_kind_from_ui(kind))
        if archived is True:
            stmt = stmt.where(PartyORM.archived_at.is_not(None))
        elif archived is False or archived is None:
            stmt = stmt.where(PartyORM.archived_at.is_(None))
        result = await self.db.execute(stmt.order_by(PartyORM.created_at.desc()))
        rows = [_party_to_dict(o) for o in result.scalars().all()]
        if q:
            ql = q.lower()
            rows = [r for r in rows if ql in (r["name"] or "").lower() or ql in (r.get("gstin") or "").lower() or ql in (r.get("email") or "").lower()]
        return rows

    async def create_party(self, tenant_id: str, data: Dict[str, Any]) -> Result[Dict[str, Any], str]:
        try:
            name = data.get("name") or data.get("n")
            if not name:
                return Result.err("party.name_required")
            kind = _party_kind_from_ui(data.get("kind") or data.get("k"))
            city = data.get("city") or ""
            addresses = data.get("addresses") or {}
            if city and "billing" not in addresses:
                addresses = {**addresses, "billing": {"city": city}, "city": city}
            orm = PartyORM(
                id=_as_uuid(IdGen.document_id()),
                tenant_id=_as_uuid(tenant_id),
                kind=kind,
                name=name.strip(),
                gstin=data.get("gstin") or data.get("g") or None,
                state_code=data.get("state_code") or data.get("st") or None,
                email=data.get("email") or data.get("e") or None,
                phone=data.get("phone") or data.get("ph") or None,
                terms_days=int(data.get("terms_days") or data.get("terms") or 30),
                addresses=addresses,
            )
            self.db.add(orm)
            await self.db.commit()
            await self.db.refresh(orm)
            return Result.ok(_party_to_dict(orm))
        except Exception as e:
            await self.db.rollback()
            log.error("create_party_error", error=str(e))
            return Result.err("party.create_failed")

    async def get_party(self, tenant_id: str, party_id: str) -> Optional[Dict[str, Any]]:
        orm = await self.db.get(PartyORM, _as_uuid(party_id))
        if not orm or str(orm.tenant_id) != tenant_id:
            return None
        return _party_to_dict(orm)

    async def update_party(self, tenant_id: str, party_id: str, data: Dict[str, Any]) -> Result[Dict[str, Any], str]:
        try:
            orm = await self.db.get(PartyORM, _as_uuid(party_id))
            if not orm or str(orm.tenant_id) != tenant_id:
                return Result.err("party.not_found")
            if "name" in data or "n" in data:
                orm.name = (data.get("name") or data.get("n") or orm.name).strip()
            if "gstin" in data or "g" in data:
                orm.gstin = data.get("gstin") if "gstin" in data else data.get("g")
            if "email" in data or "e" in data:
                orm.email = data.get("email") if "email" in data else data.get("e")
            if "phone" in data or "ph" in data:
                orm.phone = data.get("phone") if "phone" in data else data.get("ph")
            if "terms_days" in data or "terms" in data:
                orm.terms_days = int(data.get("terms_days") or data.get("terms") or orm.terms_days or 30)
            if "state_code" in data or "st" in data:
                orm.state_code = data.get("state_code") if "state_code" in data else data.get("st")
            if "city" in data:
                addrs = dict(orm.addresses or {})
                billing = dict(addrs.get("billing") or {})
                billing["city"] = data["city"]
                addrs["billing"] = billing
                addrs["city"] = data["city"]
                orm.addresses = addrs
            if "kind" in data or "k" in data:
                orm.kind = _party_kind_from_ui(data.get("kind") or data.get("k"))
            await self.db.commit()
            await self.db.refresh(orm)
            return Result.ok(_party_to_dict(orm))
        except Exception as e:
            await self.db.rollback()
            log.error("update_party_error", error=str(e))
            return Result.err("party.update_failed")

    async def set_party_archived(self, tenant_id: str, party_id: str, archived: bool) -> Result[Dict[str, Any], str]:
        try:
            orm = await self.db.get(PartyORM, _as_uuid(party_id))
            if not orm or str(orm.tenant_id) != tenant_id:
                return Result.err("party.not_found")
            orm.archived_at = datetime.utcnow() if archived else None
            await self.db.commit()
            await self.db.refresh(orm)
            return Result.ok(_party_to_dict(orm))
        except Exception as e:
            await self.db.rollback()
            log.error("archive_party_error", error=str(e))
            return Result.err("party.archive_failed")

    async def list_documents(
        self,
        tenant_id: str,
        type: Optional[str] = None,
        status: Optional[str] = None,
        party_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        stmt = select(DocumentORM).where(DocumentORM.tenant_id == _as_uuid(tenant_id))
        if type:
            stmt = stmt.where(DocumentORM.type == type)
        if status:
            stmt = stmt.where(DocumentORM.status == status)
        if party_id:
            stmt = stmt.where(DocumentORM.party_id == _as_uuid(party_id))
        result = await self.db.execute(stmt.order_by(DocumentORM.created_at.desc()))
        docs = list(result.scalars().all())
        out = []
        for d in docs:
            lines = await self._lines_for(str(d.id))
            out.append(_doc_to_dict(d, lines))
        return out

    async def _lines_for(self, document_id: str) -> List[DocumentLineORM]:
        stmt = (
            select(DocumentLineORM)
            .where(DocumentLineORM.document_id == _as_uuid(document_id))
            .order_by(DocumentLineORM.position.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_document(self, tenant_id: str, document_id: str) -> Optional[Dict[str, Any]]:
        orm = await self.db.get(DocumentORM, _as_uuid(document_id))
        if not orm or str(orm.tenant_id) != tenant_id:
            return None
        lines = await self._lines_for(document_id)
        return _doc_to_dict(orm, lines)

    async def create_document(self, tenant_id: str, data: Dict[str, Any]) -> Result[Dict[str, Any], str]:
        try:
            doc_type = data.get("type") or data.get("tk") or "invoices"
            number = data.get("number") or data.get("no")
            if not number:
                number = await self._next_number(tenant_id, doc_type)
            status_val = data.get("status") or data.get("st") or "Draft"
            party_id = data.get("party_id") or data.get("party") or None
            terms = int(data.get("terms_days") or data.get("terms") or 30)
            doc_date = data.get("date")
            if isinstance(doc_date, str):
                doc_date = date.fromisoformat(doc_date[:10])
            elif not isinstance(doc_date, date):
                doc_date = date.today()
            due_date = data.get("due_date")
            if isinstance(due_date, str):
                due_date = date.fromisoformat(due_date[:10])
            elif due_date is None:
                due_date = doc_date + timedelta(days=terms)

            raw_lines = data.get("lines") or []
            party_state = None
            if party_id:
                party_orm = await self.db.get(PartyORM, _as_uuid(str(party_id)))
                if party_orm and str(party_orm.tenant_id) == tenant_id:
                    party_state = party_orm.state_code
            calc = await self._document_calc(tenant_id, doc_type, raw_lines, data, party_id)
            if doc_type == "journals":
                j_err = validate_journal_balance(calc)
                if j_err and (data.get("status") or data.get("st") or "Draft") != "Draft":
                    return Result.err(j_err)
            totals = totals_dict_from_calc(calc)
            total_paise = totals["total_paise"]

            doc_id = _as_uuid(IdGen.document_id())
            orm = DocumentORM(
                id=doc_id,
                tenant_id=_as_uuid(tenant_id),
                type=doc_type,
                number=number,
                status=status_val,
                party_id=_as_uuid(str(party_id)) if party_id else None,
                date=doc_date,
                due_date=due_date,
                terms_days=terms,
                tax_mode=data.get("tax_mode") or "exclusive",
                place_of_supply=data.get("place_of_supply") or party_state,
                totals=totals,
                paid_paise=0,
                balance_paise=total_paise,
                notes=data.get("notes"),
                narration=data.get("narration") or data.get("nar"),
                options=data.get("options") or {},
            )
            self.db.add(orm)
            await self.db.flush()

            for i, ln in enumerate(raw_lines):
                qty = Decimal(str(ln.get("q") or ln.get("qty") or 0))
                rate_paise = line_rate_paise(ln)
                gst = float(ln.get("g") or ln.get("gst_rate") or 0)
                gst_rate = Decimal(str(gst / 100.0 if gst > 1 else gst))
                item_id = ln.get("item_id") or ln.get("item") or None
                line = DocumentLineORM(
                    id=_as_uuid(IdGen.document_id()),
                    document_id=doc_id,
                    position=i,
                    item_id=_as_uuid(str(item_id)) if item_id and len(str(item_id)) > 10 else None,
                    description=ln.get("desc") or ln.get("description") or None,
                    hsn=ln.get("hsn"),
                    qty=qty,
                    rate_paise=rate_paise,
                    gst_rate=gst_rate,
                    amount_paise=int(round(float(qty) * rate_paise)),
                    dr_paise=int(ln.get("dr_paise") or round(float(ln.get("dr") or 0) * (100 if ln.get("acc") is not None else 1))),
                    cr_paise=int(ln.get("cr_paise") or round(float(ln.get("cr") or 0) * (100 if ln.get("acc") is not None else 1))),
                )
                self.db.add(line)

            await self.db.commit()
            return Result.ok(await self.get_document(tenant_id, str(doc_id)))
        except Exception as e:
            await self.db.rollback()
            log.error("create_document_error", error=str(e))
            return Result.err("document.create_failed")

    async def update_document(self, tenant_id: str, document_id: str, data: Dict[str, Any]) -> Result[Dict[str, Any], str]:
        try:
            orm = await self.db.get(DocumentORM, _as_uuid(document_id))
            if not orm or str(orm.tenant_id) != tenant_id:
                return Result.err("document.not_found")
            if "status" in data or "st" in data:
                orm.status = data.get("status") or data.get("st") or orm.status
            if "notes" in data:
                orm.notes = data["notes"]
            if "narration" in data or "nar" in data:
                orm.narration = data.get("narration") if "narration" in data else data.get("nar")
            if "party_id" in data or "party" in data:
                pid = data.get("party_id") if "party_id" in data else data.get("party")
                orm.party_id = _as_uuid(str(pid)) if pid else None
            if "terms_days" in data or "terms" in data:
                orm.terms_days = int(data.get("terms_days") or data.get("terms") or orm.terms_days or 30)
            if "lines" in data:
                raw_lines = data.get("lines") or []
                calc = await self._document_calc(
                    tenant_id,
                    orm.type,
                    raw_lines,
                    {**data, "place_of_supply": orm.place_of_supply},
                    str(orm.party_id) if orm.party_id else None,
                )
                if orm.type == "journals":
                    j_err = validate_journal_balance(calc)
                    if j_err:
                        return Result.err(j_err)
                totals = totals_dict_from_calc(calc)
                orm.totals = totals
                orm.balance_paise = max(0, totals["total_paise"] - (orm.paid_paise or 0))
                await self.db.execute(
                    delete(DocumentLineORM).where(DocumentLineORM.document_id == orm.id)
                )
                for i, ln in enumerate(raw_lines):
                    qty = Decimal(str(ln.get("q") or ln.get("qty") or 0))
                    rate_paise = line_rate_paise(ln)
                    gst = float(ln.get("g") or ln.get("gst_rate") or 0)
                    gst_rate = Decimal(str(gst / 100.0 if gst > 1 else gst))
                    item_id = ln.get("item_id") or ln.get("item") or None
                    line = DocumentLineORM(
                        id=_as_uuid(IdGen.document_id()),
                        document_id=orm.id,
                        position=i,
                        item_id=_as_uuid(str(item_id)) if item_id and len(str(item_id)) > 10 else None,
                        description=ln.get("desc") or ln.get("description") or None,
                        hsn=ln.get("hsn"),
                        qty=qty,
                        rate_paise=rate_paise,
                        gst_rate=gst_rate,
                        amount_paise=int(round(float(qty) * rate_paise)),
                        dr_paise=int(ln.get("dr_paise") or round(float(ln.get("dr") or 0) * 100)),
                        cr_paise=int(ln.get("cr_paise") or round(float(ln.get("cr") or 0) * 100)),
                    )
                    self.db.add(line)
            await self.db.commit()
            return Result.ok(await self.get_document(tenant_id, document_id))
        except Exception as e:
            await self.db.rollback()
            log.error("update_document_error", error=str(e))
            return Result.err("document.update_failed")

    async def _next_number(self, tenant_id: str, doc_type: str) -> str:
        prefix = {
            "invoices": "INV-",
            "bills": "BILL-",
            "quotes": "QT-",
            "estimates": "EST-",
            "expenses": "EXP-",
            "journals": "JV-",
        }.get(doc_type, "DOC-")
        stmt = select(DocumentORM.number).where(
            DocumentORM.tenant_id == _as_uuid(tenant_id),
            DocumentORM.type == doc_type,
        )
        result = await self.db.execute(stmt)
        nums = []
        for (n,) in result.all():
            digits = "".join(ch for ch in (n or "") if ch.isdigit())
            if digits:
                nums.append(int(digits))
        nxt = (max(nums) if nums else 0) + 1
        return f"{prefix}{nxt}"

    async def _accounts_by_code(self, tenant_id: str) -> Dict[str, UUID]:
        stmt = select(AccountORM.code, AccountORM.id).where(
            AccountORM.tenant_id == _as_uuid(tenant_id),
            AccountORM.archived_at.is_(None),
        )
        result = await self.db.execute(stmt)
        return {str(code): acc_id for code, acc_id in result.all()}

    async def _post_document_gl(
        self,
        tenant_id: str,
        orm: DocumentORM,
        totals: Dict[str, Any],
        lines: List[DocumentLineORM],
    ) -> Result[Optional[str], str]:
        """Create balanced journal + GL rows when COA accounts exist; otherwise validate only."""
        if orm.type == "journals":
            calc = calculate_document_totals(
                [{"dr": ln.dr_paise or 0, "cr": ln.cr_paise or 0} for ln in lines],
                party_state_code=None,
                company_state_code="27",
                document_type="journals",
            )
            err = validate_journal_balance(calc)
            if err:
                return Result.err(err)
            line_accounts = [ln for ln in lines if ln.account_id and (ln.dr_paise or ln.cr_paise)]
            if not line_accounts:
                log.info(
                    "journal_gl_posting_validated",
                    document_id=str(orm.id),
                    dr_paise=calc.dr,
                    cr_paise=calc.cr,
                )
                return Result.ok(None)

            existing = await self.db.execute(
                select(JournalORM.id).where(
                    JournalORM.tenant_id == _as_uuid(tenant_id),
                    JournalORM.source_type == orm.type,
                    JournalORM.source_id == orm.id,
                )
            )
            if existing.scalar_one_or_none():
                return Result.ok(None)

            journal_id = _as_uuid(IdGen.document_id())
            journal = JournalORM(
                id=journal_id,
                tenant_id=_as_uuid(tenant_id),
                source_type=orm.type,
                source_id=orm.id,
                date=orm.date,
                narration=orm.narration or orm.number,
                posted_at=datetime.utcnow(),
            )
            self.db.add(journal)
            for ln in line_accounts:
                self.db.add(
                    GlEntryORM(
                        id=_as_uuid(IdGen.document_id()),
                        tenant_id=_as_uuid(tenant_id),
                        journal_id=journal_id,
                        account_id=ln.account_id,
                        dr_paise=ln.dr_paise or 0,
                        cr_paise=ln.cr_paise or 0,
                        party_id=orm.party_id,
                        date=orm.date,
                    )
                )
            return Result.ok(str(journal_id))

        proposals = build_gl_proposals(orm.type, totals)
        gl_err = validate_gl_proposals(proposals)
        if gl_err:
            return Result.err(gl_err)

        existing = await self.db.execute(
            select(JournalORM.id).where(
                JournalORM.tenant_id == _as_uuid(tenant_id),
                JournalORM.source_type == orm.type,
                JournalORM.source_id == orm.id,
            )
        )
        if existing.scalar_one_or_none():
            return Result.ok(None)

        accounts = await self._accounts_by_code(tenant_id)
        if not accounts:
            await self.ensure_default_coa(tenant_id)
            accounts = await self._accounts_by_code(tenant_id)
        if not accounts:
            log.warning(
                "gl_posting_skipped_no_coa",
                tenant_id=tenant_id,
                document_id=str(orm.id),
                doc_type=orm.type,
            )
            return Result.ok(None)

        journal_id = _as_uuid(IdGen.document_id())
        journal = JournalORM(
            id=journal_id,
            tenant_id=_as_uuid(tenant_id),
            source_type=orm.type,
            source_id=orm.id,
            date=orm.date,
            narration=orm.narration or orm.number,
            posted_at=datetime.utcnow(),
        )
        self.db.add(journal)

        for prop in proposals:
            account_id = accounts.get(prop.account_code)
            if not account_id:
                return Result.err("gl.account_missing")
            self.db.add(
                GlEntryORM(
                    id=_as_uuid(IdGen.document_id()),
                    tenant_id=_as_uuid(tenant_id),
                    journal_id=journal_id,
                    account_id=account_id,
                    dr_paise=prop.dr_paise,
                    cr_paise=prop.cr_paise,
                    party_id=orm.party_id,
                    date=orm.date,
                )
            )
        return Result.ok(str(journal_id))

    async def document_action(
        self,
        tenant_id: str,
        document_id: str,
        action: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Result[Dict[str, Any], str]:
        payload = payload or {}
        try:
            orm = await self.db.get(DocumentORM, _as_uuid(document_id))
            if not orm or str(orm.tenant_id) != tenant_id:
                return Result.err("document.not_found")

            act = normalize_document_action(action)
            new_status, err = resolve_document_transition(orm.type, orm.status, act)
            if err:
                return Result.err(err)

            lines = await self._lines_for(document_id)
            totals = orm.totals or {}
            journal_id: Optional[str] = None

            if should_post_to_gl(orm.type, act, new_status):
                gl_result = await self._post_document_gl(tenant_id, orm, totals, lines)
                if gl_result.is_err():
                    return Result.err(gl_result.unwrap_err())
                journal_id = gl_result.unwrap()

            if new_status:
                orm.status = new_status
                if act in ("post", "send") and orm.type == "expenses" and new_status == "Posted":
                    total_paise = int(totals.get("total_paise") or totals.get("total") or 0)
                    orm.paid_paise = total_paise
                    orm.balance_paise = 0

            if act == "pay" and payload.get("amount_paise"):
                paid = int(payload["amount_paise"])
                total_paise = int(totals.get("total_paise") or totals.get("total") or 0)
                orm.paid_paise = (orm.paid_paise or 0) + paid
                orm.balance_paise = max(0, total_paise - orm.paid_paise)
                if orm.balance_paise == 0 and total_paise > 0:
                    orm.status = "Paid"
                elif orm.paid_paise > 0 and orm.balance_paise > 0:
                    orm.status = "Partly paid"

            await self.db.commit()
            doc = await self.get_document(tenant_id, document_id)
            assert doc is not None
            out: Dict[str, Any] = {"status": "ok", "action": action, "document": doc}
            if journal_id:
                out["journal_id"] = journal_id
            return Result.ok(out)
        except Exception as e:
            await self.db.rollback()
            log.error("document_action_error", error=str(e), action=action)
            return Result.err("document.action_failed")

    async def delete_document(self, tenant_id: str, document_id: str) -> Result[Dict[str, Any], str]:
        try:
            orm = await self.db.get(DocumentORM, _as_uuid(document_id))
            if not orm or str(orm.tenant_id) != tenant_id:
                return Result.err("document.not_found")
            if (orm.status or "Draft") != "Draft":
                return Result.err("document.delete_not_draft")
            await self.db.execute(
                delete(DocumentLineORM).where(DocumentLineORM.document_id == orm.id)
            )
            await self.db.execute(delete(DocumentORM).where(DocumentORM.id == orm.id))
            await self.db.commit()
            return Result.ok({"status": "ok", "id": document_id})
        except Exception as e:
            await self.db.rollback()
            log.error("delete_document_error", error=str(e))
            return Result.err("document.delete_failed")

    async def list_accounts(self, tenant_id: str, q: Optional[str] = None, type: Optional[str] = None) -> List[Dict[str, Any]]:
        await self.ensure_default_coa(tenant_id)
        stmt = select(AccountORM).where(
            AccountORM.tenant_id == _as_uuid(tenant_id),
            AccountORM.archived_at.is_(None),
        )
        if type:
            stmt = stmt.where(AccountORM.type == type)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(AccountORM.name.ilike(like), AccountORM.code.ilike(like)))
        result = await self.db.execute(stmt.order_by(AccountORM.code.asc()))
        return [_account_to_dict(a) for a in result.scalars().all()]

    async def create_account(self, tenant_id: str, data: Dict[str, Any]) -> Result[Dict[str, Any], str]:
        try:
            code = (data.get("code") or "").strip()
            name = (data.get("name") or "").strip()
            acc_type = (data.get("type") or "expense").strip().lower()
            if not code or not name:
                return Result.err("account.invalid")
            orm = AccountORM(
                id=_as_uuid(IdGen.document_id()),
                tenant_id=_as_uuid(tenant_id),
                code=code,
                name=name,
                type=acc_type,
                group=data.get("group"),
                is_bank=bool(data.get("is_bank")),
                is_system=False,
            )
            self.db.add(orm)
            await self.db.commit()
            await self.db.refresh(orm)
            return Result.ok(_account_to_dict(orm))
        except Exception as e:
            await self.db.rollback()
            log.error("create_account_error", error=str(e))
            return Result.err("account.create_failed")

    async def list_items(self, tenant_id: str, q: Optional[str] = None, type: Optional[str] = None) -> List[Dict[str, Any]]:
        stmt = select(ItemORM).where(ItemORM.tenant_id == _as_uuid(tenant_id))
        if type:
            stmt = stmt.where(ItemORM.type == type)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(ItemORM.name.ilike(like), ItemORM.sku.ilike(like)))
        result = await self.db.execute(stmt.order_by(ItemORM.name.asc()))
        return [_item_to_dict(i) for i in result.scalars().all()]

    async def create_item(self, tenant_id: str, data: Dict[str, Any]) -> Result[Dict[str, Any], str]:
        try:
            name = (data.get("name") or "").strip()
            if not name:
                return Result.err("item.invalid")
            gst = data.get("gst_rate")
            gst_rate = Decimal(str(gst)) if gst is not None else Decimal("0.18")
            if gst_rate > 1:
                gst_rate = gst_rate / Decimal("100")
            sale = data.get("sale_rate_paise")
            if sale is None and data.get("sale_rate") is not None:
                sale = int(round(float(data["sale_rate"]) * 100))
            purchase = data.get("purchase_rate_paise")
            if purchase is None and data.get("purchase_rate") is not None:
                purchase = int(round(float(data["purchase_rate"]) * 100))
            orm = ItemORM(
                id=_as_uuid(IdGen.document_id()),
                tenant_id=_as_uuid(tenant_id),
                type=(data.get("type") or "goods").strip().lower(),
                sku=data.get("sku"),
                name=name,
                unit=data.get("unit") or "nos",
                hsn=data.get("hsn"),
                gst_rate=gst_rate,
                sale_rate=int(sale or 0),
                purchase_rate=int(purchase or 0),
                track_stock=bool(data.get("track_stock", True)),
            )
            self.db.add(orm)
            await self.db.commit()
            await self.db.refresh(orm)
            return Result.ok(_item_to_dict(orm))
        except Exception as e:
            await self.db.rollback()
            log.error("create_item_error", error=str(e))
            return Result.err("item.create_failed")

    async def list_payments(
        self,
        tenant_id: str,
        direction: Optional[str] = None,
        party_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        stmt = select(PaymentORM).where(PaymentORM.tenant_id == _as_uuid(tenant_id))
        if direction:
            stmt = stmt.where(PaymentORM.direction == direction)
        if party_id:
            stmt = stmt.where(PaymentORM.party_id == _as_uuid(party_id))
        result = await self.db.execute(stmt.order_by(PaymentORM.date.desc(), PaymentORM.created_at.desc()))
        return [_payment_to_dict(p) for p in result.scalars().all()]

    async def create_payment(self, tenant_id: str, data: Dict[str, Any]) -> Result[Dict[str, Any], str]:
        try:
            party_id = data.get("party_id") or data.get("party")
            amount = data.get("amount_paise")
            if amount is None and data.get("amount") is not None:
                amount = int(round(float(data["amount"]) * 100))
            if not party_id or not amount or int(amount) <= 0:
                return Result.err("payment.invalid")
            direction = (data.get("direction") or "in").strip().lower()
            if direction not in ("in", "out"):
                return Result.err("payment.invalid")
            pay_date = data.get("date")
            if isinstance(pay_date, str):
                pay_date = date.fromisoformat(pay_date[:10])
            elif not isinstance(pay_date, date):
                pay_date = date.today()
            pay_id = _as_uuid(IdGen.document_id())
            orm = PaymentORM(
                id=pay_id,
                tenant_id=_as_uuid(tenant_id),
                direction=direction,
                party_id=_as_uuid(str(party_id)),
                date=pay_date,
                mode=(data.get("mode") or "bank").strip().lower(),
                account_id=_as_uuid(str(data["account_id"])) if data.get("account_id") else None,
                amount_paise=int(amount),
                reference=data.get("reference") or data.get("ref"),
                status="posted",
            )
            self.db.add(orm)
            await self.db.flush()

            remaining = int(amount)
            doc_id = data.get("document_id") or data.get("document")
            allocations = data.get("allocations") or ([] if not doc_id else [{"document_id": doc_id, "amount_paise": remaining}])
            for alloc in allocations:
                if remaining <= 0:
                    break
                aid = alloc.get("document_id") or alloc.get("document")
                if not aid:
                    continue
                alloc_amt = int(alloc.get("amount_paise") or remaining)
                alloc_amt = min(alloc_amt, remaining)
                doc = await self.db.get(DocumentORM, _as_uuid(str(aid)))
                if not doc or str(doc.tenant_id) != tenant_id:
                    continue
                self.db.add(
                    PaymentAllocationORM(
                        id=_as_uuid(IdGen.document_id()),
                        payment_id=pay_id,
                        document_id=doc.id,
                        amount_paise=alloc_amt,
                        tds_paise=int(alloc.get("tds_paise") or 0),
                    )
                )
                total_paise = int((doc.totals or {}).get("total_paise") or (doc.totals or {}).get("total") or 0)
                doc.paid_paise = (doc.paid_paise or 0) + alloc_amt + int(alloc.get("tds_paise") or 0)
                doc.balance_paise = max(0, total_paise - doc.paid_paise)
                if doc.balance_paise == 0 and total_paise > 0:
                    doc.status = "Paid"
                elif doc.paid_paise > 0:
                    doc.status = "Partly paid"
                remaining -= alloc_amt

            await self.db.commit()
            await self.db.refresh(orm)
            return Result.ok(_payment_to_dict(orm))
        except Exception as e:
            await self.db.rollback()
            log.error("create_payment_error", error=str(e))
            return Result.err("payment.create_failed")
