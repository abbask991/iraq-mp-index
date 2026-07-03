"""Per-TENANT workspaces (multi-tenancy).

Each organization owns ONE watchlist (entities / Facebook pages / brands /
keywords) — isolated from every other tenant. Keyed by org id in system_settings
(`workspace:org:<org_id>`). All members of a client share it; the org is derived
from the JWT, so one tenant can never read another's config.

Legacy per-user watchlists (`workspace:<uid>`) are read once as a fallback so
early single-user data isn't lost after the move to org scoping.
"""
from app.services import db

DEFAULT = {"entities": [], "fb_pages": [], "brands": [], "keywords": []}
_FIELDS = list(DEFAULT.keys())


def _key(org_id: str) -> str:
    return f"workspace:org:{org_id}"


def _legacy_key(uid: str) -> str:
    return f"workspace:{uid}"


async def _read(key: str) -> dict | None:
    try:
        if db.enabled():
            rows = await db.select("system_settings", f"select=value_json&key=eq.{key}&limit=1")
            if rows:
                return (rows[0].get("value_json") or {}).get("v") or {}
    except Exception:
        pass
    return None


async def get_watchlist(org_id: str, legacy_uid: str | None = None) -> dict:
    v = await _read(_key(org_id))
    if v is None and legacy_uid:
        v = await _read(_legacy_key(legacy_uid))   # one-time fallback to old per-user data
    v = v or {}
    return {**DEFAULT, **{k: (v.get(k) or []) for k in _FIELDS}}


async def set_watchlist(org_id: str, data: dict) -> dict:
    clean = {k: [str(x).strip() for x in (data.get(k) or []) if str(x).strip()][:100] for k in _FIELDS}
    ok = False
    try:
        if db.enabled():
            ok = bool(await db.insert("system_settings",
                                      {"key": _key(org_id), "value_json": {"v": clean}, "category": "internal"},
                                      upsert=True, on_conflict="key"))
    except Exception:
        pass
    return {"saved": ok, "watchlist": clean}
