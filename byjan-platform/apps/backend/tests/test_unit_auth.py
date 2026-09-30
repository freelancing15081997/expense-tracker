"""
Deep unit tests for shared/auth.py:
password hashing, JWT issue/decode round-trips and tamper cases,
opaque refresh token helpers.
"""

import time
import pytest
from datetime import datetime, timedelta
from jose import jwt

from app.shared.auth import (
    hash_password, verify_password,
    create_access_token, decode_access_token,
    create_refresh_token, hash_refresh_token, verify_refresh_token,
)
from app.platform.domain.models import Principal
from app.settings import settings


def _principal(**kw) -> Principal:
    base = dict(
        user_id="u-1",
        tenant_id="t-1",
        role_id="r-1",
        amr=["pwd"],
        mfa=True,
        session_id="s-1",
        is_super=False,
        view_as_role=None,
    )
    base.update(kw)
    return Principal(**base)


class TestPasswordHashing:
    def test_hash_and_verify(self):
        h = hash_password("Sup3r$ecret")
        assert h != "Sup3r$ecret"
        assert verify_password("Sup3r$ecret", h)

    def test_wrong_password_rejected(self):
        h = hash_password("Sup3r$ecret")
        assert not verify_password("sup3r$ecret", h)
        assert not verify_password("", h)

    def test_hash_is_bcrypt(self):
        assert hash_password("x").startswith("$2")

    def test_same_password_different_salts(self):
        assert hash_password("same") != hash_password("same")


class TestAccessTokens:
    def test_round_trip_all_claims(self):
        p = _principal()
        token = create_access_token(p)
        out = decode_access_token(token)

        assert out is not None
        assert out.user_id == "u-1"
        assert out.tenant_id == "t-1"
        assert out.role_id == "r-1"
        assert out.session_id == "s-1"
        assert out.mfa is True
        assert out.amr == ["pwd"]
        assert out.is_super is False

    def test_super_claim(self):
        token = create_access_token(_principal(is_super=True))
        out = decode_access_token(token)
        assert out is not None and out.is_super is True

    def test_view_as_claim(self):
        token = create_access_token(_principal(view_as_role="auditor"))
        out = decode_access_token(token)
        assert out is not None and out.view_as_role == "auditor"

    def test_optional_claims_absent(self):
        token = create_access_token(_principal(tenant_id=None, role_id=None))
        out = decode_access_token(token)
        assert out is not None
        assert out.tenant_id is None and out.role_id is None

    def test_hs256_algorithm(self):
        token = create_access_token(_principal())
        header = jwt.get_unverified_header(token)
        assert header["alg"] == "HS256"

    def test_claims_present(self):
        token = create_access_token(_principal())
        claims = jwt.decode(
            token, settings.JWT_PUBLIC_KEYS, algorithms=["HS256"]
        )
        for key in ("sub", "sid", "amr", "mfa", "iat", "exp", "jti", "ver"):
            assert key in claims

    def test_custom_expiry(self):
        token = create_access_token(_principal(), expires_delta=timedelta(seconds=60))
        claims = jwt.decode(
            token, settings.JWT_PUBLIC_KEYS, algorithms=["HS256"]
        )
        assert claims["exp"] - claims["iat"] == 60

    def test_default_expiry_uses_settings(self):
        token = create_access_token(_principal())
        claims = jwt.decode(
            token, settings.JWT_PUBLIC_KEYS, algorithms=["HS256"]
        )
        expected = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        assert claims["exp"] - claims["iat"] == expected


class TestAccessTokenTampering:
    def test_garbage_token_rejected(self):
        assert decode_access_token("not-a-jwt") is None

    def test_empty_token_rejected(self):
        assert decode_access_token("") is None

    def test_wrong_secret_rejected(self):
        token = create_access_token(_principal())
        forged = token.rsplit(".", 1)[0] + ".AAAA"  # corrupt signature
        assert decode_access_token(forged) is None

    def test_tampered_payload_rejected(self):
        token = create_access_token(_principal())
        head, payload, sig = token.split(".")
        # forge a payload claiming super-user, keep old signature
        forged_payload = (
            jwt.get_unverified_claims(token)
        )
        forged_payload["sup"] = True
        forged = jwt.encode(
            forged_payload, "attacker-key", algorithm="HS256"
        )
        assert decode_access_token(forged) is None

    def test_expired_token_rejected(self):
        token = create_access_token(
            _principal(), expires_delta=timedelta(seconds=-10)
        )
        assert decode_access_token(token) is None

    def test_alg_none_rejected(self):
        claims = {"sub": "u-1", "exp": int(time.time()) + 3600}
        token = jwt.encode(claims, "", algorithm="HS256")
        # strip signature to simulate alg:none style token
        unsigned = token.rsplit(".", 1)[0] + "."
        assert decode_access_token(unsigned) is None

    def test_token_without_sub_rejected(self):
        token = jwt.encode(
            {"exp": int(time.time()) + 3600},
            settings.JWT_PUBLIC_KEYS,
            algorithm="HS256",
        )
        assert decode_access_token(token) is None

    def test_other_hs256_token_rejected(self):
        token = jwt.encode(
            {"sub": "u-1", "exp": int(time.time()) + 3600},
            "different-secret",
            algorithm="HS256",
        )
        assert decode_access_token(token) is None


class TestRefreshTokens:
    def test_opaque_and_urlsafe(self):
        t = create_refresh_token()
        assert len(t) >= 32
        assert all(c.isalnum() or c in "-_" for c in t)

    def test_unique(self):
        assert create_refresh_token() != create_refresh_token()

    def test_hash_deterministic(self):
        t = create_refresh_token()
        assert hash_refresh_token(t) == hash_refresh_token(t)
        assert len(hash_refresh_token(t)) == 64  # sha256 hex

    def test_hash_not_plaintext(self):
        t = create_refresh_token()
        assert t not in hash_refresh_token(t)

    def test_verify(self):
        t = create_refresh_token()
        assert verify_refresh_token(t, hash_refresh_token(t))
        assert not verify_refresh_token("other", hash_refresh_token(t))
