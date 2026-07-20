"""Usage-event log — the missing piece that turns "قيد التتبّع" ROI/success
metrics into real counts. Per-tenant, stored in system_settings (no migration).

Events are appended best-effort (read-modify-write); on a low-traffic platform
that is accurate enough, and it never blocks the user action being logged. Every
count the ROI tracker shows from here is a real logged event — nothing invented.
"""
from datetime import datetime, timedelta, timezone

from app.services import db

CAP = 3000


def _key(owner: str) -> str:
    return f"usage_events:{owner or 'global'}"


async def load(owner: str) -> list:
    if not db.enabled():
        return []
    try:
        rows = await db.select("system_settings", f"select=value_json&key=eq.{_key(owner)}&limit=1")
        if rows and isinstance(rows[0].get("value_json"), dict):
            return rows[0]["value_json"].get("events", []) or []
    except Exception:
        pass
    return []


async def log(owner: str, event_type: str, meta: dict | None = None) -> bool:
    if not db.enabled() or not event_type:
        return False
    events = await load(owner)
    ev = {"type": event_type[:40], "at": datetime.now(timezone.utc).isoformat(), "meta": meta or {}}
    events = ([ev] + events)[:CAP]
    try:
        return bool(await db.insert("system_settings",
                                    {"key": _key(owner), "value_json": {"events": events}, "category": "internal"},
                                    upsert=True, on_conflict="key"))
    except Exception:
        return False


async def summary(owner: str, since_days: int = 30) -> dict:
    events = await load(owner)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=since_days)).isoformat() if since_days and since_days > 0 else None
    counts: dict = {}
    total = 0
    for e in events:
        if cutoff and (e.get("at") or "") < cutoff:
            continue
        t = e.get("type") or "other"
        counts[t] = counts.get(t, 0) + 1
        total += 1
    return {"counts": counts, "total": total, "since_days": since_days, "logged": len(events)}
