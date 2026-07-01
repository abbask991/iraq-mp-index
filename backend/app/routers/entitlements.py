"""Package Entitlements API — which features are hidden per pricing package.

Stores a HIDDEN-feature blocklist per plan in system_settings (default empty →
everything visible, so new features and existing plans never break). The frontend
sidebar filters items by the signed-in user's plan; the admin panel edits the lists.
"""
from fastapi import APIRouter
from pydantic import BaseModel

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
async def all_ent():
    return {"packages": {p: await _hidden(p) for p in _PLANS}}


@router.post("")
async def set_ent(req: SetReq):
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
