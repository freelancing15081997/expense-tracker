"""
Business domain rules - pure calculations and invariants
Ported from frontend BizLogic.js
"""

from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Optional, Any, Tuple, FrozenSet
from decimal import Decimal, ROUND_HALF_UP
import structlog

from app.shared.types import Money

log = structlog.get_logger(__name__)

# Status after primary "post" action (ported from BizLogic.js POST_TO)
POST_TO: Dict[str, str] = {
    "invoices": "Sent",
    "estimates": "Sent",
    "quotes": "Sent",
    "sales-orders": "Confirmed",
    "credit-notes": "Open",
    "debit-notes": "Open",
    "purchase-requests": "Pending approval",
    "purchase-orders": "Sent",
    "purchase-receipts": "Posted",
    "bills": "Open",
    "vendor-credits": "Open",
    "journals": "Posted",
    "recurring": "Active",
    "expenses": "Posted",
}

DOCUMENT_STATUSES: Dict[str, FrozenSet[str]] = {
    "invoices": frozenset({"Draft", "Sent", "Overdue", "Partly paid", "Paid", "Void"}),
    "estimates": frozenset({"Draft", "Sent", "Accepted", "Declined", "Expired", "Converted"}),
    "quotes": frozenset({"Draft", "Sent", "Accepted", "Declined", "Expired", "Converted"}),
    "sales-orders": frozenset({"Draft", "Confirmed", "Invoiced"}),
    "credit-notes": frozenset({"Draft", "Open", "Applied", "Void"}),
    "debit-notes": frozenset({"Draft", "Open", "Applied", "Void"}),
    "purchase-requests": frozenset({"Draft", "Pending approval", "Approved", "Rejected", "Ordered"}),
    "purchase-orders": frozenset({"Draft", "Sent", "Partly received", "Received", "Billed"}),
    "purchase-receipts": frozenset({"Draft", "Posted"}),
    "bills": frozenset({"Draft", "Open", "Overdue", "Partly paid", "Paid", "Void"}),
    "vendor-credits": frozenset({"Draft", "Open", "Applied", "Void"}),
    "journals": frozenset({"Draft", "Posted", "Reversed"}),
    "recurring": frozenset({"Active", "Paused"}),
    "expenses": frozenset({"Draft", "Posted", "Reimbursed", "Void"}),
}

VOID_BLOCKED_STATUSES: FrozenSet[str] = frozenset({
    "Void", "Reversed", "Paid", "Applied", "Invoiced", "Billed", "Converted",
    "Rejected", "Declined", "Expired", "Ordered", "Reimbursed",
})

# Side-effect actions that do not change status (email, PDF, reminders, etc.)
NOOP_DOCUMENT_ACTIONS: FrozenSet[str] = frozenset({
    # "send" aliases to "post" via ACTION_ALIASES — do not list it here
    "remind", "email", "pdf", "duplicate", "einvoice",
    "cancel-einvoice", "ewaybill", "payment-link", "run-now", "edit",
})

ACTION_ALIASES: Dict[str, str] = {
    "send": "post",
    "dup": "duplicate",
    "runnow": "run-now",
}

# Document types that book GL entries when posted (post / post-like transitions)
GL_POSTING_DOC_TYPES: FrozenSet[str] = frozenset({
    "invoices", "bills", "credit-notes", "debit-notes", "vendor-credits",
    "journals", "expenses", "purchase-receipts",
})

# System account codes used when tenant COA rows exist (see build_gl_proposals)
GL_ACCOUNT_CODES: Dict[str, str] = {
    "AR": "1100",
    "AP": "2100",
    "SALES": "4000",
    "EXPENSE": "5000",
    "GST_OUT": "2310",
    "GST_IN": "1310",
}


# GST rates (from constants.js)
GST_RATES = {
    "0": Decimal("0"),
    "5": Decimal("5"),
    "12": Decimal("12"),
    "18": Decimal("18"),
    "28": Decimal("28"),
}


@dataclass(frozen=True)
class DocumentCalculation:
    """Document calculation result (all money fields in paise)"""
    sub: int = 0
    disc: int = 0
    taxable: int = 0
    tax: int = 0
    cg: int = 0
    sg: int = 0
    ig: int = 0
    ro: int = 0  # Round-off
    total: int = 0
    inter: bool = False
    dr: int = 0
    cr: int = 0


def calculate_document_totals(
    lines: List[Dict[str, Any]],
    party_state_code: Optional[str],
    company_state_code: str,
    document_type: str = "invoice",
    discount: float = 0,
    terms_days: int = 30,
) -> DocumentCalculation:
    """
    Calculate document totals (GST, TDS, round-off)
    
    Ported from frontend calc() function in constants.js
    """
    
    # Special case: journals
    if document_type == "journals":
        dr = sum(Decimal(str(line.get("dr", 0))) for line in lines)
        cr = sum(Decimal(str(line.get("cr", 0))) for line in lines)
        return DocumentCalculation(
            sub=int(dr),
            disc=0,
            taxable=int(dr),
            tax=0,
            cg=0,
            sg=0,
            ig=0,
            ro=0,
            total=int(dr),
            dr=int(dr),
            cr=int(cr),
            inter=False,
        )
    
    # Calculate subtotal
    sub = 0
    tax = 0
    cgst = 0
    sgst = 0
    igst = 0
    
    # Determine if inter-state (IGST) or intra-state (CGST+SGST)
    inter = party_state_code != company_state_code
    
    for line in lines:
        qty = Decimal(str(line.get("qty", 0)))
        rate = Decimal(str(line.get("rate", 0)))
        gst_rate = Decimal(str(line.get("gst_rate", 0)))
        
        line_amount = qty * rate
        sub += int(line_amount)
        
        if gst_rate > 0:
            line_tax = line_amount * (gst_rate / 100)
            tax += int(line_tax)
            
            if inter:
                igst += int(line_tax)
            else:
                cgst += int(line_tax / 2)  # floor division
                sgst += int(line_tax) - int(line_tax / 2)  # remainder
    
    # Apply discount
    disc = min(int(discount), sub)
    taxable = sub - disc
    
    # Apply discount factor to tax
    if sub > 0:
        discount_factor = Decimal(taxable) / Decimal(sub)
        tax = int(Decimal(tax) * discount_factor)
        cgst = int(Decimal(cgst) * discount_factor)
        sgst = int(Decimal(sgst) * discount_factor)
        igst = int(Decimal(igst) * discount_factor)
    
    # Calculate total with round-off
    raw_total = taxable + tax
    total = int(round(Decimal(raw_total)))  # Round to nearest rupee
    ro = total - raw_total
    
    return DocumentCalculation(
        sub=sub,
        disc=disc,
        taxable=taxable,
        tax=tax,
        cg=cgst,
        sg=sgst,
        ig=igst,
        ro=ro,
        total=total,
        inter=inter,
    )


def _journal_side_paise(line: Dict[str, Any], side: str) -> int:
    paise_key = f"{side}_paise"
    if paise_key in line and line[paise_key] is not None:
        return int(line[paise_key])
    raw = line.get(side)
    if raw is None or raw == "":
        return 0
    val = float(raw)
    # UI journal lines carry `acc`; amounts are rupees on the wire
    if line.get("acc") is not None:
        return int(round(val * 100))
    return int(val)


def line_rate_paise(line: Dict[str, Any]) -> int:
    if line.get("rate_paise") is not None:
        return int(line["rate_paise"])
    if line.get("rate") is not None and line.get("rate") != "":
        return int(line["rate"])
    if line.get("r") is not None and line.get("r") != "":
        return int(round(float(line["r"]) * 100))
    return 0


def normalize_document_lines_for_calc(
    lines: List[Dict[str, Any]],
    document_type: str,
) -> List[Dict[str, Any]]:
    """Map UI/API line shapes to calculate_document_totals inputs (paise rates)."""
    if document_type == "journals":
        return [
            {
                "dr": _journal_side_paise(ln, "dr"),
                "cr": _journal_side_paise(ln, "cr"),
            }
            for ln in lines
        ]
    out: List[Dict[str, Any]] = []
    for ln in lines:
        qty = ln.get("qty")
        if qty is None:
            qty = ln.get("q", 0)
        gst = ln.get("gst_rate")
        if gst is None:
            gst = ln.get("g", 0)
        out.append({"qty": qty, "rate": line_rate_paise(ln), "gst_rate": gst})
    return out


def normalize_discount_paise(data: Dict[str, Any]) -> int:
    if data.get("discount_paise") is not None:
        return int(data["discount_paise"])
    if data.get("disc") not in (None, ""):
        return int(round(float(data["disc"]) * 100))
    if data.get("discount") not in (None, ""):
        return int(data["discount"])
    return 0


def validate_journal_balance(calc: DocumentCalculation) -> Optional[str]:
    if calc.dr != calc.cr:
        return "document.journal_unbalanced"
    return None


def normalize_document_action(action: str) -> str:
    a = (action or "").strip().lower().replace("_", "-")
    return ACTION_ALIASES.get(a, a)


def resolve_document_transition(
    doc_type: str,
    current_status: str,
    action: str,
) -> Tuple[Optional[str], Optional[str]]:
    """
    Resolve a document action to a new status.

    Returns (new_status, error_code). (None, None) means a successful no-op.
    """
    act = normalize_document_action(action)
    status = current_status or "Draft"
    allowed = DOCUMENT_STATUSES.get(doc_type, frozenset())

    if act in NOOP_DOCUMENT_ACTIONS:
        return None, None

    if act == "post":
        if status != "Draft":
            return None, "document.invalid_transition"
        target = POST_TO.get(doc_type)
        if not target or target not in allowed:
            return None, "document.invalid_transition"
        return target, None

    if act == "accept":
        if status != "Sent" or doc_type not in ("estimates", "quotes"):
            return None, "document.invalid_transition"
        return "Accepted", None

    if act == "decline":
        if status != "Sent" or doc_type not in ("estimates", "quotes"):
            return None, "document.invalid_transition"
        return "Declined", None

    if act == "approve":
        if status != "Pending approval" or doc_type != "purchase-requests":
            return None, "document.invalid_transition"
        return "Approved", None

    if act == "reject":
        if status != "Pending approval" or doc_type != "purchase-requests":
            return None, "document.invalid_transition"
        return "Rejected", None

    if act == "receive":
        if doc_type != "purchase-orders" or status not in ("Sent", "Partly received"):
            return None, "document.invalid_transition"
        return "Received", None

    if act == "apply":
        if status != "Open" or doc_type not in ("credit-notes", "debit-notes", "vendor-credits"):
            return None, "document.invalid_transition"
        return "Applied", None

    if act == "pause":
        if doc_type != "recurring" or status != "Active":
            return None, "document.invalid_transition"
        return "Paused", None

    if act == "resume":
        if doc_type != "recurring" or status != "Paused":
            return None, "document.invalid_transition"
        return "Active", None

    if act == "reverse":
        if doc_type != "journals" or status != "Posted":
            return None, "document.invalid_transition"
        return "Reversed", None

    if act == "reimb":
        if doc_type != "expenses" or status != "Posted":
            return None, "document.invalid_transition"
        return "Reimbursed", None

    if act == "convert":
        convert_targets = {
            "estimates": ("Accepted", "Converted"),
            "quotes": ("Accepted", "Converted"),
            "sales-orders": ("Confirmed", "Invoiced"),
            "purchase-requests": ("Approved", "Ordered"),
            "purchase-orders": ("Received", "Billed"),
        }
        rule = convert_targets.get(doc_type)
        if not rule or status != rule[0]:
            return None, "document.invalid_transition"
        return rule[1], None

    if act == "void":
        if status in VOID_BLOCKED_STATUSES:
            return None, "document.invalid_transition"
        if "Void" not in allowed:
            return None, "document.invalid_transition"
        return "Void", None

    if act == "pay":
        # Payment recording is handled via /payments; action is acknowledged only.
        if doc_type in ("invoices", "bills") and status in ("Sent", "Open", "Overdue", "Partly paid"):
            return None, None
        return None, "document.invalid_transition"

    if act == "submit":
        if doc_type == "purchase-requests" and status == "Draft":
            return "Pending approval", None
        return None, "document.invalid_transition"

    if act == "expire":
        if doc_type in ("estimates", "quotes") and status == "Sent":
            return "Expired", None
        return None, "document.invalid_transition"

    return None, "document.unknown_action"


def should_post_to_gl(doc_type: str, action: str, new_status: Optional[str]) -> bool:
    act = normalize_document_action(action)
    if doc_type not in GL_POSTING_DOC_TYPES:
        return False
    if act not in ("post", "send"):
        return False
    if new_status is None:
        return False
    return new_status in ("Open", "Posted", "Sent")


@dataclass(frozen=True)
class GlProposal:
    account_code: str
    dr_paise: int = 0
    cr_paise: int = 0


def build_gl_proposals(doc_type: str, totals: Dict[str, Any]) -> List[GlProposal]:
    """Balanced double-entry lines for supported document types (amounts in paise)."""
    total = int(totals.get("total_paise") or totals.get("total") or 0)
    taxable = int(totals.get("taxable") or 0)
    tax = int(totals.get("tax") or 0)

    if doc_type == "invoices":
        return [
            GlProposal(GL_ACCOUNT_CODES["AR"], dr_paise=total),
            GlProposal(GL_ACCOUNT_CODES["SALES"], cr_paise=taxable),
            GlProposal(GL_ACCOUNT_CODES["GST_OUT"], cr_paise=tax),
        ]
    if doc_type == "bills":
        return [
            GlProposal(GL_ACCOUNT_CODES["EXPENSE"], dr_paise=taxable),
            GlProposal(GL_ACCOUNT_CODES["GST_IN"], dr_paise=tax),
            GlProposal(GL_ACCOUNT_CODES["AP"], cr_paise=total),
        ]
    if doc_type == "credit-notes":
        return [
            GlProposal(GL_ACCOUNT_CODES["SALES"], dr_paise=taxable),
            GlProposal(GL_ACCOUNT_CODES["GST_OUT"], dr_paise=tax),
            GlProposal(GL_ACCOUNT_CODES["AR"], cr_paise=total),
        ]
    if doc_type == "debit-notes":
        return [
            GlProposal(GL_ACCOUNT_CODES["AR"], dr_paise=total),
            GlProposal(GL_ACCOUNT_CODES["SALES"], cr_paise=taxable),
            GlProposal(GL_ACCOUNT_CODES["GST_OUT"], cr_paise=tax),
        ]
    if doc_type == "vendor-credits":
        return [
            GlProposal(GL_ACCOUNT_CODES["AP"], dr_paise=total),
            GlProposal(GL_ACCOUNT_CODES["EXPENSE"], cr_paise=taxable),
            GlProposal(GL_ACCOUNT_CODES["GST_IN"], cr_paise=tax),
        ]
    if doc_type == "expenses":
        return [
            GlProposal(GL_ACCOUNT_CODES["EXPENSE"], dr_paise=total),
            GlProposal(GL_ACCOUNT_CODES["AP"], cr_paise=total),
        ]
    if doc_type == "purchase-receipts":
        # Inventory asset posting — full stock/COGS split is TODO when items link to accounts.
        return [
            GlProposal(GL_ACCOUNT_CODES["EXPENSE"], dr_paise=total),
            GlProposal(GL_ACCOUNT_CODES["AP"], cr_paise=total),
        ]
    if doc_type == "journals":
        # Journal GL comes from document lines (account_id on lines); stub validates totals only.
        return []
    return []


def validate_gl_proposals(entries: List[GlProposal]) -> Optional[str]:
    dr = sum(e.dr_paise for e in entries)
    cr = sum(e.cr_paise for e in entries)
    if dr != cr:
        return "gl.unbalanced"
    return None


def totals_dict_from_calc(calc: DocumentCalculation) -> Dict[str, int]:
    total_paise = int(calc.total)
    return {
        "sub": calc.sub,
        "disc": calc.disc,
        "taxable": calc.taxable,
        "tax": calc.tax,
        "cg": calc.cg,
        "sg": calc.sg,
        "ig": calc.ig,
        "ro": calc.ro,
        "total": total_paise,
        "total_paise": total_paise,
    }


def calculate_gst_breakup(
    taxable_amount: int,
    gst_rate: Decimal,
    inter: bool,
) -> Dict[str, int]:
    """
    Calculate GST breakup for a line item
    
    Returns: {cgst, sgst, igst}
    """
    tax = int(Decimal(taxable_amount) * (gst_rate / 100))
    
    if inter:
        return {"cgst": 0, "sgst": 0, "igst": tax}
    else:
        cgst = int(tax / 2)  # floor division
        sgst = tax - cgst
        return {"cgst": cgst, "sgst": sgst, "igst": 0}


def calculate_tds(
    amount: int,
    tds_rate: Optional[Decimal] = None,
    tds_section: Optional[str] = None,
) -> int:
    """
    Calculate TDS deduction
    
    TDS rates vary by section (194C = 1%, 194J = 2%, etc.)
    """
    if not tds_rate:
        return 0
    
    return int(Decimal(amount) * (tds_rate / 100))


def calculate_balance(
    document_total: int,
    paid: int,
    allocations: List[Dict[str, Any]],
) -> int:
    """
    Calculate document balance
    
    Balance = total - paid - allocated
    """
    allocated = sum(a.get("amount_paise", 0) for a in allocations)
    return max(0, document_total - paid - allocated)


def calculate_aging_buckets(
    due_date: date,
    amount: int,
    as_of: date,
) -> str:
    """
    Calculate aging bucket
    
    Buckets: 0-30, 31-60, 61-90, 91-120, 120+
    """
    days_overdue = (as_of - due_date).days
    
    if days_overdue <= 0:
        return "current"
    elif days_overdue <= 30:
        return "0-30"
    elif days_overdue <= 60:
        return "31-60"
    elif days_overdue <= 90:
        return "61-90"
    elif days_overdue <= 120:
        return "91-120"
    else:
        return "120+"


def validate_gstin(gstin: str) -> bool:
    """
    Validate GSTIN format
    
    Format: 2-digit state code + 10-digit PAN + 1-digit entity number + Z + checksum
    """
    if len(gstin) != 15:
        return False
    
    # Check format
    if not gstin[:2].isdigit():
        return False
    if not gstin[2:12].isalnum():
        return False
    if gstin[13] != "Z":
        return False
    
    # TODO: Validate checksum using GSTIN algorithm
    return True


def validate_pan(pan: str) -> bool:
    """
    Validate PAN format
    
    Format: 5 letters + 4 digits + 1 letter
    """
    if len(pan) != 10:
        return False
    
    if not pan[:5].isalpha():
        return False
    if not pan[5:9].isdigit():
        return False
    if not pan[9].isalpha():
        return False
    
    return True


def validate_ifsc(ifsc: str) -> bool:
    """
    Validate IFSC format
    
    Format: 4 letters + 0 + 6 alphanumeric
    """
    if len(ifsc) != 11:
        return False
    
    if not ifsc[:4].isalpha():
        return False
    if ifsc[4] != "0":
        return False
    if not ifsc[5:].isalnum():
        return False
    
    return True


def validate_phone(phone: str) -> bool:
    """
    Validate Indian phone number
    
    Format: +91 + 10 digits (10, 6-9, or 7-8 starting)
    """
    # Remove spaces and dashes
    phone = phone.replace(" ", "").replace("-", "")
    
    if not phone.startswith("+91"):
        return False
    
    if len(phone) != 13:  # +91 + 10 digits
        return False
    
    digits = phone[3:]
    if not digits.isdigit():
        return False
    
    # First digit must be 6-9 or 7-8
    if digits[0] not in ["6", "7", "8", "9"]:
        return False
    
    return True


def validate_email(email: str) -> bool:
    """
    Basic email validation
    """
    if "@" not in email:
        return False
    
    local, domain = email.split("@", 1)
    if not local or not domain:
        return False
    
    if "." not in domain:
        return False
    
    return True


def round_to_nearest(amount: float, nearest: int = 100) -> int:
    """
    Round amount to nearest value
    
    E.g., round_to_nearest(1234, 100) = 1200
    """
    return int(round(Decimal(amount) / nearest) * nearest)


def amount_in_words(amount_paise: int) -> str:
    """
    Convert amount to Indian English words
    
    E.g., 123450 → "One thousand two hundred thirty-four rupees fifty paise"
    """
    rupees = amount_paise // 100
    paise = amount_paise % 100
    
    # TODO: Implement full number-to-words conversion
    # For now, return formatted amount
    if paise > 0:
        return f"₹{rupees}.{paise:02d}"
    else:
        return f"₹{rupees}"


def next_document_number(
    doc_type: str,
    prefix: str,
    next_num: int,
    fy: str,
) -> str:
    """
    Generate next document number
    
    Format: {prefix}{fy}-{number}
    E.g., "INV-2026-0001"
    """
    return f"{prefix}{fy}-{next_num:04d}"


def generate_invoice_number(prefix: str = "INV-", fy: str = "2026-27", next_num: int = 1) -> str:
    """Generate invoice number"""
    return next_document_number("invoices", prefix, next_num, fy)


def generate_estimate_number(prefix: str = "EST-", fy: str = "2026-27", next_num: int = 1) -> str:
    """Generate estimate number"""
    return next_document_number("estimates", prefix, next_num, fy)


def generate_journal_number(prefix: str = "JV-", fy: str = "2026-27", next_num: int = 1) -> str:
    """Generate journal number"""
    return next_document_number("journals", prefix, next_num, fy)


def generate_expense_number(prefix: str = "EXP-", fy: str = "2026-27", next_num: int = 1) -> str:
    """Generate expense number"""
    return next_document_number("expenses", prefix, next_num, fy)


def calculate_tds_summary(
    payments: List[Dict[str, Any]],
    quarter: str,
) -> Dict[str, Any]:
    """
    Calculate TDS summary for a quarter
    """
    total_deducted = sum(p.get("tds_paise", 0) for p in payments)
    
    return {
        "quarter": quarter,
        "total_deducted_paise": total_deducted,
        "payments_count": len(payments),
    }


def calculate_project_margin(
    budget: int,
    spent: int,
    invoiced: int,
) -> Dict[str, Any]:
    """
    Calculate project margin
    """
    margin_paise = budget - spent
    margin_pct = Decimal(margin_paise) / Decimal(budget) * 100 if budget > 0 else Decimal("0")
    
    return {
        "budget_paise": budget,
        "spent_paise": spent,
        "invoiced_paise": invoiced,
        "margin_paise": margin_paise,
        "margin_pct": float(margin_pct),
    }
