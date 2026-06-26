"""PPOI Opinion Drift — track how opinion moves over time. Each PPOI build stores
a snapshot; drift compares the latest against earlier ones (≈24h / ≈7d) to surface
sudden shifts, slow erosion, recovery, or polarization. Best-effort (needs
opinion_snapshots, migration 010); degrades to 'no history yet'.
"""
from app.services import db


async def store_snapshot(target: str, o: dict):
    if not db.enabled():
        return
    try:
        await db.insert("opinion_snapshots", {
            "target": target,
            "poi": o.get("public_opinion_index"),
            "pressure": o.get("public_pressure_index"),
            "support_pct": o.get("support_percent"),
            "oppose_pct": o.get("oppose_percent"),
            "confidence": o.get("confidence_score"),
        })
    except Exception:
        pass


def _delta(series, key, hours_back):
    """series newest-first with created_at; find the closest snapshot ~hours_back old."""
    if len(series) < 2:
        return None
    latest = series[0].get(key)
    if latest is None:
        return None
    import datetime as _dt
    try:
        now = _dt.datetime.fromisoformat(series[0]["created_at"].replace("Z", "+00:00"))
    except Exception:
        return None
    target_t = now - _dt.timedelta(hours=hours_back)
    best, bestdiff = None, None
    for s in series[1:]:
        try:
            t = _dt.datetime.fromisoformat(s["created_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        diff = abs((t - target_t).total_seconds())
        if bestdiff is None or diff < bestdiff:
            best, bestdiff = s, diff
    if best is None or best.get(key) is None:
        return None
    return round(latest - best[key], 1)


async def compute(target: str) -> dict:
    if not db.enabled():
        return {"available": False, "reason": "no_history"}
    try:
        rows = await db.select(
            "opinion_snapshots",
            f"select=poi,pressure,support_pct,oppose_pct,confidence,created_at"
            f"&target=eq.{target}&order=created_at.desc&limit=120")
    except Exception:
        rows = []
    if not rows or len(rows) < 2:
        return {"available": False, "reason": "insufficient_history", "snapshots": len(rows or [])}

    d24 = _delta(rows, "oppose_pct", 24)
    d7 = _delta(rows, "oppose_pct", 24 * 7)
    poi24 = _delta(rows, "poi", 24)
    # classify the movement
    shift = "stable"
    if d24 is not None and abs(d24) >= 10:
        shift = "sudden_shift"
    elif d7 is not None and abs(d7) >= 8:
        shift = "slow_erosion" if d7 > 0 else "recovery"
    label = {"sudden_shift": "تحوّل مفاجئ", "slow_erosion": "تآكل بطيء",
             "recovery": "تعافٍ", "stable": "مستقر"}[shift]
    return {
        "available": True, "snapshots": len(rows),
        "oppose_change_24h": d24, "oppose_change_7d": d7, "poi_change_24h": poi24,
        "shift": shift, "label": label,
        "timeline": [{"poi": r["poi"], "pressure": r["pressure"], "oppose": r["oppose_pct"],
                      "t": r["created_at"]} for r in rows[:30]][::-1],
        "explain": "تتبّع تغيّر الرأي عبر الزمن من اللقطات المخزّنة.",
    }
