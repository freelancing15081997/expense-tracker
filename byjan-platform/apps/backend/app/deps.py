"""
Dependency injection for FastAPI
"""

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.shared.database import get_db_session
from app.shared.auth import decode_access_token, Principal
from app.errors import AuthError, TenantError


security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Principal:
    """Get current user from JWT token"""
    if credentials is None:
        raise AuthError("auth.invalid_token", "No authentication token provided")

    principal = decode_access_token(credentials.credentials)
    if principal is None:
        raise AuthError("auth.invalid_token", "Invalid or expired token")

    return principal


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[Principal]:
    """Get current user from JWT token (optional - for public routes)"""
    if credentials is None:
        return None

    principal = decode_access_token(credentials.credentials)
    return principal


async def require_tenant(
    principal: Principal = Depends(get_current_user),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db_session),
) -> tuple[Principal, str]:
    """Resolve tenant from header or JWT claim; validate membership in DB."""
    from app.platform.service import PlatformService

    tenant_id = x_tenant_id or principal.tenant_id
    if not tenant_id:
        raise TenantError("tenant.missing", "X-Tenant-Id header is required")

    if principal.tenant_id and principal.tenant_id == tenant_id:
        return principal, tenant_id

    service = PlatformService(db)
    if await service.user_is_tenant_member(principal.user_id, tenant_id):
        return principal, tenant_id

    raise TenantError("tenant.not_member", "User is not a member of this tenant")


async def require_permission(
    module: str,
    action: str,
    principal: Principal = Depends(get_current_user),
) -> Principal:
    """Require specific permission"""
    # TODO: Check RBAC matrix
    # For now, allow all
    return principal


async def require_step_up(
    principal: Principal = Depends(get_current_user),
) -> Principal:
    """Require step-up authentication (fresh MFA/OTP)"""
    # TODO: Check auth_time is within 5 minutes
    return principal


async def require_super(
    principal: Principal = Depends(get_current_user),
) -> Principal:
    """Require super-user status"""
    if not principal.is_super:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super-user access required"
        )
    return principal
