"""Role-based access control (spec §4). Roles live on memberships.role; this
module is the single source of truth for what each role may do, checked on the
BACKEND (never trust the frontend). Platform-level admin stays gated by the
existing common_auth.require_admin allowlist.

Permission keys are dotted; a role may hold an exact key, a prefix wildcard
("org.*"), or "*" (everything).
"""
from fastapi import Depends, HTTPException

from app.common_auth import current_org

# ── organization roles (spec §4) ─────────────────────────────────────────────
ORG_ROLES = (
    "organization_owner", "organization_admin", "executive", "analyst",
    "researcher", "reviewer", "report_viewer", "read_only",
    # legacy values still stored on memberships from earlier code:
    "owner", "admin", "member",
)

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "organization_owner": {"*"},
    "organization_admin": {"org.*", "workspace.*", "project.*", "entities.*",
                           "sources.manage", "alerts.manage", "reports.*", "view"},
    "executive":     {"view", "reports.view", "reports.export"},
    "analyst":       {"view", "workspace.view", "project.create", "project.edit",
                      "entities.manage", "reports.view", "reports.export"},
    "researcher":    {"view", "workspace.view", "entities.manage",
                      "reports.view", "reports.export"},
    "reviewer":      {"view", "reports.view"},
    "report_viewer": {"view", "reports.view"},
    "read_only":     {"view"},
    # ── legacy memberships.role values → sensible mappings ──
    "owner":  {"*"},
    "admin":  {"org.*", "workspace.*", "project.*", "entities.*", "reports.*", "view"},
    "member": {"view", "reports.view", "reports.export"},
}


def permissions_for(role: str | None) -> set[str]:
    return ROLE_PERMISSIONS.get(str(role or "read_only"), {"view"})


def has_permission(role: str | None, perm: str) -> bool:
    perms = permissions_for(role)
    if "*" in perms or perm in perms:
        return True
    # prefix wildcard: "org.*" grants "org.manage_users"
    prefix = perm.split(".", 1)[0] + ".*"
    return prefix in perms


def require_org_permission(perm: str):
    """FastAPI dependency factory: 403 unless the caller's org role holds `perm`.
    Yields the tenant context so the handler still gets {user, org, org_id, role}."""
    async def _dep(ctx: dict = Depends(current_org)) -> dict:
        if not has_permission(ctx.get("role"), perm):
            raise HTTPException(403, f"role '{ctx.get('role')}' lacks permission '{perm}'")
        return ctx
    return _dep
