"""
Pagination utilities for cursor-based (keyset) pagination
"""

from typing import Generic, TypeVar, Optional
from pydantic import BaseModel, Field


T = TypeVar("T")


class PaginationParams(BaseModel):
    """Pagination parameters"""
    limit: int = Field(default=25, ge=1, le=100)
    cursor: Optional[str] = Field(default=None)

    @property
    def offset(self) -> int:
        """For compatibility with offset-based pagination (not recommended)"""
        # Cursor pagination doesn't use offset, but this is a fallback
        return 0


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response with cursor"""
    data: list[T]
    page: "PageInfo"
    meta: Optional[dict] = None


class PageInfo(BaseModel):
    """Page information for cursor pagination"""
    next_cursor: Optional[str] = None
    has_more: bool = False
    total: Optional[int] = None  # Only when include_total=true
