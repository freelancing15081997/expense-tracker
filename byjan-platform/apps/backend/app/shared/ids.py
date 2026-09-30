"""
ID generation utilities - UUIDv7 for distributed systems
"""

import os
import uuid
from datetime import datetime, timezone


class UUIDv7:
    """UUIDv7 generator for time-ordered, sortable IDs"""

    @staticmethod
    def generate() -> str:
        """Generate a UUIDv7 string"""
        # uuid.uuid7() exists on Python 3.13+
        try:
            return str(uuid.uuid7())
        except AttributeError:
            return UUIDv7._generate_fallback()

    @staticmethod
    def _generate_fallback() -> str:
        """RFC 9562 UUIDv7 for Python < 3.13 (exactly 16 bytes)."""
        timestamp_ms = int(datetime.now(timezone.utc).timestamp() * 1000) & 0xFFFFFFFFFFFF
        rand = bytearray(os.urandom(10))
        # version 7 in high nibble of byte 6
        rand[0] = (rand[0] & 0x0F) | 0x70
        # RFC 4122 variant in high bits of byte 8
        rand[2] = (rand[2] & 0x3F) | 0x80
        combined = timestamp_ms.to_bytes(6, byteorder="big") + bytes(rand)
        return str(uuid.UUID(bytes=combined))


class IdGen:
    """ID generator for various entity types"""

    @staticmethod
    def user_id() -> str:
        return UUIDv7.generate()

    @staticmethod
    def tenant_id() -> str:
        return UUIDv7.generate()

    @staticmethod
    def document_id() -> str:
        return UUIDv7.generate()

    @staticmethod
    def session_id() -> str:
        return UUIDv7.generate()

    @staticmethod
    def invite_id() -> str:
        return UUIDv7.generate()

    @staticmethod
    def file_id() -> str:
        return UUIDv7.generate()

    @staticmethod
    def job_id() -> str:
        return UUIDv7.generate()

    @staticmethod
    def audit_id() -> str:
        return UUIDv7.generate()

    @staticmethod
    def event_id() -> str:
        return UUIDv7.generate()
