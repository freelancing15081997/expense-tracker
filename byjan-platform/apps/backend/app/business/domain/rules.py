"""
Business domain rules - pure calculations and invariants
Ported from frontend BizLogic.js
"""

from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Optional, Any
from decimal import Decimal, ROUND_HALF_UP
import structlog

from app.shared.types import Money

log = structlog.get_logger(__name__)


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
    """Document calculation result"""
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
