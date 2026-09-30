"""
Deep unit tests for app.business.domain.rules —
document totals (intra/inter GST, discounts, journals, round-off),
GST breakup, TDS, balances, ageing buckets, validators,
document numbering, Indian amount-in-words and project margins.
"""

import pytest
from decimal import Decimal
from datetime import date

from app.business.domain.rules import (
    GST_RATES,
    calculate_document_totals,
    calculate_gst_breakup,
    calculate_tds,
    calculate_balance,
    calculate_aging_buckets,
    validate_gstin,
    validate_pan,
    validate_ifsc,
    validate_phone,
    validate_email,
    round_to_nearest,
    amount_in_words,
    next_document_number,
    generate_invoice_number,
    generate_estimate_number,
    generate_journal_number,
    generate_expense_number,
    calculate_tds_summary,
    calculate_project_margin,
)


# ---------------------------------------------------------------------------
# calculate_document_totals
# ---------------------------------------------------------------------------

class TestDocumentTotals:
    def test_single_line_intra_state(self):
        """Same-state supply splits GST into CGST+SGST."""
        r = calculate_document_totals(
            lines=[{"qty": 1, "rate": 100000, "gst_rate": 18}],
            party_state_code="27",
            company_state_code="27",
        )
        assert r.sub == 100000
        assert r.tax == 18000
        assert r.cg == 9000
        assert r.sg == 9000
        assert r.ig == 0
        assert r.inter is False
        assert r.cg + r.sg == r.tax
        assert r.total == 118000

    def test_single_line_inter_state(self):
        """Different-state supply routes all GST to IGST."""
        r = calculate_document_totals(
            lines=[{"qty": 1, "rate": 100000, "gst_rate": 18}],
            party_state_code="29",
            company_state_code="27",
        )
        assert r.inter is True
        assert r.ig == 18000
        assert r.cg == 0 and r.sg == 0
        assert r.total == 118000

    def test_multiple_lines_mixed_rates(self):
        r = calculate_document_totals(
            lines=[
                {"qty": 2, "rate": 50000, "gst_rate": 18},   # 1000 @18%
                {"qty": 1, "rate": 100000, "gst_rate": 12},  # 1000 @12%
                {"qty": 5, "rate": 1000, "gst_rate": 0},     # 50 @0%
            ],
            party_state_code="27",
            company_state_code="27",
        )
        assert r.sub == 205000
        assert r.tax == 30000  # 18000 + 12000 + 0
        assert r.cg + r.sg == 30000
        assert r.total == 235000

    def test_odd_tax_paisa_split(self):
        """CGST floors, SGST takes the remainder — never loses a paisa."""
        r = calculate_document_totals(
            lines=[{"qty": 1, "rate": 105, "gst_rate": 10}],  # tax = 10.5 → int 10
            party_state_code="27",
            company_state_code="27",
        )
        assert r.tax == 10
        assert r.cg + r.sg == r.tax

    def test_zero_gst_lines(self):
        r = calculate_document_totals(
            lines=[{"qty": 3, "rate": 9999, "gst_rate": 0}],
            party_state_code="27",
            company_state_code="27",
        )
        assert r.tax == 0 and r.cg == r.sg == r.ig == 0
        assert r.total == 29997

    def test_discount_caps_at_subtotal(self):
        r = calculate_document_totals(
            lines=[{"qty": 1, "rate": 50000, "gst_rate": 18}],
            party_state_code="27",
            company_state_code="27",
            discount=999999,
        )
        assert r.disc == 50000
        assert r.taxable == 0
        assert r.tax == 0
        assert r.total == 0

    def test_discount_scales_tax(self):
        """Flat discount shrinks tax proportionally (f = taxable/sub)."""
        r = calculate_document_totals(
            lines=[{"qty": 1, "rate": 100000, "gst_rate": 18}],
            party_state_code="27",
            company_state_code="27",
            discount=25000,  # 25%
        )
        assert r.disc == 25000
        assert r.taxable == 75000
        assert r.tax == 13500  # 18000 * 0.75
        assert r.cg + r.sg == 13500

    def test_discount_zero_subtotal_no_divzero(self):
        r = calculate_document_totals(
            lines=[], party_state_code="27", company_state_code="27",
            discount=100,
        )
        assert r.sub == 0 and r.disc == 0 and r.total == 0

    def test_missing_keys_default_zero(self):
        r = calculate_document_totals(
            lines=[{}], party_state_code="27", company_state_code="27"
        )
        assert r.sub == 0 and r.total == 0

    def test_decimal_inputs(self):
        r = calculate_document_totals(
            lines=[{"qty": Decimal("2.5"), "rate": Decimal("400"), "gst_rate": Decimal("5")}],
            party_state_code="27",
            company_state_code="27",
        )
        assert r.sub == 1000
        assert r.tax == 50

    def test_party_state_none_is_inter(self):
        """None party state counts as inter-state (IGST)."""
        r = calculate_document_totals(
            lines=[{"qty": 1, "rate": 10000, "gst_rate": 18}],
            party_state_code=None,
            company_state_code="27",
        )
        assert r.inter is True
        assert r.ig == 1800

    def test_journals_sum_dr_cr(self):
        r = calculate_document_totals(
            lines=[
                {"dr": 50000, "cr": 0},
                {"dr": 0, "cr": 50000},
            ],
            party_state_code="27",
            company_state_code="27",
            document_type="journals",
        )
        assert r.dr == 50000 and r.cr == 50000
        assert r.total == 50000
        assert r.tax == 0
        assert r.inter is False

    def test_journals_unbalanced_surfaces(self):
        """The calc reports the imbalance; balancing is validated elsewhere."""
        r = calculate_document_totals(
            lines=[{"dr": 70000, "cr": 50000}],
            party_state_code="27",
            company_state_code="27",
            document_type="journals",
        )
        assert r.dr == 70000 and r.cr == 50000
        assert r.dr != r.cr

    def test_round_off_field(self):
        r = calculate_document_totals(
            lines=[{"qty": 1, "rate": 100, "gst_rate": 5}],  # raw 105 → total 105
            party_state_code="27",
            company_state_code="27",
        )
        assert r.ro == r.total - (r.taxable + r.tax)

    def test_all_gst_rates(self):
        for rate_key, rate_val in GST_RATES.items():
            r = calculate_document_totals(
                lines=[{"qty": 1, "rate": 100000, "gst_rate": rate_val}],
                party_state_code="27",
                company_state_code="27",
            )
            expected_tax = int(100000 * rate_val / 100)
            assert r.tax == expected_tax, f"GST rate {rate_key}%"
            assert r.cg + r.sg + r.ig == r.tax


# ---------------------------------------------------------------------------
# calculate_gst_breakup
# ---------------------------------------------------------------------------

class TestGstBreakup:
    def test_inter_state_all_igst(self):
        b = calculate_gst_breakup(100000, Decimal("18"), inter=True)
        assert b == {"cgst": 0, "sgst": 0, "igst": 18000}

    def test_intra_state_even_split(self):
        b = calculate_gst_breakup(100000, Decimal("18"), inter=False)
        assert b == {"cgst": 9000, "sgst": 9000, "igst": 0}

    def test_intra_state_odd_amount_conserves_paisa(self):
        b = calculate_gst_breakup(101, Decimal("5"), inter=False)
        assert b["cgst"] + b["sgst"] == int(101 * Decimal("0.05"))

    def test_zero_rate(self):
        b = calculate_gst_breakup(50000, Decimal("0"), inter=False)
        assert b == {"cgst": 0, "sgst": 0, "igst": 0}


# ---------------------------------------------------------------------------
# calculate_tds
# ---------------------------------------------------------------------------

class TestTds:
    def test_rate_applied(self):
        assert calculate_tds(100000, Decimal("2")) == 2000

    def test_section_194c_one_percent(self):
        assert calculate_tds(500000, Decimal("1"), "194C") == 5000

    def test_no_rate_no_tds(self):
        assert calculate_tds(100000, None) == 0
        assert calculate_tds(100000, Decimal("0")) == 0

    def test_floors_paisa(self):
        assert isinstance(calculate_tds(999, Decimal("10")), int)


# ---------------------------------------------------------------------------
# calculate_balance
# ---------------------------------------------------------------------------

class TestBalance:
    def test_full_outstanding(self):
        assert calculate_balance(100000, 0, []) == 100000

    def test_partial_payment(self):
        assert calculate_balance(100000, 40000, []) == 60000

    def test_allocations_reduce_balance(self):
        allocs = [{"amount_paise": 20000}, {"amount_paise": 30000}]
        assert calculate_balance(100000, 20000, allocs) == 30000

    def test_overpayment_floors_at_zero(self):
        assert calculate_balance(50000, 90000, []) == 0


# ---------------------------------------------------------------------------
# calculate_aging_buckets
# ---------------------------------------------------------------------------

class TestAgingBuckets:
    d = staticmethod(lambda dd, mm: date(2026, mm, dd))

    def test_current_when_not_overdue(self):
        assert calculate_aging_buckets(date(2026, 9, 30), 100, date(2026, 9, 29)) == "current"
        assert calculate_aging_buckets(date(2026, 9, 29), 100, date(2026, 9, 29)) == "current"

    @pytest.mark.parametrize("days,bucket", [
        (1, "0-30"), (30, "0-30"),
        (31, "31-60"), (60, "31-60"),
        (61, "61-90"), (90, "61-90"),
        (91, "91-120"), (120, "91-120"),
        (121, "120+"), (400, "120+"),
    ])
    def test_bucket_boundaries(self, days, bucket):
        due = date(2026, 1, 1)
        as_of = date(2026, 1, 1).fromordinal(due.toordinal() + days)
        assert calculate_aging_buckets(due, 100, as_of) == bucket


# ---------------------------------------------------------------------------
# Validators
# ---------------------------------------------------------------------------

class TestValidators:
    @pytest.mark.parametrize("gstin,ok", [
        ("27AAKCS8841D1Z6", True),
        ("29AAHFO3321P1Z5", True),
        ("07AAFCK2210L1Z9", True),
        ("27AAKCS8841D1Z", False),    # too short
        ("27AAKCS8841D1Z66", False),  # too long
        ("AAAAAKCS8841D1Z6", False),  # state code not digits
        ("27AAKCS8841D1Y6", False),   # 13th char not Z
        ("", False),
    ])
    def test_gstin(self, gstin, ok):
        assert validate_gstin(gstin) is ok

    @pytest.mark.parametrize("pan,ok", [
        ("AAKCS8841D", True), ("XYZPD5678G", True),
        ("AAKCS8841", False), ("AAKCS88411D", False),
        ("12345ABCD6", False), ("ABCDE12345", False),
        ("ABCDE123A5", False), ("", False),
    ])
    def test_pan(self, pan, ok):
        assert validate_pan(pan) is ok

    @pytest.mark.parametrize("ifsc,ok", [
        ("HDFC0000240", True), ("SBIN0001234", True),
        ("HDFC00024", False), ("HDFC00002400", False),
        ("HDFC1000240", False), ("12FC0000240", False),
        ("", False),
    ])
    def test_ifsc(self, ifsc, ok):
        assert validate_ifsc(ifsc) is ok

    @pytest.mark.parametrize("phone,ok", [
        ("+919876543210", True), ("+91 98765 43210", True),
        ("+91-98765-43210", True), ("+917876543210", True),
        ("9876543210", False),       # missing +91
        ("+911234567890", False),    # starts with 1
        ("+915876543210", False),    # starts with 5
        ("+91987654321", False),     # 9 digits
        ("+9198765432100", False),   # 11 digits
        ("+91abcdefghij", False),
        ("", False),
    ])
    def test_phone(self, phone, ok):
        assert validate_phone(phone) is ok

    @pytest.mark.parametrize("email,ok", [
        ("a@b.co", True), ("user.name+tag@domain.co.uk", True),
        ("no-at-sign", False), ("@domain.com", False),
        ("user@", False), ("user@domain", False), ("", False),
    ])
    def test_email(self, email, ok):
        assert validate_email(email) is ok


# ---------------------------------------------------------------------------
# Rounding / words / numbering
# ---------------------------------------------------------------------------

class TestFormatting:
    def test_round_to_nearest(self):
        assert round_to_nearest(1234, 100) == 1200
        assert round_to_nearest(1260, 100) == 1300
        # Decimal round() is half-even: 12.5 → 12
        assert round_to_nearest(1250, 100) == 1200

    def test_amount_in_words_with_paise(self):
        assert amount_in_words(123450) == "₹1234.50"
        assert amount_in_words(100000) == "₹1000"

    def test_next_document_number_format(self):
        assert next_document_number("invoices", "INV-", 42, "2026-27") == "INV-2026-27-0042"
        assert next_document_number("bills", "BILL-", 1, "2026-27") == "BILL-2026-27-0001"

    def test_number_generators(self):
        assert generate_invoice_number(next_num=7).startswith("INV-2026-27-")
        assert generate_estimate_number(next_num=7).startswith("EST-")
        assert generate_journal_number(next_num=7).startswith("JV-")
        assert generate_expense_number(next_num=7).startswith("EXP-")


# ---------------------------------------------------------------------------
# TDS summary / project margin
# ---------------------------------------------------------------------------

class TestAggregates:
    def test_tds_summary(self):
        payments = [{"tds_paise": 1000}, {"tds_paise": 2500}, {}]
        s = calculate_tds_summary(payments, "Q2")
        assert s == {
            "quarter": "Q2",
            "total_deducted_paise": 3500,
            "payments_count": 3,
        }

    def test_project_margin(self):
        m = calculate_project_margin(budget=100000, spent=40000, invoiced=60000)
        assert m["margin_paise"] == 60000
        assert m["margin_pct"] == pytest.approx(60.0)

    def test_project_margin_zero_budget_no_divzero(self):
        m = calculate_project_margin(budget=0, spent=100, invoiced=0)
        assert m["margin_pct"] == 0.0
