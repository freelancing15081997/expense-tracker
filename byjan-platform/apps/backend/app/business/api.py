"""
Business API router
All business endpoints (dashboard, accounts, parties, items, documents, payments, bank, operations, tax, inbox, approvals, reports, imports, org, integrations)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date

from app.shared.database import get_db_session
from app.deps import get_current_user, require_tenant, require_permission

router = APIRouter()


# ============================================================================
# B1. Home and Insights (/v1/biz)
# ============================================================================

@router.get("/dashboard")
async def get_dashboard(
    principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """KPIs, work waiting, cash and bank, receivables and payables snapshot"""
    # TODO: Implement dashboard
    return {"status": "ok"}


@router.get("/analytics")
async def get_analytics(
    range: Optional[str] = None,
    compare: Optional[str] = None,
    principal = Depends(get_current_user),
):
    """Revenue and expense series, margins, top customers and items"""
    # TODO: Implement analytics
    return {}


@router.get("/cfo")
async def get_cfo(months: int = 12, principal = Depends(get_current_user)):
    """Money overview - cash flow, burn, runway, working capital"""
    # TODO: Implement CFO view
    return {}


@router.get("/watchlist")
async def get_watchlist(principal = Depends(get_current_user)):
    """Watch list"""
    # TODO: Implement watchlist
    return []


@router.post("/watchlist/{id}/actions/dismiss")
async def dismiss_watchlist(id: str, principal = Depends(get_current_user)):
    """Dismiss watchlist item"""
    # TODO: Implement dismiss
    return {"status": "ok"}


@router.post("/watchlist/{id}/actions/snooze")
async def snooze_watchlist(id: str, principal = Depends(get_current_user)):
    """Snooze watchlist item"""
    # TODO: Implement snooze
    return {"status": "ok"}


@router.get("/insights")
async def get_insights(principal = Depends(get_current_user)):
    """Insights"""
    # TODO: Implement insights
    return []


@router.post("/insights/ask")
async def ask_insight(request: dict, principal = Depends(get_current_user)):
    """Natural-language answer"""
    # TODO: Implement LLM insight
    return {"answer": "Not implemented"}


# ============================================================================
# B2. Accounts (/v1/biz/accounts, /v1/biz/periods)
# ============================================================================

@router.get("/accounts")
async def get_accounts(
    view: Optional[str] = None,
    type: Optional[str] = None,
    q: Optional[str] = None,
    archived: Optional[bool] = None,
    principal = Depends(get_current_user),
):
    """Chart of accounts"""
    # TODO: Implement accounts list
    return []


@router.post("/accounts")
async def create_account(request: dict, principal = Depends(get_current_user)):
    """Create account"""
    # TODO: Implement account creation
    return {"id": "account_123"}


@router.get("/accounts/{id}")
async def get_account(id: str, principal = Depends(get_current_user)):
    """Get account"""
    # TODO: Implement account retrieval
    return {}


@router.patch("/accounts/{id}")
async def update_account(id: str, request: dict, principal = Depends(get_current_user)):
    """Update account"""
    # TODO: Implement account update
    return {"status": "ok"}


@router.post("/accounts/{id}/actions/archive")
async def archive_account(id: str, principal = Depends(get_current_user)):
    """Archive account (blocked if balance != 0 or system account)"""
    # TODO: Implement archive
    return {"status": "ok"}


@router.post("/accounts/{id}/actions/unarchive")
async def unarchive_account(id: str, principal = Depends(get_current_user)):
    """Unarchive account"""
    # TODO: Implement unarchive
    return {"status": "ok"}


@router.get("/accounts/{id}/ledger")
async def get_account_ledger(
    id: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    cursor: Optional[str] = None,
    principal = Depends(get_current_user),
):
    """Account ledger with running balance"""
    # TODO: Implement ledger
    return {}


@router.get("/periods")
async def get_periods(fy: Optional[str] = None, principal = Depends(get_current_user)):
    """Periods"""
    # TODO: Implement periods list
    return []


@router.post("/periods/{id}/actions/close")
async def close_period(id: str, principal = Depends(get_current_user)):
    """Close period"""
    # TODO: Implement close
    return {"status": "ok"}


@router.post("/periods/{id}/actions/lock")
async def lock_period(id: str, principal = Depends(get_current_user)):
    """Lock period"""
    # TODO: Implement lock
    return {"status": "ok"}


@router.post("/periods/{id}/actions/reopen")
async def reopen_period(id: str, request: dict, principal = Depends(get_current_user)):
    """Reopen period (Owner + step-up required)"""
    # TODO: Implement reopen
    return {"status": "ok"}


@router.get("/close/{period_id}/checklist")
async def get_close_checklist(period_id: str, principal = Depends(get_current_user)):
    """Close checklist"""
    # TODO: Implement checklist
    return []


@router.patch("/close/checklist/{item_id}")
async def update_checklist_item(item_id: str, request: dict, principal = Depends(get_current_user)):
    """Update checklist item"""
    # TODO: Implement checklist update
    return {"status": "ok"}


# ============================================================================
# B3. Parties and Items (/v1/biz/parties, /v1/biz/items)
# ============================================================================

@router.get("/parties")
async def get_parties(
    kind: Optional[str] = None,
    view: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    archived: Optional[bool] = None,
    tenant=Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
):
    """Parties (customers, suppliers)"""
    _, tenant_id = tenant
    from app.business.service import BusinessService
    return await BusinessService(db).list_parties(tenant_id, kind=kind, q=q, archived=archived)


@router.post("/parties")
async def create_party(
    request: dict,
    tenant=Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
):
    """Create party"""
    _, tenant_id = tenant
    from app.business.service import BusinessService
    result = await BusinessService(db).create_party(tenant_id, request or {})
    if result.is_err():
        raise HTTPException(status_code=400, detail={"code": result.unwrap_err(), "message": "Could not create party"})
    return result.unwrap()


@router.get("/parties/{id}")
async def get_party(
    id: str,
    tenant=Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
):
    """Get party with balance snapshot, ageing, ship-to addresses"""
    _, tenant_id = tenant
    from app.business.service import BusinessService
    party = await BusinessService(db).get_party(tenant_id, id)
    if not party:
        raise HTTPException(status_code=404, detail={"code": "party.not_found", "message": "Party not found"})
    return party


@router.patch("/parties/{id}")
async def update_party(
    id: str,
    request: dict,
    tenant=Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
):
    """Update party"""
    _, tenant_id = tenant
    from app.business.service import BusinessService
    result = await BusinessService(db).update_party(tenant_id, id, request or {})
    if result.is_err():
        code = result.unwrap_err()
        status_code = 404 if code == "party.not_found" else 400
        raise HTTPException(status_code=status_code, detail={"code": code, "message": "Could not update party"})
    return result.unwrap()


@router.post("/parties/{id}/actions/archive")
async def archive_party(id: str, principal = Depends(get_current_user)):
    """Archive party"""
    # TODO: Implement archive
    return {"status": "ok"}


@router.post("/parties/{id}/actions/unarchive")
async def unarchive_party(id: str, principal = Depends(get_current_user)):
    """Unarchive party"""
    # TODO: Implement unarchive
    return {"status": "ok"}


@router.post("/parties/{id}/actions/merge")
async def merge_party(id: str, request: dict, principal = Depends(get_current_user)):
    """Merge party (into_id)"""
    # TODO: Implement merge
    return {"status": "ok"}


@router.get("/parties/{id}/statement")
async def get_party_statement(
    id: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    format: Optional[str] = None,
    principal = Depends(get_current_user),
):
    """Party statement"""
    # TODO: Implement statement
    return {}


@router.post("/parties/{id}/statement/send")
async def send_party_statement(id: str, request: dict, principal = Depends(get_current_user)):
    """Send party statement"""
    # TODO: Implement send statement
    return {"status": "ok"}


@router.get("/party-categories")
async def get_party_categories(kind: Optional[str] = None, principal = Depends(get_current_user)):
    """Party categories"""
    # TODO: Implement categories
    return []


@router.post("/party-categories")
async def create_party_category(request: dict, principal = Depends(get_current_user)):
    """Create party category"""
    # TODO: Implement category creation
    return {"id": "category_123"}


@router.patch("/party-categories/{id}")
async def update_party_category(id: str, request: dict, principal = Depends(get_current_user)):
    """Update party category"""
    # TODO: Implement category update
    return {"status": "ok"}


@router.get("/lookup/gstin/{gstin}")
async def lookup_gstin(gstin: str, principal = Depends(get_current_user)):
    """Validate GSTIN and fetch legal name, state, status from GSP"""
    # TODO: Implement GSTIN lookup
    return {"valid": False, "message": "GSP integration not configured"}


@router.get("/items")
async def get_items(q: Optional[str] = None, type: Optional[str] = None, principal = Depends(get_current_user)):
    """Items (goods, services)"""
    # TODO: Implement items list
    return []


@router.post("/items")
async def create_item(request: dict, principal = Depends(get_current_user)):
    """Create item"""
    # TODO: Implement item creation
    return {"id": "item_123"}


@router.get("/items/{id}")
async def get_item(id: str, principal = Depends(get_current_user)):
    """Get item"""
    # TODO: Implement item retrieval
    return {}


@router.patch("/items/{id}")
async def update_item(id: str, request: dict, principal = Depends(get_current_user)):
    """Update item"""
    # TODO: Implement item update
    return {"status": "ok"}


@router.post("/items/{id}/actions/archive")
async def archive_item(id: str, principal = Depends(get_current_user)):
    """Archive item"""
    # TODO: Implement archive
    return {"status": "ok"}


@router.get("/lookup/hsn")
async def lookup_hsn(q: str, principal = Depends(get_current_user)):
    """HSN/SAC with default GST rate"""
    # TODO: Implement HSN lookup
    return []


# ============================================================================
# B4. Document Engine (/v1/biz/documents)
# ============================================================================

@router.get("/documents")
async def get_documents(
    type: Optional[str] = None,
    status: Optional[str] = None,
    party_id: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    min_paise: Optional[int] = None,
    max_paise: Optional[int] = None,
    project_id: Optional[str] = None,
    q: Optional[str] = None,
    sort: Optional[str] = None,
    tenant=Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
):
    """Documents list"""
    _, tenant_id = tenant
    from app.business.service import BusinessService
    docs = await BusinessService(db).list_documents(tenant_id, type=type, status=status, party_id=party_id)
    if q:
        ql = q.lower()
        docs = [d for d in docs if ql in (d.get("number") or "").lower() or ql in (d.get("narration") or "").lower()]
    return docs


@router.get("/documents/counts")
async def get_document_counts(
    type: Optional[str] = None,
    tenant=Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
):
    """Counts per status tab"""
    _, tenant_id = tenant
    from app.business.service import BusinessService
    docs = await BusinessService(db).list_documents(tenant_id, type=type)
    counts: dict = {}
    for d in docs:
        st = d.get("status") or "Draft"
        counts[st] = counts.get(st, 0) + 1
    return counts


@router.post("/documents/calculate")
async def calculate_document(request: dict, principal=Depends(get_current_user)):
    """Editor preview - calculate totals"""
    from app.business.domain.rules import calculate_document_totals
    lines = request.get("lines") or []
    calc = calculate_document_totals(
        lines,
        party_state_code=request.get("party_state_code"),
        company_state_code=request.get("company_state_code") or "27",
        document_type=request.get("type") or "invoices",
        discount=float(request.get("disc") or 0),
        terms_days=int(request.get("terms_days") or 30),
    )
    return {
        "sub": calc.sub, "disc": calc.disc, "taxable": calc.taxable, "tax": calc.tax,
        "cg": calc.cg, "sg": calc.sg, "ig": calc.ig, "ro": calc.ro, "total": calc.total,
    }


@router.get("/documents/next-number")
async def get_next_number(
    type: str,
    entity_id: Optional[str] = None,
    tenant=Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
):
    """Next number for document type"""
    _, tenant_id = tenant
    from app.business.service import BusinessService
    number = await BusinessService(db)._next_number(tenant_id, type)
    return {"number": number}


@router.post("/documents")
async def create_document(
    request: dict,
    tenant=Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
):
    """Create document (draft)"""
    _, tenant_id = tenant
    from app.business.service import BusinessService
    result = await BusinessService(db).create_document(tenant_id, request or {})
    if result.is_err():
        raise HTTPException(status_code=400, detail={"code": result.unwrap_err(), "message": "Could not create document"})
    return result.unwrap()


@router.get("/documents/{id}")
async def get_document(
    id: str,
    expand: Optional[str] = None,
    tenant=Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
):
    """Get document with party, lines, payments, links, activity, accounting"""
    _, tenant_id = tenant
    from app.business.service import BusinessService
    doc = await BusinessService(db).get_document(tenant_id, id)
    if not doc:
        raise HTTPException(status_code=404, detail={"code": "document.not_found", "message": "Document not found"})
    return doc


@router.patch("/documents/{id}")
async def update_document(
    id: str,
    request: dict,
    tenant=Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
):
    """Update document (only editable fields in current status)"""
    _, tenant_id = tenant
    from app.business.service import BusinessService
    result = await BusinessService(db).update_document(tenant_id, id, request or {})
    if result.is_err():
        code = result.unwrap_err()
        status_code = 404 if code == "document.not_found" else 400
        raise HTTPException(status_code=status_code, detail={"code": code, "message": "Could not update document"})
    return result.unwrap()


@router.delete("/documents/{id}")
async def delete_document(id: str, principal = Depends(get_current_user)):
    """Delete document (drafts only)"""
    # TODO: Implement document deletion
    return {"status": "ok"}


@router.post("/documents/{id}/actions/{action}")
async def document_action(id: str, action: str, request: dict = {}, principal = Depends(get_current_user)):
    """Document actions (post, send, remind, submit, approve, reject, accept, decline, expire, convert, receive, pay, apply, void, reverse, pause, resume, run-now, duplicate, einvoice, cancel-einvoice, ewaybill, payment-link)"""
    # TODO: Implement document actions
    return {"status": "ok", "action": action}


@router.post("/documents/bulk")
async def bulk_document(request: dict, principal = Depends(get_current_user)):
    """Bulk actions on documents"""
    # TODO: Implement bulk actions
    return {"job_id": "job_123"}


@router.get("/documents/{id}/pdf")
async def get_document_pdf(id: str, lang: Optional[str] = None, copy: Optional[str] = None, principal = Depends(get_current_user)):
    """Get document PDF (cached by version)"""
    # TODO: Implement PDF generation
    return {"url": "https://storage.example.com/pdf"}


@router.post("/documents/{id}/attachments")
async def add_document_attachment(id: str, request: dict, principal = Depends(get_current_user)):
    """Add attachment to document"""
    # TODO: Implement attachment
    return {"status": "ok"}


@router.delete("/documents/{id}/attachments/{file_id}")
async def delete_document_attachment(id: str, file_id: str, principal = Depends(get_current_user)):
    """Delete attachment from document"""
    # TODO: Implement attachment deletion
    return {"status": "ok"}


# ============================================================================
# B5. Payments and Collections (/v1/biz/payments, /v1/biz/payment-runs)
# ============================================================================

@router.get("/payments")
async def get_payments(
    direction: Optional[str] = None,
    party_id: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    principal = Depends(get_current_user),
):
    """Payments list"""
    # TODO: Implement payments list
    return []


@router.get("/payments/{id}")
async def get_payment(id: str, principal = Depends(get_current_user)):
    """Get payment"""
    # TODO: Implement payment retrieval
    return {}


@router.post("/payments")
async def create_payment(request: dict, principal = Depends(get_current_user)):
    """Create payment (money-moving, requires Idempotency-Key)"""
    # TODO: Implement payment creation
    return {"id": "payment_123"}


@router.post("/payments/{id}/actions/void")
async def void_payment(id: str, request: dict, principal = Depends(get_current_user)):
    """Void payment"""
    # TODO: Implement payment void
    return {"status": "ok"}


@router.get("/receivables/aging")
async def get_receivables_aging(as_of: Optional[date] = None, bucket: int = 30, principal = Depends(get_current_user)):
    """Receivables aging"""
    # TODO: Implement aging
    return {}


@router.get("/payables/aging")
async def get_payables_aging(as_of: Optional[date] = None, bucket: int = 30, principal = Depends(get_current_user)):
    """Payables aging"""
    # TODO: Implement aging
    return {}


@router.post("/receivables/remind")
async def remind_receivables(request: dict, principal = Depends(get_current_user)):
    """Send payment reminders"""
    # TODO: Implement reminders
    return {"status": "ok"}


@router.post("/payment-runs")
async def create_payment_run(request: dict, principal = Depends(get_current_user)):
    """Create payment run"""
    # TODO: Implement payment run
    return {"id": "run_123"}


@router.get("/payment-runs")
async def get_payment_runs(principal = Depends(get_current_user)):
    """List payment runs"""
    # TODO: Implement payment runs list
    return []


@router.get("/payment-runs/{id}")
async def get_payment_run(id: str, principal = Depends(get_current_user)):
    """Get payment run"""
    # TODO: Implement payment run retrieval
    return {}


@router.post("/payment-runs/{id}/actions/submit")
async def submit_payment_run(id: str, principal = Depends(get_current_user)):
    """Submit payment run"""
    # TODO: Implement submit
    return {"status": "ok"}


@router.post("/payment-runs/{id}/actions/approve")
async def approve_payment_run(id: str, principal = Depends(get_current_user)):
    """Approve payment run"""
    # TODO: Implement approve
    return {"status": "ok"}


@router.post("/payment-runs/{id}/actions/reject")
async def reject_payment_run(id: str, request: dict, principal = Depends(get_current_user)):
    """Reject payment run"""
    # TODO: Implement reject
    return {"status": "ok"}


@router.post("/payment-runs/{id}/actions/execute")
async def execute_payment_run(id: str, principal = Depends(get_current_user)):
    """Execute payment run (money-moving, step-up above limit)"""
    # TODO: Implement execute
    return {"status": "ok"}


@router.post("/payment-runs/{id}/actions/export-bank-file")
async def export_payment_run(id: str, principal = Depends(get_current_user)):
    """Export bank file"""
    # TODO: Implement export
    return {"file_id": "file_123"}


# ============================================================================
# B6. Bank (/v1/biz/bank)
# ============================================================================

@router.get("/bank/accounts")
async def get_bank_accounts(principal = Depends(get_current_user)):
    """Bank-type COA accounts with feed status and balances"""
    # TODO: Implement bank accounts
    return []


@router.post("/bank/connections")
async def create_bank_connection(request: dict, principal = Depends(get_current_user)):
    """Create bank connection (consent URL)"""
    # TODO: Implement connection
    return {"connection_id": "conn_123", "consent_url": "https://provider.com/consent"}


@router.get("/bank/connections/{id}")
async def get_bank_connection(id: str, principal = Depends(get_current_user)):
    """Get bank connection"""
    # TODO: Implement connection retrieval
    return {}


@router.delete("/bank/connections/{id}")
async def delete_bank_connection(id: str, principal = Depends(get_current_user)):
    """Delete bank connection"""
    # TODO: Implement deletion
    return {"status": "ok"}


@router.post("/bank/connections/{id}/actions/sync")
async def sync_bank_connection(id: str, principal = Depends(get_current_user)):
    """Sync bank connection"""
    # TODO: Implement sync
    return {"status": "ok"}


@router.post("/bank/statements/import")
async def import_statement(request: dict, principal = Depends(get_current_user)):
    """Import bank statement (async)"""
    # TODO: Implement import
    return {"job_id": "job_123"}


@router.get("/bank/lines")
async def get_bank_lines(
    account_id: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    principal = Depends(get_current_user),
):
    """Bank lines"""
    # TODO: Implement bank lines
    return []


@router.get("/bank/lines/{id}/suggestions")
async def get_line_suggestions(id: str, principal = Depends(get_current_user)):
    """Bank line suggestions"""
    # TODO: Implement suggestions
    return []


@router.post("/bank/lines/{id}/actions/match")
async def match_line(id: str, request: dict, principal = Depends(get_current_user)):
    """Match bank line"""
    # TODO: Implement match
    return {"status": "ok"}


@router.post("/bank/lines/{id}/actions/unmatch")
async def unmatch_line(id: str, principal = Depends(get_current_user)):
    """Unmatch bank line"""
    # TODO: Implement unmatch
    return {"status": "ok"}


@router.post("/bank/lines/{id}/actions/ignore")
async def ignore_line(id: str, principal = Depends(get_current_user)):
    """Ignore bank line"""
    # TODO: Implement ignore
    return {"status": "ok"}


@router.post("/bank/lines/{id}/actions/create")
async def create_from_line(id: str, request: dict, principal = Depends(get_current_user)):
    """Create transaction from bank line"""
    # TODO: Implement create
    return {"status": "ok"}


@router.post("/bank/actions/auto-match")
async def auto_match(request: dict, principal = Depends(get_current_user)):
    """Auto-match bank lines (async)"""
    # TODO: Implement auto-match
    return {"job_id": "job_123"}


@router.get("/bank/rules")
async def get_bank_rules(principal = Depends(get_current_user)):
    """Bank rules"""
    # TODO: Implement rules list
    return []


@router.post("/bank/rules")
async def create_bank_rule(request: dict, principal = Depends(get_current_user)):
    """Create bank rule"""
    # TODO: Implement rule creation
    return {"id": "rule_123"}


@router.patch("/bank/rules/{id}")
async def update_bank_rule(id: str, request: dict, principal = Depends(get_current_user)):
    """Update bank rule"""
    # TODO: Implement rule update
    return {"status": "ok"}


@router.delete("/bank/rules/{id}")
async def delete_bank_rule(id: str, principal = Depends(get_current_user)):
    """Delete bank rule"""
    # TODO: Implement rule deletion
    return {"status": "ok"}


@router.get("/bank/reconciliation")
async def get_reconciliation(
    account_id: Optional[str] = None,
    period_id: Optional[str] = None,
    principal = Depends(get_current_user),
):
    """Bank reconciliation"""
    # TODO: Implement reconciliation
    return {}


@router.post("/bank/reconciliation/complete")
async def complete_reconciliation(request: dict, principal = Depends(get_current_user)):
    """Complete bank reconciliation"""
    # TODO: Implement completion
    return {"status": "ok"}


# ============================================================================
# B7. Operations (/v1/biz/stock, /v1/biz/assets, etc.)
# ============================================================================

@router.get("/stock")
async def get_stock(
    location_id: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    principal = Depends(get_current_user),
):
    """Stock levels and valuation"""
    # TODO: Implement stock
    return []


@router.get("/stock/moves")
async def get_stock_moves(
    item_id: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    principal = Depends(get_current_user),
):
    """Stock moves"""
    # TODO: Implement stock moves
    return []


@router.post("/stock/adjustments")
async def create_stock_adjustment(request: dict, principal = Depends(get_current_user)):
    """Stock adjustment"""
    # TODO: Implement adjustment
    return {"status": "ok"}


@router.post("/stock/transfers")
async def create_stock_transfer(request: dict, principal = Depends(get_current_user)):
    """Stock transfer"""
    # TODO: Implement transfer
    return {"status": "ok"}


@router.get("/locations")
async def get_locations(principal = Depends(get_current_user)):
    """Locations"""
    # TODO: Implement locations list
    return []


@router.post("/locations")
async def create_location(request: dict, principal = Depends(get_current_user)):
    """Create location"""
    # TODO: Implement location creation
    return {"id": "location_123"}


@router.patch("/locations/{id}")
async def update_location(id: str, request: dict, principal = Depends(get_current_user)):
    """Update location"""
    # TODO: Implement location update
    return {"status": "ok"}


@router.get("/assets")
async def get_assets(status: Optional[str] = None, principal = Depends(get_current_user)):
    """Assets"""
    # TODO: Implement assets list
    return []


@router.post("/assets")
async def create_asset(request: dict, principal = Depends(get_current_user)):
    """Create asset"""
    # TODO: Implement asset creation
    return {"id": "asset_123"}


@router.get("/assets/{id}")
async def get_asset(id: str, principal = Depends(get_current_user)):
    """Get asset"""
    # TODO: Implement asset retrieval
    return {}


@router.patch("/assets/{id}")
async def update_asset(id: str, request: dict, principal = Depends(get_current_user)):
    """Update asset"""
    # TODO: Implement asset update
    return {"status": "ok"}


@router.post("/assets/{id}/actions/dispose")
async def dispose_asset(id: str, request: dict, principal = Depends(get_current_user)):
    """Dispose asset"""
    # TODO: Implement disposal
    return {"status": "ok"}


@router.post("/assets/depreciation/run")
async def run_depreciation(request: dict, principal = Depends(get_current_user)):
    """Run depreciation (idempotent per period)"""
    # TODO: Implement depreciation run
    return {"journal_id": "journal_123"}


@router.get("/projects")
async def get_projects(principal = Depends(get_current_user)):
    """Projects"""
    # TODO: Implement projects list
    return []


@router.post("/projects")
async def create_project(request: dict, principal = Depends(get_current_user)):
    """Create project"""
    # TODO: Implement project creation
    return {"id": "project_123"}


@router.get("/projects/{id}")
async def get_project(id: str, principal = Depends(get_current_user)):
    """Get project (budget, spent, invoiced, margin, docs)"""
    # TODO: Implement project retrieval
    return {}


@router.patch("/projects/{id}")
async def update_project(id: str, request: dict, principal = Depends(get_current_user)):
    """Update project"""
    # TODO: Implement project update
    return {"status": "ok"}


@router.post("/projects/{id}/actions/close")
async def close_project(id: str, principal = Depends(get_current_user)):
    """Close project"""
    # TODO: Implement closure
    return {"status": "ok"}


@router.get("/budgets")
async def get_budgets(fy: Optional[str] = None, org_unit_id: Optional[str] = None, principal = Depends(get_current_user)):
    """Budgets with actuals"""
    # TODO: Implement budgets
    return []


@router.put("/budgets/{fy}")
async def update_budget(fy: str, request: dict, principal = Depends(get_current_user)):
    """Update budget"""
    # TODO: Implement budget update
    return {"status": "ok"}


@router.get("/forecast")
async def get_forecast(weeks: int = 13, principal = Depends(get_current_user)):
    """Forecast"""
    # TODO: Implement forecast
    return {}


@router.post("/forecast/items")
async def create_forecast_item(request: dict, principal = Depends(get_current_user)):
    """Create forecast item"""
    # TODO: Implement forecast item
    return {"id": "item_123"}


@router.patch("/forecast/items/{id}")
async def update_forecast_item(id: str, request: dict, principal = Depends(get_current_user)):
    """Update forecast item"""
    # TODO: Implement forecast item update
    return {"status": "ok"}


@router.delete("/forecast/items/{id}")
async def delete_forecast_item(id: str, principal = Depends(get_current_user)):
    """Delete forecast item"""
    # TODO: Implement forecast item deletion
    return {"status": "ok"}


@router.get("/deals")
async def get_deals(principal = Depends(get_current_user)):
    """Deals"""
    # TODO: Implement deals list
    return []


@router.post("/deals")
async def create_deal(request: dict, principal = Depends(get_current_user)):
    """Create deal"""
    # TODO: Implement deal creation
    return {"id": "deal_123"}


@router.get("/deals/{id}")
async def get_deal(id: str, principal = Depends(get_current_user)):
    """Get deal (recognition schedule)"""
    # TODO: Implement deal retrieval
    return {}


@router.patch("/deals/{id}")
async def update_deal(id: str, request: dict, principal = Depends(get_current_user)):
    """Update deal"""
    # TODO: Implement deal update
    return {"status": "ok"}


@router.post("/deals/{id}/actions/recognize")
async def recognize_deal(id: str, request: dict, principal = Depends(get_current_user)):
    """Recognize deal (period)"""
    # TODO: Implement recognition
    return {"status": "ok"}


@router.get("/leases")
async def get_leases(principal = Depends(get_current_user)):
    """Leases"""
    # TODO: Implement leases list
    return []


@router.post("/leases")
async def create_lease(request: dict, principal = Depends(get_current_user)):
    """Create lease"""
    # TODO: Implement lease creation
    return {"id": "lease_123"}


@router.get("/leases/{id}")
async def get_lease(id: str, principal = Depends(get_current_user)):
    """Get lease"""
    # TODO: Implement lease retrieval
    return {}


@router.patch("/leases/{id}")
async def update_lease(id: str, request: dict, principal = Depends(get_current_user)):
    """Update lease"""
    # TODO: Implement lease update
    return {"status": "ok"}


@router.post("/leases/{id}/actions/end")
async def end_lease(id: str, principal = Depends(get_current_user)):
    """End lease"""
    # TODO: Implement end lease
    return {"status": "ok"}


# ============================================================================
# B8. Tax and Entities (/v1/biz/tax, /v1/biz/gst-entities)
# ============================================================================

@router.get("/tax/returns")
async def get_tax_returns(period: Optional[str] = None, type: Optional[str] = None, principal = Depends(get_current_user)):
    """Tax returns"""
    # TODO: Implement tax returns
    return []


@router.get("/tax/returns/{id}")
async def get_tax_return(id: str, principal = Depends(get_current_user)):
    """Get tax return (working)"""
    # TODO: Implement tax return retrieval
    return {}


@router.post("/tax/returns/{id}/actions/prepare")
async def prepare_tax_return(id: str, principal = Depends(get_current_user)):
    """Prepare tax return"""
    # TODO: Implement prepare
    return {"status": "ok"}


@router.post("/tax/returns/{id}/actions/file")
async def file_tax_return(id: str, principal = Depends(get_current_user)):
    """File tax return (step-up, GSP, stores ARN)"""
    # TODO: Implement file
    return {"status": "ok", "arn": "ARN123"}


@router.post("/tax/returns/{id}/actions/export")
async def export_tax_return(id: str, principal = Depends(get_current_user)):
    """Export tax return"""
    # TODO: Implement export
    return {"file_id": "file_123"}


@router.post("/tax/gstr2b/actions/fetch")
async def fetch_gstr2b(request: dict, principal = Depends(get_current_user)):
    """Fetch GSTR-2B (async)"""
    # TODO: Implement GSTR-2B fetch
    return {"job_id": "job_123"}


@router.get("/tax/gstr2b/mismatches")
async def get_gstr2b_mismatches(period: Optional[str] = None, status: Optional[str] = None, principal = Depends(get_current_user)):
    """GSTR-2B mismatches"""
    # TODO: Implement mismatches
    return []


@router.post("/tax/gstr2b/mismatches/{id}/actions/resolve")
async def resolve_gstr2b_mismatch(id: str, request: dict, principal = Depends(get_current_user)):
    """Resolve GSTR-2B mismatch"""
    # TODO: Implement resolution
    return {"status": "ok"}


@router.get("/tax/tds")
async def get_tds_summary(quarter: Optional[str] = None, principal = Depends(get_current_user)):
    """TDS deductions and challans"""
    # TODO: Implement TDS
    return {}


@router.post("/tax/tds/challans")
async def create_tds_challan(request: dict, principal = Depends(get_current_user)):
    """Create TDS challan"""
    # TODO: Implement challan creation
    return {"id": "challan_123"}


@router.get("/gst-entities")
async def get_gst_entities(principal = Depends(get_current_user)):
    """GST entities"""
    # TODO: Implement entities list
    return []


@router.post("/gst-entities")
async def create_gst_entity(request: dict, principal = Depends(get_current_user)):
    """Create GST entity"""
    # TODO: Implement entity creation
    return {"id": "entity_123"}


@router.patch("/gst-entities/{id}")
async def update_gst_entity(id: str, request: dict, principal = Depends(get_current_user)):
    """Update GST entity"""
    # TODO: Implement entity update
    return {"status": "ok"}


@router.post("/gst-entities/{id}/actions/make-primary")
async def make_gst_entity_primary(id: str, principal = Depends(get_current_user)):
    """Make GST entity primary"""
    # TODO: Implement primary
    return {"status": "ok"}


# ============================================================================
# B9. Inbox, Approvals, Accountant, Queries
# ============================================================================

@router.get("/inbox")
async def get_inbox(status: Optional[str] = None, kind: Optional[str] = None, principal = Depends(get_current_user)):
    """Inbox items"""
    # TODO: Implement inbox
    return []


@router.get("/inbox/{id}")
async def get_inbox_item(id: str, principal = Depends(get_current_user)):
    """Get inbox item (parsed fields, confidence, file)"""
    # TODO: Implement inbox item retrieval
    return {}


@router.post("/inbox/upload")
async def upload_to_inbox(request: dict, principal = Depends(get_current_user)):
    """Upload files to inbox (async parsing)"""
    # TODO: Implement upload
    return {"job_id": "job_123"}


@router.get("/inbox/address")
async def get_inbox_address(principal = Depends(get_current_user)):
    """Tenant's inbound email and WhatsApp number"""
    # TODO: Implement address retrieval
    return {"email": "inbox@byjan.com", "whatsapp": "+919876543210"}


@router.post("/inbox/{id}/actions/accept")
async def accept_inbox_item(id: str, request: dict, principal = Depends(get_current_user)):
    """Accept inbox item (as bill/spend/payment → draft doc)"""
    # TODO: Implement accept
    return {"document_id": "doc_123"}


@router.post("/inbox/{id}/actions/reject")
async def reject_inbox_item(id: str, principal = Depends(get_current_user)):
    """Reject inbox item"""
    # TODO: Implement reject
    return {"status": "ok"}


@router.get("/approvals")
async def get_approvals(status: Optional[str] = None, mine: Optional[bool] = None, principal = Depends(get_current_user)):
    """Approvals"""
    # TODO: Implement approvals
    return []


@router.post("/approvals/{id}/actions/approve")
async def approve_approval(id: str, principal = Depends(get_current_user)):
    """Approve (with limit check)"""
    # TODO: Implement approve
    return {"status": "ok"}


@router.post("/approvals/{id}/actions/reject")
async def reject_approval(id: str, request: dict, principal = Depends(get_current_user)):
    """Reject"""
    # TODO: Implement reject
    return {"status": "ok"}


@router.get("/approval-rules")
async def get_approval_rules(principal = Depends(get_current_user)):
    """Approval rules"""
    # TODO: Implement rules
    return []


@router.put("/approval-rules")
async def update_approval_rules(request: dict, principal = Depends(get_current_user)):
    """Update approval rules"""
    # TODO: Implement rules update
    return {"status": "ok"}


@router.get("/workbench")
async def get_workbench(principal = Depends(get_current_user)):
    """Accountant's workbench - review flags, open queries, close status, adjustments"""
    # TODO: Implement workbench
    return {}


@router.get("/queries")
async def get_queries(status: Optional[str] = None, principal = Depends(get_current_user)):
    """Queries"""
    # TODO: Implement queries
    return []


@router.post("/queries")
async def create_query(request: dict, principal = Depends(get_current_user)):
    """Create query"""
    # TODO: Implement query creation
    return {"id": "query_123"}


@router.post("/queries/{id}/reply")
async def reply_query(id: str, request: dict, principal = Depends(get_current_user)):
    """Reply to query"""
    # TODO: Implement reply
    return {"status": "ok"}


@router.post("/queries/{id}/actions/close")
async def close_query(id: str, principal = Depends(get_current_user)):
    """Close query"""
    # TODO: Implement close
    return {"status": "ok"}


@router.get("/doc-requests")
async def get_doc_requests(principal = Depends(get_current_user)):
    """Doc requests (requests from CA)"""
    # TODO: Implement doc requests
    return []


@router.post("/doc-requests/{id}/items/{item_id}/fulfil")
async def fulfil_doc_request(id: str, item_id: str, request: dict, principal = Depends(get_current_user)):
    """Fulfil doc request"""
    # TODO: Implement fulfil
    return {"status": "ok"}


# ============================================================================
# B10. Reports, Imports, Org, Integrations
# ============================================================================

@router.get("/reports")
async def get_reports(principal = Depends(get_current_user)):
    """Reports catalogue"""
    # TODO: Implement reports list
    return []


@router.get("/reports/{key}")
async def get_report(
    key: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    compare: Optional[str] = None,
    org_unit_id: Optional[str] = None,
    entity_id: Optional[str] = None,
    format: Optional[str] = None,
    principal = Depends(get_current_user),
):
    """Get report (heavy reports → 202)"""
    # TODO: Implement report
    return {}


@router.post("/imports")
async def create_import(request: dict, principal = Depends(get_current_user)):
    """Create import"""
    # TODO: Implement import
    return {"id": "import_123"}


@router.get("/imports/{id}")
async def get_import(id: str, principal = Depends(get_current_user)):
    """Get import"""
    # TODO: Implement import retrieval
    return {}


@router.put("/imports/{id}/mapping")
async def update_import_mapping(id: str, request: dict, principal = Depends(get_current_user)):
    """Update import mapping"""
    # TODO: Implement mapping update
    return {"status": "ok"}


@router.post("/imports/{id}/actions/validate")
async def validate_import(id: str, principal = Depends(get_current_user)):
    """Validate import"""
    # TODO: Implement validation
    return {"status": "ok"}


@router.post("/imports/{id}/actions/commit")
async def commit_import(id: str, principal = Depends(get_current_user)):
    """Commit import"""
    # TODO: Implement commit
    return {"status": "ok"}


@router.post("/imports/{id}/actions/undo")
async def undo_import(id: str, principal = Depends(get_current_user)):
    """Undo import (within 24h)"""
    # TODO: Implement undo
    return {"status": "ok"}


@router.get("/org")
async def get_org_tree(principal = Depends(get_current_user)):
    """Org tree"""
    # TODO: Implement org tree
    return {}


@router.post("/org/units")
async def create_org_unit(request: dict, principal = Depends(get_current_user)):
    """Create org unit"""
    # TODO: Implement org unit creation
    return {"id": "unit_123"}


@router.patch("/org/units/{id}")
async def update_org_unit(id: str, request: dict, principal = Depends(get_current_user)):
    """Update org unit"""
    # TODO: Implement org unit update
    return {"status": "ok"}


@router.post("/org/units/{id}/actions/move")
async def move_org_unit(id: str, request: dict, principal = Depends(get_current_user)):
    """Move org unit"""
    # TODO: Implement move
    return {"status": "ok"}


@router.post("/org/units/{id}/actions/deactivate")
async def deactivate_org_unit(id: str, principal = Depends(get_current_user)):
    """Deactivate org unit"""
    # TODO: Implement deactivate
    return {"status": "ok"}


@router.get("/integrations")
async def get_integrations(principal = Depends(get_current_user)):
    """Integrations"""
    # TODO: Implement integrations list
    return {}


@router.post("/integrations/{key}/connect")
async def connect_integration(key: str, principal = Depends(get_current_user)):
    """Connect integration"""
    # TODO: Implement connection
    return {"status": "ok"}


@router.delete("/integrations/{key}")
async def delete_integration(key: str, principal = Depends(get_current_user)):
    """Delete integration"""
    # TODO: Implement deletion
    return {"status": "ok"}


@router.post("/integrations/{key}/actions/test")
async def test_integration(key: str, principal = Depends(get_current_user)):
    """Test integration"""
    # TODO: Implement test
    return {"status": "ok"}
