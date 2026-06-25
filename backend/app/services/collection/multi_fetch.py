"""AICE Phase 5 — parallel multi-query national fetch.

The provider paginates ~20 tweets/page sequentially, so ONE giant query is slow
(15k ≈ 750 sequential pages ≈ 20 min). Instead we split the national landscape
into many focused sub-queries (governorates · institutions · live issues) and run
them CONCURRENTLY — each is small/fast, and asyncio.gather collapses the
wall-clock to roughly a single query's time. Results are merged + de-duplicated.

This is also the priority-tier plan: monitored entities (watchlist) are added as
their own high-priority queries.
"""
import asyncio

from app.services import x
from app.services.collection import dedup

# Focused Iraqi sub-queries (each paginates independently, in parallel).
QUERY_GROUPS = [
    "بغداد lang:ar", "البصرة lang:ar", "نينوى OR الموصل lang:ar",
    "النجف OR كربلاء lang:ar", "كركوك OR اربيل lang:ar", "ذي قار OR الناصرية lang:ar",
    "الانبار OR الرمادي lang:ar", "ديالى OR واسط OR ميسان lang:ar",
    "(السوداني OR \"الحكومة العراقية\") lang:ar",
    "(\"مجلس النواب\" OR البرلمان) العراق lang:ar",
    "\"الاطار التنسيقي\" lang:ar", "الحشد lang:ar",
    "الكهرباء العراق lang:ar", "(الرواتب OR الموازنة) العراق lang:ar",
    "النفط العراق lang:ar", "(الدينار OR الدولار) العراق lang:ar",
]

_CONCURRENCY = 8


async def national(cov: int = 8000, range: str = "day", extra_queries=None,
                   per_query_cap: int = 700):
    """Run the parallel query plan; return merged {tweets, users} in our shape."""
    queries = list(QUERY_GROUPS) + list(extra_queries or [])
    per_query = max(120, min(per_query_cap, cov // max(1, len(queries))))

    sem = asyncio.Semaphore(_CONCURRENCY)

    async def _one(q):
        async with sem:
            try:
                return await x.fetch_trend(q, want=per_query, range=range)
            except Exception:
                return {"error": "exc"}

    results = await asyncio.gather(*(_one(q) for q in queries))

    tweets, users, seen = [], {}, set()
    capped = False
    for r in results:
        if not isinstance(r, dict) or "error" in r:
            if isinstance(r, dict) and r.get("error") == "BUDGET_CAP_REACHED":
                capped = True
            continue
        for uid, u in (r.get("users") or {}).items():
            users.setdefault(uid, u)
        for t in (r.get("tweets") or []):
            fp = dedup.fingerprint(t.get("text", ""))
            if fp and fp not in seen:
                seen.add(fp)
                tweets.append(t)
    return {"tweets": tweets, "users": users, "queries": len(queries),
            "per_query": per_query, "budget_capped": capped}
