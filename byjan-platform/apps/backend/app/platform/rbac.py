"""
Static RBAC matrix by system role name.

Actions: view | create | edit | post | void | admin
Modules: documents | parties | items | accounts | payments | bank | reports | settings | members
"""

from __future__ import annotations

from typing import Dict, FrozenSet, Set

ALL_ACTIONS: FrozenSet[str] = frozenset({"view", "create", "edit", "post", "void", "admin"})
ALL_MODULES: FrozenSet[str] = frozenset({
    "documents", "parties", "items", "accounts", "payments", "bank", "reports", "settings", "members",
})

# role_name.lower() -> module -> allowed actions
ROLE_MATRIX: Dict[str, Dict[str, FrozenSet[str]]] = {
    "owner": {m: ALL_ACTIONS for m in ALL_MODULES},
    "admin": {m: ALL_ACTIONS for m in ALL_MODULES},
    "manager": {
        "documents": frozenset({"view", "create", "edit", "post", "void"}),
        "parties": frozenset({"view", "create", "edit"}),
        "items": frozenset({"view", "create", "edit"}),
        "accounts": frozenset({"view", "create", "edit"}),
        "payments": frozenset({"view", "create", "edit", "post", "void"}),
        "bank": frozenset({"view", "create", "edit"}),
        "reports": frozenset({"view"}),
        "settings": frozenset({"view"}),
        "members": frozenset({"view"}),
    },
    "accountant": {
        "documents": frozenset({"view", "create", "edit", "post"}),
        "parties": frozenset({"view", "create", "edit"}),
        "items": frozenset({"view", "create", "edit"}),
        "accounts": frozenset({"view", "create", "edit", "post"}),
        "payments": frozenset({"view", "create", "edit", "post"}),
        "bank": frozenset({"view", "edit"}),
        "reports": frozenset({"view"}),
        "settings": frozenset({"view"}),
        "members": frozenset(),
    },
    "munim": {
        "documents": frozenset({"view", "create", "edit", "post"}),
        "parties": frozenset({"view", "create", "edit"}),
        "items": frozenset({"view", "create", "edit"}),
        "accounts": frozenset({"view", "create", "edit", "post"}),
        "payments": frozenset({"view", "create", "edit", "post"}),
        "bank": frozenset({"view", "edit"}),
        "reports": frozenset({"view"}),
        "settings": frozenset({"view"}),
        "members": frozenset(),
    },
    "staff": {
        "documents": frozenset({"view", "create", "edit"}),
        "parties": frozenset({"view", "create"}),
        "items": frozenset({"view"}),
        "accounts": frozenset({"view"}),
        "payments": frozenset({"view"}),
        "bank": frozenset({"view"}),
        "reports": frozenset({"view"}),
        "settings": frozenset(),
        "members": frozenset(),
    },
    "viewer": {m: frozenset({"view"}) for m in ALL_MODULES if m != "members"},
    "member": {
        "documents": frozenset({"view", "create", "edit", "post"}),
        "parties": frozenset({"view", "create", "edit"}),
        "items": frozenset({"view", "create", "edit"}),
        "accounts": frozenset({"view"}),
        "payments": frozenset({"view", "create"}),
        "bank": frozenset({"view"}),
        "reports": frozenset({"view"}),
        "settings": frozenset({"view"}),
        "members": frozenset(),
    },
}


def normalize_role(name: str | None) -> str:
    return (name or "member").strip().lower()


def role_allows(role_name: str | None, module: str, action: str) -> bool:
    role = normalize_role(role_name)
    matrix = ROLE_MATRIX.get(role) or ROLE_MATRIX["member"]
    allowed = matrix.get(module, frozenset())
    return action in allowed


def effective_permissions(role_name: str | None) -> Dict[str, Set[str]]:
    role = normalize_role(role_name)
    matrix = ROLE_MATRIX.get(role) or ROLE_MATRIX["member"]
    return {m: set(acts) for m, acts in matrix.items()}
