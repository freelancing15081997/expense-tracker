"""
Tests for Business domain rules - GST, TDS, calculations
"""

import pytest
from decimal import Decimal
from datetime import date

from app.business.domain.rules import (
    calculate_gst,
    calculate_tds,
    calculate_document_totals,
    calculate_gst_rate,
    validate_gstin,
    validate_pan,
    validate_phone,
    validate_email,
    validate_hsn,
    calculate_depreciation,
    days_overdue,
    calculate_aging_buckets,
)


class TestGSTCalculation:
    """Test GST calculations"""

    def test_gst_intra_state(self):
        """Test GST for intra-state (same state)"""
        # Company in Maharashtra (27), Party in Maharashtra (27)
        result = calculate_gst(100000, 18, "27", "27", "expense")
        
        assert result["taxable_amount_paise"] == 100000
        assert result["cgst_paise"] == 9000  # 9%
        assert result["sgst_paise"] == 9000  # 9%
        assert result["igst_paise"] == 0
        assert result["cess_paise"] == 0
        assert result["gst_amount_paise"] == 18000  # 18%
        assert result["total_paise"] == 118000

    def test_gst_inter_state(self):
        """Test GST for inter-state (different states)"""
        # Company in Maharashtra (27), Party in Karnataka (29)
        result = calculate_gst(100000, 18, "29", "27", "expense")
        
        assert result["taxable_amount_paise"] == 100000
        assert result["cgst_paise"] == 0
        assert result["sgst_paise"] == 0
        assert result["igst_paise"] == 18000  # 18%
        assert result["cess_paise"] == 0
        assert result["gst_amount_paise"] == 18000
        assert result["total_paise"] == 118000

    def test_gst_zero_rate(self):
        """Test GST for 0% rate"""
        result = calculate_gst(100000, 0, "27", "27", "expense")
        
        assert result["taxable_amount_paise"] == 100000
        assert result["cgst_paise"] == 0
        assert result["sgst_paise"] == 0
        assert result["igst_paise"] == 0
        assert result["gst_amount_paise"] == 0
        assert result["total_paise"] == 100000


class TestTDSCalculation:
    """Test TDS calculations"""

    def test_tds_under_threshold(self):
        """Test TDS when under threshold"""
        # Payment: ₹50,000, Threshold: ₹30,000
        result = calculate_tds(50000, 30000, 10, "expense")
        
        assert result["tds_deductible_paise"] == 0
        assert result["tds_amount_paise"] == 0

    def test_tds_over_threshold(self):
        """Test TDS when over threshold"""
        # Payment: ₹50,000, Threshold: ₹30,000
        result = calculate_tds(50000, 30000, 10, "expense")
        
        # TDS on amount over threshold: ₹20,000 * 10% = ₹2,000
        assert result["tds_deductible_paise"] == 20000
        assert result["tds_amount_paise"] == 2000

    def test_tds_zero_rate(self):
        """Test TDS with 0% rate"""
        result = calculate_tds(50000, 30000, 0, "expense")
        
        assert result["tds_deductible_paise"] == 0
        assert result["tds_amount_paise"] == 0


class TestDocumentTotals:
    """Test document totals calculation"""

    def test_document_totals_single_line(self):
        """Test document with single line"""
        lines = [
            {
                "qty": 1,
                "rate_paise": 100000,  # ₹1,000
                "discount_pct": Decimal("0"),
                "gst_rate": Decimal("0.18"),  # 18%
            }
        ]
        
        result = calculate_document_totals(lines, "27", "27", "invoices")
        
        assert result["subtotal_paise"] == 100000
        assert result["discount_paise"] == 0
        assert result["cgst_paise"] == 9000
        assert result["sgst_paise"] == 9000
        assert result["igst_paise"] == 0
        assert result["gst_paise"] == 18000
        assert result["total_paise"] == 118000

    def test_document_totals_multiple_lines(self):
        """Test document with multiple lines"""
        lines = [
            {
                "qty": 2,
                "rate_paise": 50000,  # ₹500
                "discount_pct": Decimal("0"),
                "gst_rate": Decimal("0.18"),
            },
            {
                "qty": 1,
                "rate_paise": 100000,  # ₹1,000
                "discount_pct": Decimal("0"),
                "gst_rate": Decimal("0.12"),  # 12%
            },
        ]
        
        result = calculate_document_totals(lines, "27", "27", "invoices")
        
        # Line 1: 2 * ₹500 = ₹1,000, GST 18% = ₹180
        # Line 2: 1 * ₹1,000 = ₹1,000, GST 12% = ₹120
        # Total: ₹2,000, GST: ₹300
        assert result["subtotal_paise"] == 200000  # ₹2,000
        assert result["discount_paise"] == 0
        assert result["cgst_paise"] == 15000  # ₹150
        assert result["sgst_paise"] == 15000  # ₹150
        assert result["igst_paise"] == 0
        assert result["gst_paise"] == 30000  # ₹300
        assert result["total_paise"] == 230000  # ₹2,300


class TestValidation:
    """Test validation functions"""

    def test_validate_gstin(self):
        """Test GSTIN validation"""
        # Valid GSTIN
        assert validate_gstin("27ABCDE1234F1Z5") is True
        assert validate_gstin("29XYZPD5678G2H4") is True
        
        # Invalid GSTIN
        assert validate_gstin("123456789012345") is False  # Wrong length
        assert validate_gstin("27ABCDE1234F1Z") is False  # Too short
        assert validate_gstin("27ABCDE1234F1Z55") is False  # Too long
        assert validate_gstin("") is False  # Empty
        assert validate_gstin(None) is False  # None

    def test_validate_pan(self):
        """Test PAN validation"""
        # Valid PAN
        assert validate_pan("ABCDE1234F") is True
        assert validate_pan("XYZPD5678G") is True
        
        # Invalid PAN
        assert validate_pan("1234567890") is False  # All digits
        assert validate_pan("ABCDE12345") is False  # Wrong format
        assert validate_pan("") is False  # Empty
        assert validate_pan(None) is False  # None

    def test_validate_phone(self):
        """Test phone validation"""
        # Valid phone
        assert validate_phone("+919876543210") is True
        assert validate_phone("9876543210") is True
        assert validate_phone("+91 98765 43210") is True
        
        # Invalid phone
        assert validate_phone("123") is False  # Too short
        assert validate_phone("abcdefghij") is False  # Not digits
        assert validate_phone("") is False  # Empty
        assert validate_phone(None) is False  # None

    def test_validate_email(self):
        """Test email validation"""
        # Valid email
        assert validate_email("test@example.com") is True
        assert validate_email("user.name+tag@domain.co.uk") is True
        
        # Invalid email
        assert validate_email("invalid-email") is False  # No @
        assert validate_email("@domain.com") is False  # No local part
        assert validate_email("user@") is False  # No domain
        assert validate_email("") is False  # Empty
        assert validate_email(None) is False  # None

    def test_validate_hsn(self):
        """Test HSN validation"""
        # Valid HSN (4, 6, or 8 digits)
        assert validate_hsn("1234") is True
        assert validate_hsn("123456") is True
        assert validate_hsn("12345678") is True
        
        # Invalid HSN
        assert validate_hsn("12") is False  # Too short
        assert validate_hsn("12345") is False  # 5 digits
        assert validate_hsn("123456789") is False  # 9 digits
        assert validate_hsn("abcd") is False  # Not digits
        assert validate_hsn("") is False  # Empty
        assert validate_hsn(None) is False  # None


class TestDepreciation:
    """Test depreciation calculations"""

    def test_straight_line_depreciation(self):
        """Test straight-line depreciation"""
        # Asset: ₹100,000, Rate: 10%, Method: straight-line
        # Annual depreciation: ₹10,000
        # Daily depreciation: ₹10,000 / 365 = ₹27.40
        
        result = calculate_depreciation(
            cost_paise=100000,
            rate_pct=Decimal("10"),
            method="straight-line",
            days=365,
        )
        
        assert result == 10000  # ₹10,000 for full year

    def test_wdv_depreciation(self):
        """Test WDV depreciation"""
        # Asset: ₹100,000, Rate: 10%, Method: WDV
        # Year 1: ₹10,000
        # Year 2: ₹9,000 (10% of ₹90,000)
        
        result_year1 = calculate_depreciation(
            cost_paise=100000,
            rate_pct=Decimal("10"),
            method="wdv",
            days=365,
            accumulated=0,
        )
        
        result_year2 = calculate_depreciation(
            cost_paise=100000,
            rate_pct=Decimal("10"),
            method="wdv",
            days=365,
            accumulated=result_year1,
        )
        
        assert result_year1 == 10000  # ₹10,000 for year 1
        assert result_year2 == 9000   # ₹9,000 for year 2 (10% of ₹90,000)


class TestAging:
    """Test aging calculations"""

    def test_days_overdue(self):
        """Test days overdue calculation"""
        due_date = date(2026, 1, 15)
        today = date(2026, 1, 20)
        
        assert days_overdue(due_date, today) == 5
        
        # Not overdue
        today = date(2026, 1, 10)
        assert days_overdue(due_date, today) == 0

    def test_aging_buckets(self):
        """Test aging buckets calculation"""
        # Invoice: ₹100,000, Due: 2026-01-15
        # Payments:
        # - ₹30,000 on 2026-01-10 (5 days overdue)
        # - ₹40,000 on 2026-01-18 (3 days overdue)
        # - ₹30,000 on 2026-01-25 (10 days overdue)
        
        allocations = [
            {"amount_paise": 30000, "days_overdue": 5},
            {"amount_paise": 40000, "days_overdue": 3},
            {"amount_paise": 30000, "days_overdue": 10},
        ]
        
        result = calculate_aging_buckets(allocations)
        
        assert result["current"] == 30000  # ₹30,000 (not overdue)
        assert result["days_1_30"] == 70000  # ₹70,000 (5+3 days)
        assert result["days_31_60"] == 0
        assert result["days_61_90"] == 0
        assert result["days_90_plus"] == 30000  # ₹30,000 (10 days)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
