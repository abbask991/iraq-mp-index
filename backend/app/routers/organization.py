"""Organization Administration API (spec §21). Tenant-scoped: every route derives
organization_id from the signed-in user's resolved org (current_org) — a caller
can only ever read/write their OWN org's workspaces and projects. Mutations are
gated by the RBAC permission matrix and recorded in the audit log.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.common_auth import current_org
from app.services import audit, permissions, workspaces

router = APIRouter(prefix="/api/organization", tags=["organization"])


# ── context (spec §1,15) ─────────────────────────────────────────────────────
@router.get("/context")
async def context(ctx: dict = Depends(current_org)):
    """The resolved tenant context the org-admin UI needs: org fields + the
    caller's role and its effective permissions."""
    role = ctx.get("role")
    return {
        "org": ctx["org"],
        "org_id": ctx["org_id"],
        "role": role,
        "permissions": sorted(permissions.permissions_for(role)),
    }


# ── workspaces ───────────────────────────────────────────────────────────────
class WorkspaceReq(BaseModel):
    name: str
    workspace_type: str = ""


class WorkspacePatch(BaseModel):
    name: str | None = None
    workspace_type: str | None = None
    status: str | None = None


@router.get("/workspaces")
async def list_ws(ctx: dict = Depends(current_org)):
    return {"workspaces": await workspaces.list_workspaces(ctx["org_id"])}


@router.post("/workspaces")
async def create_ws(req: WorkspaceReq, ctx: dict = Depends(permissions.require_org_permission("workspace.create"))):
    ws = await workspaces.create_workspace(ctx["org_id"], req.name.strip(), req.workspace_type,
                                           created_by=ctx["user"].get("id"))
    if ws:
        await audit.log(ctx["org_id"], "workspace.create", actor_user_id=ctx["user"].get("id"),
                        actor_email=ctx["user"].get("email"), target=ws.get("id"), new={"name": req.name})
    return {"created": bool(ws), "workspace": ws}


@router.patch("/workspaces/{ws_id}")
async def patch_ws(ws_id: str, req: WorkspacePatch,
                   ctx: dict = Depends(permissions.require_org_permission("workspace.edit"))):
    ok = await workspaces.update_workspace(ctx["org_id"], ws_id, req.dict(exclude_none=True))
    if ok:
        await audit.log(ctx["org_id"], "workspace.update", actor_user_id=ctx["user"].get("id"),
                        actor_email=ctx["user"].get("email"), target=ws_id, new=req.dict(exclude_none=True))
    return {"updated": ok}


@router.delete("/workspaces/{ws_id}")
async def delete_ws(ws_id: str, ctx: dict = Depends(permissions.require_org_permission("workspace.delete"))):
    ok = await workspaces.delete_workspace(ctx["org_id"], ws_id)
    if ok:
        await audit.log(ctx["org_id"], "workspace.delete", actor_user_id=ctx["user"].get("id"),
                        actor_email=ctx["user"].get("email"), target=ws_id)
    return {"deleted": ok}


# ── projects ─────────────────────────────────────────────────────────────────
class ProjectReq(BaseModel):
    workspace_id: str
    name: str
    description: str = ""
    project_type: str = ""


class ProjectPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    project_type: str | None = None
    status: str | None = None
    start_date: str | None = None
    end_date: str | None = None


@router.get("/projects")
async def list_proj(workspace_id: str = "", ctx: dict = Depends(current_org)):
    return {"projects": await workspaces.list_projects(ctx["org_id"], workspace_id or None)}


@router.post("/projects")
async def create_proj(req: ProjectReq, ctx: dict = Depends(permissions.require_org_permission("project.create"))):
    p = await workspaces.create_project(ctx["org_id"], req.workspace_id, req.name.strip(),
                                        req.description, req.project_type, created_by=ctx["user"].get("id"))
    if p:
        await audit.log(ctx["org_id"], "project.create", actor_user_id=ctx["user"].get("id"),
                        actor_email=ctx["user"].get("email"), target=p.get("id"), new={"name": req.name})
    return {"created": bool(p), "project": p}


@router.patch("/projects/{project_id}")
async def patch_proj(project_id: str, req: ProjectPatch,
                     ctx: dict = Depends(permissions.require_org_permission("project.edit"))):
    ok = await workspaces.update_project(ctx["org_id"], project_id, req.dict(exclude_none=True))
    if ok:
        await audit.log(ctx["org_id"], "project.update", actor_user_id=ctx["user"].get("id"),
                        actor_email=ctx["user"].get("email"), target=project_id, new=req.dict(exclude_none=True))
    return {"updated": ok}


@router.delete("/projects/{project_id}")
async def delete_proj(project_id: str, ctx: dict = Depends(permissions.require_org_permission("project.delete"))):
    ok = await workspaces.delete_project(ctx["org_id"], project_id)
    if ok:
        await audit.log(ctx["org_id"], "project.delete", actor_user_id=ctx["user"].get("id"),
                        actor_email=ctx["user"].get("email"), target=project_id)
    return {"deleted": ok}


# ── audit (read — org-scoped) ────────────────────────────────────────────────
@router.get("/audit")
async def audit_log(ctx: dict = Depends(permissions.require_org_permission("org.audit"))):
    return {"events": await audit.recent(ctx["org_id"], limit=200)}
