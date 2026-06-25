"""AICE Phase 4 — spend cap. Tracks tweets fetched this month (the TwitterAPI.io
cost driver) in a Redis counter and blocks further fetching once a configurable
monthly cap is reached, so the provider balance can't be drained by runaway
refresh. Soft cap: an in-flight scan may overshoot by at most one scan.

Cost model: TwitterAPI.io = $0.15 / 1000 tweets. The cap is expressed in tweets.
"""
import time
from datetime import datetime, timezone

from app.services import redis_client, settings

COST_PER_1K = 0.15
_TTL = 40 * 86400                      # keep the monthly counter ~40 days
_cap_cache = {"v": None, "t": 0.0}     # in-process cache of the settings cap


def _month_key() -> str:
    return "aice:tweets:" + datetime.now(timezone.utc).strftime("%Y-%m")


async def cap() -> int:
    """Monthly tweet cap from settings (cached 120s). 0/absent = unlimited."""
    now = time.time()
    if _cap_cache["v"] is None or now - _cap_cache["t"] > 120:
        try:
            v = await settings.get("aice", "monthly_tweet_cap", 600000)
        except Exception:
            v = 600000
        _cap_cache["v"], _cap_cache["t"] = int(v or 0), now
    return _cap_cache["v"]


async def usage() -> int:
    try:
        return int(await redis_client.get(_month_key()) or 0)
    except Exception:
        return 0


async def add(n: int) -> int:
    if n <= 0:
        return await usage()
    return await redis_client.incrby(_month_key(), int(n), ex=_TTL)


async def allowed() -> bool:
    """False once the monthly cap is reached (cap<=0 means unlimited)."""
    c = await cap()
    if c <= 0:
        return True
    return (await usage()) < c


async def status() -> dict:
    used = await usage()
    c = await cap()
    return {
        "used": used, "cap": c,
        "remaining": max(0, c - used) if c > 0 else None,
        "pct": round(used / c * 100) if c > 0 else None,
        "est_cost_usd": round(used / 1000 * COST_PER_1K, 2),
        "cap_cost_usd": round(c / 1000 * COST_PER_1K, 2) if c > 0 else None,
        "month": datetime.now(timezone.utc).strftime("%Y-%m"),
        "capped": (c > 0 and used >= c),
    }
