"""Unit tests for static RBAC matrix."""

from app.platform.rbac import role_allows, effective_permissions, normalize_role


def test_owner_full_access():
    assert role_allows("Owner", "documents", "void")
    assert role_allows("owner", "members", "admin")


def test_viewer_read_only():
    assert role_allows("Viewer", "documents", "view")
    assert not role_allows("Viewer", "documents", "post")
    assert not role_allows("Viewer", "payments", "create")


def test_accountant_can_post_not_admin_members():
    assert role_allows("Accountant", "accounts", "post")
    assert not role_allows("Accountant", "members", "admin")


def test_effective_permissions_shape():
    matrix = effective_permissions("Manager")
    assert "documents" in matrix
    assert "post" in matrix["documents"]


def test_normalize_role_default():
    assert normalize_role(None) == "member"
    assert normalize_role("  Admin ") == "admin"
