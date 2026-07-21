"""Organization Administration API (spec §21). Tenant-scoped: every route derives
organization_id from the signed-in user's resolved org (current_org) — a caller
can only ever read/write their OWN org's workspaces and projects. Mutations are
gated by the RBAC permission matrix and recorded in the audit log.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.common_auth import ADMIN_EMAILS, current_org
from app.services import audit, org_users, orgs, permissions, usage_limits, workspaces

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


# ── users & roles (spec §4,21) ───────────────────────────────────────────────
class UserAddReq(BaseModel):
    email: str
    role: str = "analyst"
    mode: str = "password"          # password | invite
    password: str | None = None


class UserPatchReq(BaseModel):
    role: str | None = None
    status: str | None = None       # active | suspended


class PasswordReq(BaseModel):
    password: str | None = None
    send_reset: bool = False


def _valid_role(role: str) -> str:
    return role if role in permissions.ORG_ROLES else "analyst"


def _is_platform_admin(ctx: dict) -> bool:
    return (ctx.get("user") or {}).get("email", "").lower() in ADMIN_EMAILS


async def _target_org(ctx: dict, org_id: str | None) -> tuple[str, str | None]:
    """Which org's users may the caller manage? A PLATFORM admin (allowlist) may
    target ANY org via org_id; an org admin only their OWN, and only with the
    org.manage_users permission. Returns (org_id, plan) or raises 403."""
    if org_id and _is_platform_admin(ctx):
        org = await orgs.get_org(org_id)
        return org_id, (org or {}).get("plan")
    if (not org_id) or org_id == ctx["org_id"]:
        if permissions.has_permission(ctx.get("role"), "org.manage_users"):
            return ctx["org_id"], (ctx.get("org") or {}).get("plan")
    raise HTTPException(403, "not allowed to manage this organization's users")


@router.get("/users")
async def list_users(org_id: str = "", ctx: dict = Depends(current_org)):
    org, plan = await _target_org(ctx, org_id or None)
    members = await org_users.list_members(org)
    cap = usage_limits.limit_for(plan, "users")
    return {"org_id": org, "users": members, "count": len(members), "max_users": (cap or None)}


@router.post("/users")
async def add_user(req: UserAddReq, org_id: str = "", ctx: dict = Depends(current_org)):
    org, plan = await _target_org(ctx, org_id or None)
    email = req.email.strip().lower()
    if not email:
        return {"created": False, "error": "email required"}
    if str(org).startswith("personal-"):
        return {"created": False, "error": "org not provisioned (apply 013)"}
    # enforce the package user cap
    cap = usage_limits.limit_for(plan, "users")
    if cap and await org_users.member_count(org) >= cap:
        return {"created": False, "error": "max_users_reached", "max_users": cap, "upgrade_required": True}

    role = _valid_role(req.role)
    # resolve or create the auth user
    user = await org_users.find_user_by_email(email)
    invited = False
    if not user:
        if req.mode == "invite":
            invited = await org_users.invite_user(email)
            user = await org_users.find_user_by_email(email)
            if not user:
                return {"created": bool(invited), "invited": invited,
                        "note": "دُعي بالبريد؛ يُربط بالمؤسسة عند قبوله (فعّل البريد في Supabase)"}
        else:
            if not req.password or len(req.password) < 6:
                return {"created": False, "error": "password ≥ 6 chars required"}
            user = await org_users.create_auth_user(email, req.password)
            if not user:
                return {"created": False, "error": "auth create failed (email may already exist)"}

    ok = await orgs.add_member(org, user["id"], email, role) if user else False
    if ok:
        await audit.log(org, "user.add", actor_email=(ctx.get("user") or {}).get("email"),
                        target=email, new={"role": role, "mode": req.mode})
    return {"created": bool(ok), "invited": invited, "user_id": (user or {}).get("id"), "role": role}


@router.patch("/users/{user_id}")
async def patch_user(user_id: str, req: UserPatchReq, org_id: str = "", ctx: dict = Depends(current_org)):
    org, _ = await _target_org(ctx, org_id or None)
    done = {}
    if req.role is not None:
        done["role"] = await org_users.set_role(org, user_id, _valid_role(req.role))
    if req.status is not None:
        # never lock out the owner, a platform admin, or yourself
        if req.status == "suspended":
            member = next((m for m in await org_users.list_members(org) if m.get("user_id") == user_id), None)
            self_id = (ctx.get("user") or {}).get("id")
            if user_id == self_id:
                raise HTTPException(400, "لا يمكنك إيقاف حسابك الشخصي")
            if member and member.get("role") in ("owner", "organization_owner"):
                raise HTTPException(400, "لا يمكن إيقاف مالك المؤسسة")
            if member and (member.get("email") or "").lower() in ADMIN_EMAILS:
                raise HTTPException(400, "لا يمكن إيقاف مشرف المنصّة")
        done["status"] = await org_users.set_status(org, user_id, req.status)
    await audit.log(org, "user.update", actor_email=(ctx.get("user") or {}).get("email"),
                    target=user_id, new=req.dict(exclude_none=True))
    return {"updated": any(done.values()), **done}


@router.post("/users/{user_id}/password")
async def reset_password(user_id: str, req: PasswordReq, org_id: str = "", ctx: dict = Depends(current_org)):
    org, _ = await _target_org(ctx, org_id or None)
    if req.send_reset:
        email = next((m.get("email") for m in await org_users.list_members(org)
                      if m.get("user_id") == user_id), None)
        ok = await org_users.send_reset(email) if email else False
        await audit.log(org, "user.reset_link", actor_email=(ctx.get("user") or {}).get("email"), target=user_id)
        return {"sent": ok}
    if not req.password or len(req.password) < 6:
        return {"changed": False, "error": "password ≥ 6 chars required"}
    ok = await org_users.set_password(user_id, req.password)
    await audit.log(org, "user.set_password", actor_email=(ctx.get("user") or {}).get("email"), target=user_id)
    return {"changed": ok}


@router.delete("/users/{user_id}")
async def remove_user(user_id: str, org_id: str = "", ctx: dict = Depends(current_org)):
    org, _ = await _target_org(ctx, org_id or None)
    ok = await org_users.remove_member(org, user_id)
    if ok:
        await audit.log(org, "user.remove", actor_email=(ctx.get("user") or {}).get("email"), target=user_id)
    return {"removed": ok}
