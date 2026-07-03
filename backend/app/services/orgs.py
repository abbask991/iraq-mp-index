"""Organizations = tenants (multi-tenancy foundation).

One organization per client. Users belong to an org via `memberships`. Every
signed-in request resolves to exactly one org (JWT → user → membership → org),
so data, config, watchlists and billing are all isolated per tenant.

On a user's first login they get a personal org auto-provisioned (role=owner).
If the `organizations` table isn't applied yet, we degrade to a deterministic
SYNTHETIC org keyed on the user id so nothing breaks pre-migration.
"""
import re

from app.services import db

VALID_PLANS = ("trial", "basic", "pro", "enterprise")


def _slugify(s: str) -> str:
    s = (s or "").split("@")[0]
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "org"


def _synthetic(uid: str, email: str | None) -> dict:
    """Fallback org used when the table is missing (pre-migration) or DB is down.
    Deterministic per user so isolation still holds without persistence."""
    return {"id": f"personal-{uid}", "name": (email or "حسابي"), "slug": _slugify(email or uid),
            "plan": "trial", "branding": {}, "api_budget_usd": 0, "byok": {},
            "status": "active", "synthetic": True}


async def get_org(org_id: str) -> dict | None:
    try:
        if db.enabled() and not str(org_id).startswith("personal-"):
            rows = await db.select("organizations", f"select=*&id=eq.{org_id}&limit=1")
            if rows:
                return rows[0]
    except Exception:
        pass
    return None


async def _provision(uid: str, email: str | None) -> dict | None:
    """Create a personal org + owner membership for a brand-new user."""
    try:
        if not db.enabled():
            return None
        org = await db.insert("organizations",
                              {"name": (email or "حسابي"), "slug": _slugify(email or uid), "plan": "trial"},
                              returning=True)
        if not org or not org.get("id"):
            return None
        await db.insert("memberships",
                        {"org_id": org["id"], "user_id": uid, "email": email, "role": "owner"},
                        upsert=True, on_conflict="org_id,user_id")
        return org
    except Exception:
        return None


async def resolve_org(user: dict) -> dict:
    """The heart of tenancy: map a signed-in user to their org + role.
    Returns { org, role }. Never raises — always yields a usable org."""
    uid, email = user.get("id"), user.get("email")
    try:
        if db.enabled():
            rows = await db.select("memberships", f"select=org_id,role&user_id=eq.{uid}&limit=1")
            if rows:
                org = await get_org(rows[0]["org_id"])
                if org:
                    return {"org": org, "role": rows[0].get("role", "member")}
            # first login → give them their own tenant
            org = await _provision(uid, email)
            if org:
                return {"org": org, "role": "owner"}
    except Exception:
        pass
    return {"org": _synthetic(uid, email), "role": "owner"}


# ── admin / management ───────────────────────────────────────────────────────
async def list_orgs() -> list[dict]:
    try:
        if db.enabled():
            rows = await db.select("organizations", "select=*&order=created_at.desc&limit=500")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


async def create_org(name: str, plan: str = "trial") -> dict | None:
    plan = plan if plan in VALID_PLANS else "trial"
    try:
        if db.enabled():
            return await db.insert("organizations",
                                   {"name": name, "slug": _slugify(name), "plan": plan}, returning=True)
    except Exception:
        pass
    return None


async def add_member(org_id: str, user_id: str, email: str | None, role: str = "member") -> bool:
    role = role if role in ("owner", "admin", "member") else "member"
    try:
        if db.enabled():
            return bool(await db.insert("memberships",
                        {"org_id": org_id, "user_id": user_id, "email": email, "role": role},
                        upsert=True, on_conflict="org_id,user_id"))
    except Exception:
        pass
    return False


async def update_org(org_id: str, patch: dict) -> bool:
    allowed = {k: v for k, v in patch.items()
               if k in ("name", "plan", "branding", "api_budget_usd", "byok", "status")}
    if not allowed or str(org_id).startswith("personal-"):
        return False
    try:
        if db.enabled():
            return await db.update("organizations", f"id=eq.{org_id}", allowed)
    except Exception:
        pass
    return False
