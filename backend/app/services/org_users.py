"""Organization user management (spec §4,21) via the Supabase Auth Admin API.
The service key lets us create/invite/ban users and set passwords; the app-side
`memberships` table binds a user to an org with a role + status. Every function
is org-scoped by the caller (enforced in the router) so an admin only ever
touches their OWN org's users.
"""
import httpx

from app.config import SUPABASE_SERVICE_KEY, SUPABASE_URL
from app.services import db, orgs

BAN_FOREVER = "876000h"   # ~100 years → effectively permanent


def _admin_h() -> dict:
    return {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"}


def enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)


# ── Supabase Auth admin ──────────────────────────────────────────────────────
async def create_auth_user(email: str, password: str) -> dict | None:
    """Create a confirmed user with a password. Returns {id,email} or None."""
    if not enabled():
        return None
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post(f"{SUPABASE_URL}/auth/v1/admin/users", headers=_admin_h(),
                             json={"email": email, "password": password, "email_confirm": True}, timeout=20)
            if r.status_code in (200, 201):
                d = r.json()
                return {"id": d.get("id"), "email": d.get("email")}
    except Exception:
        pass
    return None


async def invite_user(email: str) -> bool:
    """Send a Supabase invite email; the user sets their own password via link.
    Needs email/SMTP configured in the Supabase project."""
    if not enabled():
        return False
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post(f"{SUPABASE_URL}/auth/v1/invite", headers=_admin_h(),
                             json={"email": email}, timeout=20)
            return r.status_code in (200, 201)
    except Exception:
        return False


async def find_user_by_email(email: str) -> dict | None:
    if not enabled():
        return None
    try:
        async with httpx.AsyncClient() as c:
            r = await c.get(f"{SUPABASE_URL}/auth/v1/admin/users?email={email}", headers=_admin_h(), timeout=20)
            if r.status_code == 200:
                users = (r.json() or {}).get("users") or []
                for u in users:
                    if (u.get("email") or "").lower() == email.lower():
                        return {"id": u.get("id"), "email": u.get("email")}
    except Exception:
        pass
    return None


async def set_password(user_id: str, password: str) -> bool:
    return await _admin_update(user_id, {"password": password})


async def set_ban(user_id: str, banned: bool) -> bool:
    return await _admin_update(user_id, {"ban_duration": BAN_FOREVER if banned else "none"})


async def send_reset(email: str) -> bool:
    if not enabled():
        return False
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post(f"{SUPABASE_URL}/auth/v1/recover", headers=_admin_h(),
                             json={"email": email}, timeout=20)
            return r.status_code in (200, 201)
    except Exception:
        return False


async def _admin_update(user_id: str, patch: dict) -> bool:
    if not enabled() or not user_id:
        return False
    try:
        async with httpx.AsyncClient() as c:
            r = await c.put(f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}", headers=_admin_h(),
                            json=patch, timeout=20)
            return r.status_code in (200, 201)
    except Exception:
        return False


# ── memberships (app-side org binding) ───────────────────────────────────────
async def list_members(org_id: str) -> list[dict]:
    try:
        if db.enabled() and org_id and not str(org_id).startswith("personal-"):
            rows = await db.select("memberships",
                                   f"select=user_id,email,role,status,created_at&org_id=eq.{org_id}&order=created_at&limit=500")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


async def member_count(org_id: str) -> int:
    return len(await list_members(org_id))


async def set_role(org_id: str, user_id: str, role: str) -> bool:
    try:
        if db.enabled():
            return await db.update("memberships", f"org_id=eq.{org_id}&user_id=eq.{user_id}", {"role": role})
    except Exception:
        pass
    return False


async def set_status(org_id: str, user_id: str, status: str) -> bool:
    ok = False
    try:
        if db.enabled():
            ok = await db.update("memberships", f"org_id=eq.{org_id}&user_id=eq.{user_id}", {"status": status})
    except Exception:
        ok = False
    # actually block/allow login at the auth layer
    await set_ban(user_id, status == "suspended")
    return ok


async def remove_member(org_id: str, user_id: str) -> bool:
    """Detach from the org (keeps the auth account — they may belong elsewhere)."""
    try:
        if db.enabled():
            return await db.delete("memberships", f"org_id=eq.{org_id}&user_id=eq.{user_id}")
    except Exception:
        pass
    return False
