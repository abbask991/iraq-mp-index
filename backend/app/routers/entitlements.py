"""Package Entitlements API — which features are hidden per pricing package.

Stores a HIDDEN-feature blocklist per plan in system_settings (default empty →
everything visible, so new features and existing plans never break). The frontend
sidebar filters items by the signed-in user's plan; the admin panel edits the lists.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.common_auth import require_admin
from app.services import db

router = APIRouter(prefix="/api/entitlements", tags=["entitlements"])

_PLANS = ["trial", "basic", "pro", "enterprise"]


def _key(plan: str) -> str:
    return f"entitlements.{plan}"


class SetReq(BaseModel):
    plan: str
    hidden: list[str] = []


async def _hidden(plan: str) -> list:
    try:
        if db.enabled():
            rows = await db.select("system_settings", f"select=value_json&key=eq.{_key(plan)}&limit=1")
            if rows:
                return (rows[0].get("value_json") or {}).get("hidden", []) or []
    except Exception:
        pass
    return []


@router.get("")
async def get_ent(plan: str):
    return {"plan": plan, "hidden": await _hidden(plan)}


@router.get("/all")
async def all_ent(_: dict = Depends(require_admin)):
    return {"packages": {p: await _hidden(p) for p in _PLANS}}


@router.get("/users")
async def list_users(_: dict = Depends(require_admin)):
    """Subscriber list for the admin picker (service key bypasses client RLS)."""
    try:
        if db.enabled():
            rows = await db.select("subscriptions",
                                   "select=user_id,email,plan,status&order=email&limit=1000")
            return {"users": rows if isinstance(rows, list) else []}
    except Exception:
        pass
    return {"users": []}


@router.post("")
async def set_ent(req: SetReq, _: dict = Depends(require_admin)):
    if req.plan not in _PLANS:
        return {"saved": False, "error": "unknown plan"}
    ok = False
    try:
        if db.enabled():
            ok = bool(await db.insert("system_settings",
                                      {"key": _key(req.plan), "value_json": {"hidden": req.hidden},
                                       "category": "internal"}, upsert=True, on_conflict="key"))
    except Exception:
        pass
    return {"saved": ok, "plan": req.plan, "hidden": req.hidden}


# ── per-USER overrides (take precedence over the package) ────────────────────
def _ukey(uid: str) -> str:
    return f"entitlements.user.{uid}"


class UserReq(BaseModel):
    uid: str
    hidden: list[str] = []
    clear: bool = False        # clear = revert to package entitlements


@router.get("/user")
async def get_user(uid: str):
    try:
        if db.enabled():
            rows = await db.select("system_settings", f"select=value_json&key=eq.{_ukey(uid)}&limit=1")
            if rows:
                v = rows[0].get("value_json") or {}
                if v.get("override"):
                    return {"uid": uid, "hidden": v.get("hidden", []) or [], "has_override": True}
    except Exception:
        pass
    return {"uid": uid, "hidden": [], "has_override": False}


@router.post("/user")
async def set_user(req: UserReq, _: dict = Depends(require_admin)):
    val = {"override": (not req.clear), "hidden": [] if req.clear else req.hidden}
    ok = False
    try:
        if db.enabled():
            ok = bool(await db.insert("system_settings",
                                      {"key": _ukey(req.uid), "value_json": val, "category": "internal"},
                                      upsert=True, on_conflict="key"))
    except Exception:
        pass
    return {"saved": ok, "uid": req.uid, "has_override": val["override"], "hidden": val["hidden"]}


# ── per-ORG overrides (a client's custom package — set from the Clients panel) ─
# Precedence in the app: per-user override > per-org override > plan package.
def _okey(org_id: str) -> str:
    return f"entitlements.org.{org_id}"


class OrgReq(BaseModel):
    org_id: str
    hidden: list[str] = []
    clear: bool = False        # clear = revert this org to its plan package


@router.get("/org")
async def get_org(org_id: str):
    try:
        if db.enabled():
            rows = await db.select("system_settings", f"select=value_json&key=eq.{_okey(org_id)}&limit=1")
            if rows:
                v = rows[0].get("value_json") or {}
                if v.get("override"):
                    return {"org_id": org_id, "hidden": v.get("hidden", []) or [], "has_override": True}
    except Exception:
        pass
    return {"org_id": org_id, "hidden": [], "has_override": False}


@router.post("/org")
async def set_org(req: OrgReq, _: dict = Depends(require_admin)):
    val = {"override": (not req.clear), "hidden": [] if req.clear else req.hidden}
    ok = False
    try:
        if db.enabled():
            ok = bool(await db.insert("system_settings",
                                      {"key": _okey(req.org_id), "value_json": val, "category": "internal"},
                                      upsert=True, on_conflict="key"))
    except Exception:
        pass
    return {"saved": ok, "org_id": req.org_id, "has_override": val["override"], "hidden": val["hidden"]}
