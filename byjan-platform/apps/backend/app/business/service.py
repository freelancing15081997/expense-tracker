"""
Business application service — parties and documents (MVP).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.business.domain.models import Document, DocumentStatus, DocumentType, Party, TaxMode
from app.business.domain.rules import calculate_document_totals
from app.business.infra.orm import DocumentLineORM, DocumentORM, PartyORM
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


class BusinessService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dashboard(self, tenant_id: str) -> Dict[str, Any]:
        return {
            "kpis": {},
            "work_waiting": {},
            "cash_and_bank": {},
            "receivables": {},
            "payables": {},
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
            calc_lines = []
            for ln in raw_lines:
                qty = float(ln.get("q") or ln.get("qty") or 0)
                rate = float(ln.get("r") or ln.get("rate") or 0)
                gst = float(ln.get("g") or ln.get("gst_rate") or 0)
                calc_lines.append({"q": qty, "r": rate, "g": gst, "dr": ln.get("dr", 0), "cr": ln.get("cr", 0)})

            party_state = None
            if party_id:
                p = await self.db.get(PartyORM, _as_uuid(str(party_id)))
                if p:
                    party_state = p.state_code

            calc = calculate_document_totals(
                calc_lines,
                party_state_code=party_state,
                company_state_code=data.get("place_of_supply") or party_state or "27",
                document_type=doc_type,
                discount=float(data.get("disc") or data.get("discount") or 0),
                terms_days=terms,
            )
            totals = {
                "sub": calc.sub,
                "disc": calc.disc,
                "taxable": calc.taxable,
                "tax": calc.tax,
                "cg": calc.cg,
                "sg": calc.sg,
                "ig": calc.ig,
                "ro": calc.ro,
                "total": calc.total,
            }
            # calc totals appear to be in rupees (from frontend port); store paid/balance in paise
            total_paise = int(round(float(calc.total) * 100)) if calc.total < 1e7 else int(calc.total)
            # If calc.total looks like rupees (typical invoice), convert
            if calc.total < 1e7:
                total_paise = int(round(float(calc.total) * 100))

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
                rate = float(ln.get("r") or ln.get("rate") or 0)
                rate_paise = int(round(rate * 100))
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
                    amount_paise=int(round(float(qty) * rate * 100)),
                    dr_paise=int(float(ln.get("dr") or 0) * 100),
                    cr_paise=int(float(ln.get("cr") or 0) * 100),
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
