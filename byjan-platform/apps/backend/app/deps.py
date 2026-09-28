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
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
) -> tuple[Principal, str]:
    """Require tenant header and validate membership"""
    if principal.tenant_id != x_tenant_id:
        raise TenantError("tenant.not_member", "User is not a member of this tenant")

    # TODO: Validate membership in database
    return principal, x_tenant_id


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
