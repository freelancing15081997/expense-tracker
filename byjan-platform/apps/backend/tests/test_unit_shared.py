"""
Deep unit tests for shared value objects:
Money, Qty, Percent, Result, UUIDv7/IdGen, pagination models.
"""

import uuid
import pytest

from app.shared.types import Money, Qty, Percent, Result, ResultType
from app.shared.ids import UUIDv7, IdGen
from app.shared.pagination import PaginationParams, PaginatedResponse, PageInfo


# ---------------------------------------------------------------------------
# Money
# ---------------------------------------------------------------------------

class TestMoney:
    def test_from_rupees(self):
        assert Money.from_rupees(10.50).paise == 1050
        assert Money.from_rupees(0.01).paise == 1

    def test_from_rupees_rounds(self):
        # 1.005 * 100 is 100.4999… in IEEE-754, so it rounds down
        assert Money.from_rupees(1.005).paise == 100
        assert Money.from_rupees(1.006).paise == 101
        assert isinstance(Money.from_rupees(1.005).paise, int)

    def test_rupees_property(self):
        assert Money(123456).rupees == 1234.56

    def test_negative_rejected(self):
        with pytest.raises(ValueError):
            Money(-1)

    def test_zero_allowed(self):
        assert Money(0).paise == 0

    def test_add(self):
        assert (Money(100) + Money(250)).paise == 350

    def test_add_type_error_on_non_money(self):
        with pytest.raises(AttributeError):
            Money(100) + 5  # noqa: operands are intentionally wrong

    def test_sub(self):
        assert (Money(300) - Money(120)).paise == 180

    def test_sub_floors_at_zero(self):
        assert (Money(100) - Money(500)).paise == 0

    def test_mul(self):
        assert (Money(1000) * 1.18).paise == 1180
        # int(round(50.5)) uses round-half-even → 50
        assert (Money(101) * 0.5).paise == 50

    def test_mul_result_is_int(self):
        assert isinstance((Money(101) * 0.5).paise, int)

    def test_str_formats_inr(self):
        assert str(Money(123450)) == "₹1234.50"
        assert str(Money(5)) == "₹0.05"

    def test_immutable(self):
        m = Money(100)
        with pytest.raises(Exception):
            m.paise = 200  # frozen dataclass


# ---------------------------------------------------------------------------
# Qty
# ---------------------------------------------------------------------------

class TestQty:
    def test_negative_rejected(self):
        with pytest.raises(ValueError):
            Qty(-0.5, "kg")

    def test_add_same_unit(self):
        assert (Qty(2.5, "kg") + Qty(1.5, "kg")).value == 4.0

    def test_add_different_unit_rejected(self):
        with pytest.raises(ValueError):
            Qty(1, "kg") + Qty(1, "bag")

    def test_sub_same_unit(self):
        assert (Qty(5, "bag") - Qty(2, "bag")).value == 3

    def test_sub_floors_at_zero(self):
        assert (Qty(1, "bag") - Qty(5, "bag")).value == 0

    def test_str(self):
        assert str(Qty(2.5, "kg")) == "2.5 kg"


# ---------------------------------------------------------------------------
# Percent
# ---------------------------------------------------------------------------

class TestPercent:
    def test_bounds(self):
        Percent(0)
        Percent(100)
        with pytest.raises(ValueError):
            Percent(-0.1)
        with pytest.raises(ValueError):
            Percent(100.01)

    def test_decimal_conversion(self):
        assert Percent(18).to_decimal() == 0.18
        assert Percent.from_decimal(0.28).value == pytest.approx(28.0)

    def test_str(self):
        assert str(Percent(18)) == "18%"


# ---------------------------------------------------------------------------
# Result (Either)
# ---------------------------------------------------------------------------

class TestResult:
    def test_ok(self):
        r = Result.ok(42)
        assert r.is_ok() and not r.is_err()
        assert r.unwrap() == 42
        assert r.type == ResultType.OK

    def test_err(self):
        r = Result.err("boom")
        assert r.is_err() and not r.is_ok()
        assert r.unwrap_err() == "boom"
        assert r.type == ResultType.ERR

    def test_unwrap_err_raises_on_ok(self):
        with pytest.raises(ValueError):
            Result.ok(1).unwrap_err()

    def test_unwrap_raises_on_err(self):
        with pytest.raises(ValueError):
            Result.err("x").unwrap()


# ---------------------------------------------------------------------------
# UUIDv7 / IdGen
# ---------------------------------------------------------------------------

class TestIds:
    def test_generate_is_valid_uuid(self):
        value = UUIDv7.generate()
        parsed = uuid.UUID(value)
        assert str(parsed) == value

    def test_fallback_is_valid_uuidv7(self):
        # Render runs Python 3.12 — uuid.uuid7() is 3.13+, so this path is live.
        value = UUIDv7._generate_fallback()
        parsed = uuid.UUID(value)
        assert parsed.version == 7
        assert str(parsed) == value

    def test_generate_unique(self):
        ids = {UUIDv7.generate() for _ in range(500)}
        assert len(ids) == 500

    def test_generate_time_ordered(self):
        ids = [UUIDv7.generate() for _ in range(50)]
        assert ids == sorted(ids), "UUIDv7 should be lexically sortable by time"

    def test_idgen_namespaces(self):
        for fn in (
            IdGen.user_id, IdGen.tenant_id, IdGen.document_id,
            IdGen.session_id, IdGen.invite_id, IdGen.file_id,
            IdGen.job_id, IdGen.audit_id, IdGen.event_id,
        ):
            uuid.UUID(fn())  # must parse


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class TestPagination:
    def test_defaults(self):
        p = PaginationParams()
        assert p.limit == 25
        assert p.cursor is None
        assert p.offset == 0

    def test_limit_bounds(self):
        assert PaginationParams(limit=1).limit == 1
        assert PaginationParams(limit=100).limit == 100
        with pytest.raises(Exception):
            PaginationParams(limit=0)
        with pytest.raises(Exception):
            PaginationParams(limit=101)

    def test_paginated_response_shape(self):
        r = PaginatedResponse[int](
            data=[1, 2, 3],
            page=PageInfo(next_cursor="abc", has_more=True, total=10),
        )
        dumped = r.model_dump()
        assert dumped["data"] == [1, 2, 3]
        assert dumped["page"]["next_cursor"] == "abc"
        assert dumped["page"]["has_more"] is True
        assert dumped["page"]["total"] == 10
        assert dumped["meta"] is None

    def test_page_info_defaults(self):
        p = PageInfo()
        assert p.has_more is False
        assert p.next_cursor is None
        assert p.total is None
