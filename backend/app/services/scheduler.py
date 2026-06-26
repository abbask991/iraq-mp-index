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

    if await _won("warm", 14 * 60):                     # keep caches/national live (~15 min)
        from app.services import warm
        await _safe(warm.warm_all)

    if await _won("alerts", 14 * 60):                   # evaluate + push alerts (~15 min)
        from app.services import alert_engine
        await _safe(alert_engine.evaluate_and_notify)

    if await _won("digest", 175 * 60):                  # rebuild ready-made digest (~3h, cheap)
        from app.services import intel_digest
        await _safe(lambda: intel_digest.build_digest(time.time()))

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
