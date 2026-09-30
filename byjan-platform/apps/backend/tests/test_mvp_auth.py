"""MVP auth unit checks — Firebase verify failure + JWT mint/decode."""

from datetime import datetime

from app.platform.domain.models import Principal
from app.platform.infra.firebase import FirebaseVerifyError
from app.shared.auth import create_access_token, decode_access_token, create_refresh_token, hash_refresh_token


def test_jwt_roundtrip():
    principal = Principal(
        user_id="11111111-1111-7111-8111-111111111111",
        tenant_id="22222222-2222-7222-8222-222222222222",
        session_id="33333333-3333-7333-8333-333333333333",
        amr=["firebase"],
        auth_time=datetime.utcnow(),
    )
    token = create_access_token(principal)
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded.user_id == principal.user_id
    assert decoded.tenant_id == principal.tenant_id
    assert decoded.session_id == principal.session_id


def test_refresh_hash_roundtrip():
    plain = create_refresh_token()
    hashed = hash_refresh_token(plain)
    assert hash_refresh_token(plain) == hashed
    assert hash_refresh_token(plain + "x") != hashed


def test_firebase_verify_error_is_distinct():
    err = FirebaseVerifyError("bad")
    assert str(err) == "bad"
