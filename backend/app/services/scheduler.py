"""Internal scheduler — keeps the platform live WITHOUT external pingers.

A single asyncio loop wakes every 60s and fires due jobs. Each job is guarded by
a short Redis lock (setnx) so only ONE instance runs it even when the web and
worker processes both schedule. X-API spend stays bounded by the AICE budget cap
(warm only rebuilds the national overview when its SWR key is stale).

Disable with env SCHEDULER_ENABLED=0. Brief send hour: env BRIEF_HOUR (Baghdad,
default 7).
"""
import asyncio
import os
import time
from datetime import datetime, timedelta, timezone

from app.services import redis_client

_BAGHDAD = timezone(timedelta(hours=3))


async def _won(name: str, ttl: int) -> bool:
    """True if this instance claims the slot (nobody else ran it within ttl).
    Without Redis there's a single instance, so always run."""
    try:
        if redis_client.enabled():
            return await redis_client.setnx(f"sched:{name}", "1", ttl)
    except Exception:
        pass
    return True


async def _safe(coro_factory):
    try:
        await coro_factory()
    except Exception:
        pass


async def _tick():
    now = datetime.now(_BAGHDAD)

    # CHEAP jobs only (no X fetch) — alerts/digest read stored data + Redis.
    if await _won("alerts", 28 * 60):                   # evaluate + push alerts (~30 min)
        from app.services import alert_engine, db
        # per tenant: an alert is derived from a tenant's digest and lands in
        # that tenant's feed
        for _o in await db.monitor_owners():
            await _safe(lambda o=_o: alert_engine.evaluate_and_notify(owner=o))

    if await _won("digest", 350 * 60):                  # rebuild ready-made digest (~6h, no fetch)
        from app.services import db, intel_digest
        # One digest PER TENANT: the digest derives from a watchlist, and watchlists
        # are per-owner. A single global build is what let one account's dashboard
        # render another's entities. Cheap — stored data + rule engines, no AI/fetch.
        for _owner in await db.monitor_owners():
            await _safe(lambda o=_owner: intel_digest.build_digest(time.time(), owner=o))
        # The un-scoped build is gone: every consumer is owner-scoped now.

    # EXPENSIVE warm (15k national X fetch) runs at most ONCE/day, before the
    # brief — NOT every 15 min (that drained the X budget). Pages otherwise warm
    # on-demand via SWR when actually viewed, and the AICE cap is the hard backstop.
    warm_hour = int(os.getenv("WARM_HOUR", "6"))
    if now.hour == warm_hour and await _won(f"warm:{now:%Y-%m-%d}", 23 * 3600):
        from app.services import warm
        await _safe(warm.warm_all)

    brief_hour = int(os.getenv("BRIEF_HOUR", "7"))
    if now.hour == brief_hour:                          # daily brief, once per calendar day
        if await _won(f"brief:{now:%Y-%m-%d}", 23 * 3600):
            from app.services import brief
            await _safe(brief.send_brief)


async def run():
    if os.getenv("SCHEDULER_ENABLED", "1") != "1":
        return
    await asyncio.sleep(30)                             # let the server settle first
    while True:
        await _safe(_tick)
        await asyncio.sleep(60)
