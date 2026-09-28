"""
Clock abstraction for time handling (testable)
"""

from datetime import datetime, timezone
from typing import Protocol


class Clock(Protocol):
    """Clock protocol for time operations"""

    def now(self) -> datetime:
        """Get current time in UTC"""
        ...

    def today(self) -> datetime:
        """Get today's date in UTC"""
        ...


class SystemClock:
    """System clock using actual time"""

    def now(self) -> datetime:
        return datetime.now(timezone.utc)

    def today(self) -> datetime:
        return self.now().replace(hour=0, minute=0, second=0, microsecond=0)


class FrozenClock:
    """Frozen clock for testing"""

    def __init__(self, frozen_time: datetime | None = None):
        self._frozen_time = frozen_time or datetime.now(timezone.utc)

    def now(self) -> datetime:
        return self._frozen_time

    def today(self) -> datetime:
        return self._frozen_time.replace(hour=0, minute=0, second=0, microsecond=0)


# Default clock (can be overridden in tests)
clock: Clock = SystemClock()
