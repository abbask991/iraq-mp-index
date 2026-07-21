"""UsageLimitService (spec §19). Centralized per-org, per-billing-period usage
counters checked before expensive operations. Enforcement levels: ok → soft
(warn) → hard (stop). Counters live in organization_usage; caps come from the
package (code defaults until Platform-Admin persists them).
"""
from app.services import db

# Per-plan caps (code defaults; Platform-Admin will persist to `packages`).
# 0 / None = unlimited.
PACKAGE_LIMITS: dict[str, dict] = {
    "trial":      {"records": 5_000,   "ai_calls": 200,    "reports": 20,   "exports": 20,   "users": 3,   "workspaces": 2,  "sources": 3},
    "basic":      {"records": 50_000,  "ai_calls": 2_000,  "reports": 200,  "exports": 200,  "users": 10,  "workspaces": 5,  "sources": 5},
    "pro":        {"records": 500_000, "ai_calls": 20_000, "reports": 2_000,"exports": 2_000,"users": 50,  "workspaces": 20, "sources": 8},
    "enterprise": {"records": 0,       "ai_calls": 0,      "reports": 0,    "exports": 0,    "users": 0,   "workspaces": 0,  "sources": 0},
}

SOFT_THRESHOLD = 0.8   # warn at 80% of cap


def _period(now_month: str | None = None) -> str:
    # caller passes the period (Date is unavailable in some sandboxes); the API
    # layer supplies it. Falls back to a stable placeholder only if omitted.
    return now_month or "current"


def limit_for(plan: str | None, metric: str) -> int:
    return int((PACKAGE_LIMITS.get(plan or "trial", PACKAGE_LIMITS["trial"]).get(metric)) or 0)


async def get_usage(org_id: str, period: str) -> dict:
    out: dict[str, float] = {}
    try:
        if db.enabled() and org_id:
            rows = await db.select("organization_usage",
                                   f"select=metric,value&organization_id=eq.{org_id}&period=eq.{period}&limit=200")
            for r in rows or []:
                out[r.get("metric")] = float(r.get("value") or 0)
    except Exception:
        pass
    return out


async def check_limit(org_id: str, plan: str | None, metric: str, period: str, want: float = 1) -> dict:
    """Would consuming `want` more of `metric` exceed the plan cap this period?"""
    cap = limit_for(plan, metric)
    used = (await get_usage(org_id, period)).get(metric, 0)
    if cap <= 0:  # unlimited
        return {"allowed": True, "status": "ok", "limit": None, "current": used, "upgrade_required": False}
    projected = used + want
    ratio = projected / cap
    status = "hard" if projected > cap else ("soft" if ratio >= SOFT_THRESHOLD else "ok")
    return {"allowed": status != "hard", "status": status, "limit": cap, "current": used,
            "projected": projected, "upgrade_required": status == "hard"}


async def record_usage(org_id: str, metric: str, period: str, amount: float = 1) -> bool:
    """Increment a counter. Read-modify-write upsert (adequate at current scale;
    swap for an atomic RPC if contention ever matters)."""
    try:
        if not (db.enabled() and org_id):
            return False
        cur = (await get_usage(org_id, period)).get(metric, 0)
        return bool(await db.insert("organization_usage",
                                    {"organization_id": org_id, "period": period,
                                     "metric": metric, "value": cur + amount},
                                    upsert=True, on_conflict="organization_id,period,metric"))
    except Exception:
        return False


async def summary(org_id: str, plan: str | None, period: str) -> dict:
    """All metrics with their caps + status — for the org-admin usage view."""
    used = await get_usage(org_id, period)
    metrics = set(used) | set(PACKAGE_LIMITS.get(plan or "trial", {}))
    out = {}
    for m in sorted(metrics):
        cap = limit_for(plan, m)
        u = used.get(m, 0)
        ratio = (u / cap) if cap else 0
        out[m] = {"used": u, "limit": (cap or None),
                  "status": "hard" if cap and u > cap else ("soft" if cap and ratio >= SOFT_THRESHOLD else "ok")}
    return {"period": period, "plan": plan, "metrics": out}
