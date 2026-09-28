"""
ID generation utilities - UUIDv7 for distributed systems
"""

import uuid
from datetime import datetime, timezone


class UUIDv7:
    """UUIDv7 generator for time-ordered, sortable IDs"""

    @staticmethod
    def generate() -> str:
        """Generate a UUIDv7 string"""
        # Python 3.12+ has uuid.uuid7()
        try:
            return str(uuid.uuid7())
        except AttributeError:
            # Fallback for older Python versions
            return UUIDv7._generate_fallback()

    @staticmethod
    def _generate_fallback() -> str:
        """Fallback UUIDv7 implementation for Python < 3.12"""
        # Unix timestamp in milliseconds
        timestamp_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        # Random bytes
        random_bytes = uuid.uuid4().bytes[:10]
        # Combine
        timestamp_bytes = timestamp_ms.to_bytes(6, byteorder="big")
        version_variant_bytes = bytes([0x7F, 0x00])
        combined = timestamp_bytes + random_bytes + version_variant_bytes
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
