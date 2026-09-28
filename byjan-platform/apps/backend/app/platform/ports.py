"""
Platform ports - Protocol interfaces
"""

from typing import Protocol, Optional, List, Dict, Any
from app.platform.domain.models import User, Tenant, Membership, Role, Session
from app.shared.types import Result


class UserRepository(Protocol):
    """User repository port"""

    async def get_by_id(self, user_id: str) -> Optional[User]:
        ...

    async def get_by_firebase_uid(self, firebase_uid: str) -> Optional[User]:
        ...

    async def get_by_email(self, email: str) -> Optional[User]:
        ...

    async def create(self, user: User) -> User:
        ...

    async def update(self, user_id: str, updates: Dict[str, Any]) -> User:
        ...


class TenantRepository(Protocol):
    """Tenant repository port"""

    async def get_by_id(self, tenant_id: str) -> Optional[Tenant]:
        ...

    async def create(self, tenant: Tenant) -> Tenant:
        ...

    async def update(self, tenant_id: str, updates: Dict[str, Any]) -> Tenant:
        ...

    async def soft_delete(self, tenant_id: str) -> None:
        ...


class MembershipRepository(Protocol):
    """Membership repository port"""

    async def get_membership(self, tenant_id: str, user_id: str) -> Optional[Membership]:
        ...

    async def get_user_tenants(self, user_id: str) -> List[Membership]:
        ...

    async def create(self, membership: Membership) -> Membership:
        ...

    async def update(self, tenant_id: str, user_id: str, updates: Dict[str, Any]) -> Optional[Membership]:
        ...


class RoleRepository(Protocol):
    """Role repository port"""

    async def get_by_id(self, role_id: str) -> Optional[Role]:
        ...

    async def get_tenant_roles(self, tenant_id: str) -> List[Role]:
        ...

    async def create(self, role: Role) -> Role:
        ...

    async def update(self, role_id: str, updates: Dict[str, Any]) -> Optional[Role]:
        ...

    async def delete(self, role_id: str) -> None:
        ...


class SessionRepository(Protocol):
    """Session repository port"""

    async def get_by_id(self, session_id: str) -> Optional[Session]:
        ...

    async def get_by_refresh_hash(self, refresh_hash: str) -> Optional[Session]:
        ...

    async def create(self, session: Session) -> Session:
        ...

    async def update(self, session_id: str, updates: Dict[str, Any]) -> Optional[Session]:
        ...

    async def revoke(self, session_id: str) -> None:
        ...


class MessageGateway(Protocol):
    """Message gateway port for sending notifications"""

    async def send_email(self, to: str, template: str, data: Dict[str, Any]) -> Result[str, str]:
        ...

    async def send_whatsapp(self, to: str, template: str, data: Dict[str, Any]) -> Result[str, str]:
        ...

    async def send_sms(self, to: str, template: str, data: Dict[str, Any]) -> Result[str, str]:
        ...


class FileStore(Protocol):
    """File storage port"""

    async def get_upload_url(self, file_id: str, tenant_id: str, mime: str, size: int) -> str:
        ...

    async def get_download_url(self, file_id: str, expires_in: int = 60) -> str:
        ...

    async def delete_file(self, file_id: str) -> None:
        ...


class PdfRenderer(Protocol):
    """PDF renderer port"""

    async def render_pdf(self, template: str, data: Dict[str, Any], lang: str = "en") -> bytes:
        ...
