"""
Firebase Admin ID-token verification.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, Dict, Optional

import structlog

from app.settings import settings

log = structlog.get_logger(__name__)

_app_ready = False


class FirebaseVerifyError(Exception):
    """Raised when a Firebase ID token cannot be verified."""


@lru_cache(maxsize=1)
def _ensure_app() -> bool:
    """Initialize firebase-admin once. Returns True if ready."""
    global _app_ready
    if _app_ready:
        return True

    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError as e:
        raise FirebaseVerifyError("firebase-admin is not installed") from e

    if firebase_admin._apps:
        _app_ready = True
        return True

    cred = None
    if settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        try:
            info = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
            cred = credentials.Certificate(info)
        except (json.JSONDecodeError, ValueError, OSError) as e:
            raise FirebaseVerifyError("invalid FIREBASE_SERVICE_ACCOUNT_JSON") from e
    elif settings.FIREBASE_SERVICE_ACCOUNT_PATH:
        try:
            cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
        except (OSError, ValueError) as e:
            raise FirebaseVerifyError(
                f"cannot load FIREBASE_SERVICE_ACCOUNT_PATH: {e}"
            ) from e
    elif settings.FIREBASE_PROJECT_ID:
        # Application Default Credentials (local gcloud / GCP)
        try:
            cred = credentials.ApplicationDefault()
        except Exception as e:
            raise FirebaseVerifyError(
                "Firebase Application Default Credentials unavailable"
            ) from e
    else:
        raise FirebaseVerifyError(
            "Firebase is not configured — set FIREBASE_PROJECT_ID and "
            "FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_SERVICE_ACCOUNT_PATH)"
        )

    opts: Dict[str, Any] = {}
    if settings.FIREBASE_PROJECT_ID:
        opts["projectId"] = settings.FIREBASE_PROJECT_ID

    try:
        firebase_admin.initialize_app(cred, opts or None)
    except Exception as e:
        raise FirebaseVerifyError(f"firebase admin init failed: {e}") from e
    _app_ready = True
    log.info("firebase_admin_initialized", project=settings.FIREBASE_PROJECT_ID)
    return True


def generate_password_reset_link(email: str, continue_url: Optional[str] = None) -> str:
    """Create a Firebase password-reset link (email is sent by Byjan, not Firebase)."""
    if not email or "@" not in email:
        raise FirebaseVerifyError("invalid email")
    _ensure_app()
    from firebase_admin import auth as fb_auth

    url = (continue_url or settings.PASSWORD_RESET_CONTINUE_URL or "https://business.easypado.com/").strip()
    try:
        settings_obj = fb_auth.ActionCodeSettings(url=url, handle_code_in_app=False)
        return fb_auth.generate_password_reset_link(email.strip(), action_code_settings=settings_obj)
    except fb_auth.UserNotFoundError as e:
        raise FirebaseVerifyError("user_not_found") from e
    except Exception as e:
        log.warning("firebase_reset_link_failed", error=str(e))
        raise FirebaseVerifyError("reset_link_failed") from e


def verify_id_token(id_token: str) -> Dict[str, Any]:
    """
    Verify a Firebase ID token and return claims.
    Keys: uid, email, name, email_verified, phone_number
    """
    if not id_token or not id_token.strip():
        raise FirebaseVerifyError("missing id_token")

    _ensure_app()
    from firebase_admin import auth as fb_auth

    try:
        decoded = fb_auth.verify_id_token(id_token.strip())
    except Exception as e:
        log.warning("firebase_verify_failed", error=str(e))
        raise FirebaseVerifyError("invalid Firebase ID token") from e

    uid = decoded.get("uid") or decoded.get("user_id") or decoded.get("sub")
    if not uid:
        raise FirebaseVerifyError("Firebase token missing uid")

    return {
        "uid": str(uid),
        "email": decoded.get("email"),
        "name": decoded.get("name"),
        "email_verified": bool(decoded.get("email_verified")),
        "phone_number": decoded.get("phone_number"),
    }


def reset_firebase_for_tests() -> None:
    """Clear cached Firebase app state (tests only)."""
    global _app_ready
    _ensure_app.cache_clear()
    _app_ready = False
    try:
        import firebase_admin
        for app in list(firebase_admin._apps.values()):
            firebase_admin.delete_app(app)
    except Exception:
        pass
