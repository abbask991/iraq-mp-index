"""Cache warming — proactively (re)build the heavy SWR caches so users open pages
instantly instead of waiting on a cold live+AI build. Cheap by design: hitting a
fresh SWR key just returns the cache; real work happens only when a key is stale,
so warming frequently is bounded by each page's TTL.

Warms the high-traffic landing pages (Chief dashboard, narratives, influencer
radar) + the national overview. Runs on startup (fire-and-forget) and via the
/monitor/cron/warm endpoint (point a free pinger at it every ~15 min)."""
import os

from app.services import cache


async def _warm_key(key, ttl, factory, name, out):
    try:
        await cache.swr(key, ttl, factory)
        out[name] = "ok"
    except Exception as e:
        out[name] = str(e)[:80]


async def warm_all() -> dict:
    out: dict = {}

    from app.services import chief_ai
    from app.services import influencers as inf
    from app.services import narratives as nar
    await _warm_key("chief:dashboard", 1800, lambda: chief_ai.build_dashboard(), "chief", out)
    await _warm_key("nar:dash:day", 3600, lambda: nar.build_dashboard(rng="day"), "narratives", out)
    await _warm_key("inf:radar:day:5000", 3600,
                    lambda: inf.scan(rng="day", min_followers=5000), "influencers", out)

    # national overview — its _build is a router closure, so warm it via a
    # localhost call (async self-request; the event loop services it concurrently)
    try:
        import httpx
        port = os.getenv("PORT", "10000")
        async with httpx.AsyncClient() as c:
            r = await c.post(f"http://127.0.0.1:{port}/monitor/overview",
                             json={"range": "day", "limit": 15000}, timeout=240)
            out["overview"] = "ok" if r.status_code == 200 else f"http {r.status_code}"
    except Exception as e:
        out["overview"] = str(e)[:80]

    return out
