"""Workspaces + projects (spec §5). Every row is scoped to organization_id and
every query filters by it — tenant isolation is enforced here, not in the UI."""
import re

from app.services import db


def _slug(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (s or "")).strip("-").lower()
    return s or "workspace"


# ── workspaces ───────────────────────────────────────────────────────────────
async def list_workspaces(org_id: str) -> list[dict]:
    try:
        if db.enabled():
            rows = await db.select("organization_workspaces",
                                   f"select=*&organization_id=eq.{org_id}&order=created_at.desc&limit=500")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


async def create_workspace(org_id: str, name: str, workspace_type: str = "", created_by: str | None = None) -> dict | None:
    try:
        if db.enabled():
            return await db.insert("organization_workspaces", {
                "organization_id": org_id, "name": name, "slug": _slug(name),
                "workspace_type": workspace_type or None, "created_by": created_by,
            }, returning=True)
    except Exception:
        pass
    return None


async def update_workspace(org_id: str, ws_id: str, patch: dict) -> bool:
    allowed = {k: v for k, v in patch.items() if k in ("name", "workspace_type", "status")}
    if not allowed:
        return False
    try:
        if db.enabled():
            # org_id in the filter → a tenant can only touch its OWN workspaces
            return await db.update("organization_workspaces",
                                   f"id=eq.{ws_id}&organization_id=eq.{org_id}", allowed)
    except Exception:
        pass
    return False


async def delete_workspace(org_id: str, ws_id: str) -> bool:
    try:
        if db.enabled():
            return await db.delete("organization_workspaces",
                                   f"id=eq.{ws_id}&organization_id=eq.{org_id}")
    except Exception:
        pass
    return False


# ── projects ─────────────────────────────────────────────────────────────────
async def list_projects(org_id: str, workspace_id: str | None = None) -> list[dict]:
    try:
        if db.enabled():
            q = f"select=*&organization_id=eq.{org_id}&order=created_at.desc&limit=1000"
            if workspace_id:
                q += f"&workspace_id=eq.{workspace_id}"
            rows = await db.select("workspace_projects", q)
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


async def create_project(org_id: str, workspace_id: str, name: str, description: str = "",
                         project_type: str = "", created_by: str | None = None) -> dict | None:
    # verify the workspace belongs to this org before nesting a project under it
    try:
        if db.enabled():
            ws = await db.select("organization_workspaces",
                                 f"select=id&id=eq.{workspace_id}&organization_id=eq.{org_id}&limit=1")
            if not ws:
                return None
            return await db.insert("workspace_projects", {
                "organization_id": org_id, "workspace_id": workspace_id, "name": name,
                "description": description or None, "project_type": project_type or None,
                "created_by": created_by,
            }, returning=True)
    except Exception:
        pass
    return None


async def update_project(org_id: str, project_id: str, patch: dict) -> bool:
    allowed = {k: v for k, v in patch.items()
               if k in ("name", "description", "project_type", "status", "start_date", "end_date")}
    if not allowed:
        return False
    try:
        if db.enabled():
            return await db.update("workspace_projects",
                                   f"id=eq.{project_id}&organization_id=eq.{org_id}", allowed)
    except Exception:
        pass
    return False


async def delete_project(org_id: str, project_id: str) -> bool:
    try:
        if db.enabled():
            return await db.delete("workspace_projects",
                                   f"id=eq.{project_id}&organization_id=eq.{org_id}")
    except Exception:
        pass
    return False
