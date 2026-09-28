"""
Shared types and value objects
"""

from dataclasses import dataclass
from typing import TypeVar, Generic
from enum import Enum


class ResultType(Enum):
    """Result type for Either pattern"""
    OK = "ok"
    ERR = "err"


T = TypeVar("T")
E = TypeVar("E")


@dataclass(frozen=True)
class Result(Generic[T, E]):
    """Result type for error handling - Either pattern"""
    type: ResultType
    value: T | None = None
    error: E | None = None

    @staticmethod
    def ok(value: T) -> "Result[T, E]":
        return Result(ResultType.OK, value=value, error=None)

    @staticmethod
    def err(error: E) -> "Result[T, E]":
        return Result(ResultType.ERR, value=None, error=error)

    def is_ok(self) -> bool:
        return self.type == ResultType.OK

    def is_err(self) -> bool:
        return self.type == ResultType.ERR

    def unwrap(self) -> T:
        if self.is_ok():
            return self.value  # type: ignore
        raise ValueError(f"Cannot unwrap error: {self.error}")

    def unwrap_err(self) -> E:
        if self.is_err():
            return self.error  # type: ignore
        raise ValueError(f"Cannot unwrap ok value: {self.value}")


@dataclass(frozen=True)
class Money:
    """Money value in paise (integer, never float)"""
    paise: int

    def __post_init__(self):
        if self.paise < 0:
            raise ValueError("Money cannot be negative")

    @property
    def rupees(self) -> float:
        return self.paise / 100.0

    @classmethod
    def from_rupees(cls, rupees: float) -> "Money":
        return cls(int(round(rupees * 100)))

    def __add__(self, other: "Money") -> "Money":
        return Money(self.paise + other.paise)

    def __sub__(self, other: "Money") -> "Money":
        return Money(max(0, self.paise - other.paise))

    def __mul__(self, factor: float) -> "Money":
        return Money(int(round(self.paise * factor)))

    def __str__(self) -> str:
        return f"₹{self.paise / 100:.2f}"


@dataclass(frozen=True)
class Qty:
    """Quantity value (numeric)"""
    value: float
    unit: str

    def __post_init__(self):
        if self.value < 0:
            raise ValueError("Quantity cannot be negative")

    def __add__(self, other: "Qty") -> "Qty":
        if self.unit != other.unit:
            raise ValueError("Cannot add quantities with different units")
        return Qty(self.value + other.value, self.unit)

    def __sub__(self, other: "Qty") -> "Qty":
        if self.unit != other.unit:
            raise ValueError("Cannot subtract quantities with different units")
        return Qty(max(0, self.value - other.value), self.unit)

    def __str__(self) -> str:
        return f"{self.value} {self.unit}"


@dataclass(frozen=True)
class Percent:
    """Percentage value (0-100)"""
    value: float

    def __post_init__(self):
        if not 0 <= self.value <= 100:
            raise ValueError("Percent must be between 0 and 100")

    @classmethod
    def from_decimal(cls, decimal: float) -> "Percent":
        return cls(decimal * 100)

    def to_decimal(self) -> float:
        return self.value / 100.0

    def __str__(self) -> str:
        return f"{self.value}%"
