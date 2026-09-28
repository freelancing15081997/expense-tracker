"""
JWT authentication and authorization utilities
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import json
import structlog
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.settings import settings
from app.platform.domain.models import Principal

log = structlog.get_logger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    principal: Principal,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT access token"""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": principal.user_id,
        "sid": principal.session_id,
        "amr": principal.amr,
        "mfa": principal.mfa,
        "iat": datetime.utcnow(),
        "exp": expire,
        "jti": str(hash(principal.user_id + str(expire.timestamp()))),
        "ver": 1,
    }

    if principal.tenant_id:
        to_encode["tenant_id"] = principal.tenant_id

    if principal.role_id:
        to_encode["role_id"] = principal.role_id

    if principal.is_super:
        to_encode["sup"] = True

    if principal.view_as_role:
        to_encode["view_as_role"] = principal.view_as_role

    # TODO: Use Ed25519 keys from settings.JWT_PRIVATE_KEYS
    # For now, use HS256 for development
    secret = settings.JWT_PRIVATE_KEYS
    encoded = jwt.encode(to_encode, secret, algorithm="HS256")
    return encoded


def decode_access_token(token: str) -> Optional[Principal]:
    """Decode and validate JWT access token"""
    try:
        # TODO: Use Ed25519 keys from settings.JWT_PUBLIC_KEYS
        secret = settings.JWT_PUBLIC_KEYS
        payload = jwt.decode(token, secret, algorithms=["HS256"])

        user_id = payload.get("sub")
        if not user_id:
            return None

        principal = Principal(
            user_id=user_id,
            tenant_id=payload.get("tenant_id"),
            role_id=payload.get("role_id"),
            amr=payload.get("amr", []),
            mfa=payload.get("mfa", False),
            auth_time=datetime.fromtimestamp(payload.get("iat", 0)),
            session_id=payload.get("sid"),
            is_super=payload.get("sup", False),
            view_as_role=payload.get("view_as_role"),
        )

        return principal

    except JWTError as e:
        log.warning("jwt_decode_error", error=str(e))
        return None


def create_refresh_token() -> str:
    """Create opaque refresh token"""
    import secrets
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    """Hash refresh token for storage"""
    import hashlib
    return hashlib.sha256(token.encode()).hexdigest()


def verify_refresh_token(token: str, hashed: str) -> bool:
    """Verify refresh token against hash"""
    return hash_refresh_token(token) == hashed
