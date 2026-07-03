"""Shared auth dependencies — verify the Supabase session JWT on protected routes.

`current_user` requires any logged-in user; `require_admin` additionally checks the
email against ADMIN_EMAILS. Use as FastAPI `Depends(...)` on mutation/control routes.
"""
import os

import httpx
from fastapi import Header, HTTPException

from app.config import SUPABASE_SERVICE_KEY, SUPABASE_URL

ADMIN_EMAILS = {e.strip().lower() for e in os.getenv(
    "ADMIN_EMAILS", "admin@mpii.iq,abbaskareemsaddam@gmail.com").split(",") if e.strip()}


async def _verify(authorization: str | None) -> dict:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(503, "auth backend not configured")
    if not authorization:
        raise HTTPException(401, "login required")
    token = authorization.replace("Bearer ", "").strip()
    try:
        async with httpx.AsyncClient() as c:
            r = await c.get(f"{SUPABASE_URL}/auth/v1/user",
                            headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {token}"}, timeout=15)
    except Exception:
        raise HTTPException(503, "auth check failed")
    if r.status_code != 200:
        raise HTTPException(401, "invalid session")
    u = r.json()
    return {"id": u.get("id"), "email": (u.get("email") or "").lower()}


async def current_user(authorization: str | None = Header(None)) -> dict:
    return await _verify(authorization)


async def require_admin(authorization: str | None = Header(None)) -> dict:
    u = await _verify(authorization)
    if u["email"] not in ADMIN_EMAILS:
        raise HTTPException(403, "admin only")
    return u


async def current_org(authorization: str | None = Header(None)) -> dict:
    """Tenant-scoped identity: the signed-in user PLUS their resolved org + role.
    Use on any route whose data/config/billing must be isolated per client.
    Returns { user, org, org_id, role }."""
    from app.services import orgs
    u = await _verify(authorization)
    r = await orgs.resolve_org(u)
    return {"user": u, "org": r["org"], "org_id": r["org"]["id"], "role": r["role"]}
