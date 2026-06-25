"""User & role management — create users, reset passwords, enable/disable, from
the Settings page. Uses the Supabase Admin API with the SERVICE key (server-side
only — never exposed to the browser). Every call is admin-gated: the caller must
send their Supabase session token and be in the admin allowlist.
"""
import os

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.config import SUPABASE_SERVICE_KEY, SUPABASE_URL

router = APIRouter(prefix="/api/users", tags=["users"])

ADMIN_EMAILS = {e.strip().lower() for e in os.getenv(
    "ADMIN_EMAILS", "admin@mpii.iq,abbaskareemsaddam@gmail.com").split(",") if e.strip()}
ROLES = ["admin", "analyst", "viewer", "client"]


def _svc_headers():
    return {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"}


async def _require_admin(authorization: str | None):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(503, "auth backend not configured")
    if not authorization:
        raise HTTPException(401, "login required")
    token = authorization.replace("Bearer ", "").strip()
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{SUPABASE_URL}/auth/v1/user",
                        headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {token}"}, timeout=15)
    if r.status_code != 200:
        raise HTTPException(401, "invalid session")
    email = (r.json().get("email") or "").lower()
    if email not in ADMIN_EMAILS:
        raise HTTPException(403, "admin only")
    return email


class CreateReq(BaseModel):
    email: str
    password: str
    role: str = "viewer"


class ResetReq(BaseModel):
    id: str
    password: str


class DisableReq(BaseModel):
    id: str
    disabled: bool = True


@router.get("")
async def list_users(authorization: str | None = Header(default=None)):
    await _require_admin(authorization)
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{SUPABASE_URL}/auth/v1/admin/users?per_page=200", headers=_svc_headers(), timeout=20)
    users = r.json().get("users", []) if r.status_code == 200 else []
    out = []
    for u in users:
        if not u.get("email"):
            continue                       # skip phone/anonymous accounts
        out.append({
            "id": u["id"], "email": u["email"],
            "role": (u.get("user_metadata") or {}).get("role", "viewer"),
            "created_at": u.get("created_at"), "last_sign_in_at": u.get("last_sign_in_at"),
            "disabled": bool(u.get("banned_until")),
            "is_admin": u["email"].lower() in ADMIN_EMAILS,
        })
    return {"users": out, "roles": ROLES}


@router.post("")
async def create_user(req: CreateReq, authorization: str | None = Header(default=None)):
    await _require_admin(authorization)
    role = req.role if req.role in ROLES else "viewer"
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{SUPABASE_URL}/auth/v1/admin/users", headers=_svc_headers(),
                         json={"email": req.email, "password": req.password, "email_confirm": True,
                               "user_metadata": {"role": role}}, timeout=20)
    if r.status_code not in (200, 201):
        raise HTTPException(400, r.json().get("msg") or r.text[:200])
    d = r.json()
    return {"created": True, "id": d.get("id"), "email": d.get("email"), "role": role}


@router.post("/reset")
async def reset_password(req: ResetReq, authorization: str | None = Header(default=None)):
    await _require_admin(authorization)
    async with httpx.AsyncClient() as c:
        r = await c.put(f"{SUPABASE_URL}/auth/v1/admin/users/{req.id}", headers=_svc_headers(),
                        json={"password": req.password, "email_confirm": True}, timeout=20)
    if r.status_code != 200:
        raise HTTPException(400, r.text[:200])
    return {"reset": True, "email": r.json().get("email")}


@router.post("/disable")
async def disable_user(req: DisableReq, authorization: str | None = Header(default=None)):
    admin_email = await _require_admin(authorization)
    # protect: never disable an admin account
    async with httpx.AsyncClient() as c:
        info = await c.get(f"{SUPABASE_URL}/auth/v1/admin/users/{req.id}", headers=_svc_headers(), timeout=15)
        if info.status_code == 200 and (info.json().get("email") or "").lower() in ADMIN_EMAILS:
            raise HTTPException(400, "cannot disable an admin account")
        r = await c.put(f"{SUPABASE_URL}/auth/v1/admin/users/{req.id}", headers=_svc_headers(),
                        json={"ban_duration": "876000h" if req.disabled else "none"}, timeout=20)
    if r.status_code != 200:
        raise HTTPException(400, r.text[:200])
    return {"disabled": req.disabled}
