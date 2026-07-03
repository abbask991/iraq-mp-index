"""Per-tenant metering of external data-source cost → the billing backbone.

Every call to a paid provider (Apify / Anthropic / SerpAPI / X) should pass
through `record()` with the org_id that caused it. We estimate the cost from a
price table and append a row to `usage_events`. Monthly rollups (`summary`)
become the "data cost" line on each client's invoice.

Fire-and-forget + best-effort: metering must NEVER break a real request.
"""
from app.services import db

# Rough public list prices (USD). Tune per your actual contracts.
PRICING = {
    "anthropic": {  # per 1M tokens
        "haiku_in": 0.80, "haiku_out": 4.00,
        "sonnet_in": 3.00, "sonnet_out": 15.00,
        "unit": 1_000_000,
    },
    "apify":   {"actor_run": 0.25},   # per actor run (approx; depends on compute units)
    "serpapi": {"search": 0.015},     # per search on paid plans
    "x":       {"pull": 0.20},        # per data pull (varies by tier)
}


def estimate(provider: str, operation: str, units: float) -> float:
    """Best-effort cost estimate for `units` of `operation` on `provider`."""
    try:
        p = PRICING.get(provider, {})
        if provider == "anthropic":
            rate = p.get(operation)  # operation like "haiku_in"
            return (units / p["unit"]) * rate if rate else 0.0
        return float(p.get(operation, 0.0)) * float(units)
    except Exception:
        return 0.0


async def record(org_id: str, provider: str, operation: str,
                 units: float = 1, cost_usd: float | None = None, meta: dict | None = None) -> None:
    """Append one usage event for a tenant. Never raises."""
    try:
        if not db.enabled() or not org_id:
            return
        cost = estimate(provider, operation, units) if cost_usd is None else cost_usd
        await db.insert("usage_events", {
            "org_id": str(org_id), "provider": provider, "operation": operation,
            "units": units, "cost_usd": round(cost, 6), "meta": meta or {},
        })
    except Exception:
        pass


async def summary(org_id: str, since_iso: str | None = None) -> dict:
    """Per-provider cost + total for one tenant (optionally since a timestamp)."""
    try:
        if not db.enabled() or str(org_id).startswith("personal-"):
            return {"org_id": org_id, "total_usd": 0.0, "by_provider": {}, "events": 0}
        q = f"select=provider,units,cost_usd&org_id=eq.{org_id}&limit=100000"
        if since_iso:
            q += f"&ts=gte.{since_iso}"
        rows = await db.select("usage_events", q)
        by: dict[str, dict] = {}
        total = 0.0
        for r in rows or []:
            prov = r.get("provider") or "other"
            b = by.setdefault(prov, {"cost_usd": 0.0, "units": 0.0, "calls": 0})
            b["cost_usd"] += float(r.get("cost_usd") or 0)
            b["units"] += float(r.get("units") or 0)
            b["calls"] += 1
            total += float(r.get("cost_usd") or 0)
        for b in by.values():
            b["cost_usd"] = round(b["cost_usd"], 4)
        return {"org_id": org_id, "total_usd": round(total, 4),
                "by_provider": by, "events": len(rows or [])}
    except Exception:
        return {"org_id": org_id, "total_usd": 0.0, "by_provider": {}, "events": 0}
