"""AICE Phase 1 — collector run history. Best-effort insert into collector_runs;
no-op if the DB/table is absent so collection never blocks on logging."""
import time

from app.services import db


async def record(kind: str, stats: dict, *, started: float, errors=None, meta=None):
    duration = round(time.time() - started)
    row = {
        "kind": kind,
        "duration_seconds": duration,
        "fetched_count": stats.get("fetched", 0),
        "inserted_count": stats.get("inserted", stats.get("fetched", 0)),
        "duplicate_count": stats.get("duplicates", 0),
        "cluster_count": stats.get("clusters", 0),
        "representative_count": stats.get("representatives", 0),
        "ai_calls_saved": stats.get("ai_calls_saved", 0),
        "x_quota_used": stats.get("fetched", 0),     # posts fetched ≈ quota consumed
        "errors": errors or [],
        "meta": meta or {"clustered": stats.get("clustered", False)},
    }
    if not db.enabled():
        return row
    try:
        await db.insert("collector_runs", row)
    except Exception:
        pass
    return row


async def recent(limit: int = 50):
    if not db.enabled():
        return []
    try:
        return await db.select(
            "collector_runs",
            "select=kind,started_at,duration_seconds,fetched_count,inserted_count,"
            "duplicate_count,cluster_count,representative_count,ai_calls_saved,x_quota_used,errors"
            f"&order=created_at.desc&limit={limit}") or []
    except Exception:
        return []
