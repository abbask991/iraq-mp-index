"""Per-account workspaces (multi-tenancy foundation).

Each account = one workspace, keyed by the Supabase user id. A workspace owns its
own WATCHLIST (entities / Facebook pages / brands / keywords) — isolated from every
other account. Stored durably in system_settings (`workspace:<uid>`). The signed-in
user is derived from the JWT, so one account can never read another's config.
"""
from app.services import db

DEFAULT = {"entities": [], "fb_pages": [], "brands": [], "keywords": []}
_FIELDS = list(DEFAULT.keys())


def _key(uid: str) -> str:
    return f"workspace:{uid}"


async def get_watchlist(uid: str) -> dict:
    try:
        if db.enabled():
            rows = await db.select("system_settings", f"select=value_json&key=eq.{_key(uid)}&limit=1")
            if rows:
                v = (rows[0].get("value_json") or {}).get("v") or {}
                return {**DEFAULT, **{k: (v.get(k) or []) for k in _FIELDS}}
    except Exception:
        pass
    return {k: [] for k in _FIELDS}


async def set_watchlist(uid: str, data: dict) -> dict:
    clean = {k: [str(x).strip() for x in (data.get(k) or []) if str(x).strip()][:100] for k in _FIELDS}
    ok = False
    try:
        if db.enabled():
            ok = bool(await db.insert("system_settings",
                                      {"key": _key(uid), "value_json": {"v": clean}, "category": "internal"},
                                      upsert=True, on_conflict="key"))
    except Exception:
        pass
    return {"saved": ok, "watchlist": clean}
