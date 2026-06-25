"""Optional Redis layer (Upstash / Render Redis).

EVERYTHING here degrades to a local in-process fallback when REDIS_URL is unset,
so the app behaves identically with or without Redis. Redis only adds:
  - a shared response cache (web ⇄ worker see the same cached results)
  - AI-result dedup (don't re-call Claude for the same evidence)
  - rate limiting (per-token / per-IP windows)
  - background job status
  - temporary trend windows (rolling counters)
  - alert deduplication + cooldown

Async client (`redis.asyncio`) so it composes with the FastAPI/httpx async stack.
"""
import time

from app.config import REDIS_URL

try:                                    # redis is an optional dependency
    import redis.asyncio as _aioredis
except Exception:                       # pragma: no cover
    _aioredis = None

_client = None
# in-process fallback KV: key -> (expire_epoch | None, value)
_local: dict[str, tuple[float | None, str]] = {}


def enabled() -> bool:
    return bool(REDIS_URL and _aioredis)


def client():
    """Lazily build a singleton async client (or None when Redis is off)."""
    global _client
    if not enabled():
        return None
    if _client is None:
        _client = _aioredis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    return _client


# ---- local fallback helpers ----
def _local_get(key):
    v = _local.get(key)
    if not v:
        return None
    exp, val = v
    if exp is not None and time.time() > exp:
        _local.pop(key, None)
        return None
    return val


def _local_set(key, val, ex=None):
    _local[key] = (time.time() + ex if ex else None, val)
    if len(_local) > 5000:              # opportunistic cleanup
        now = time.time()
        for k in [k for k, (e, _) in _local.items() if e is not None and e < now]:
            _local.pop(k, None)


# ---- generic string KV ----
async def get(key: str):
    c = client()
    if c is None:
        return _local_get(key)
    try:
        return await c.get(key)
    except Exception:
        return _local_get(key)


async def set(key: str, val: str, ex: int | None = None):
    c = client()
    if c is None:
        return _local_set(key, val, ex)
    try:
        await c.set(key, val, ex=ex)
    except Exception:
        _local_set(key, val, ex)


async def setnx(key: str, val: str, ex: int) -> bool:
    """Atomic SET if-absent with TTL. Returns True if WE set it (lock acquired,
    dedup winner). The fallback emulates it well enough for a single process."""
    c = client()
    if c is None:
        if _local_get(key) is not None:
            return False
        _local_set(key, val, ex)
        return True
    try:
        return bool(await c.set(key, val, ex=ex, nx=True))
    except Exception:
        if _local_get(key) is not None:
            return False
        _local_set(key, val, ex)
        return True


async def incrby(key: str, n: int, ex: int | None = None) -> int:
    """Atomic increment by n; sets TTL on first write. Returns the new total.
    Falls back to a best-effort local counter when Redis is down."""
    c = client()
    if c is None:
        cur = int(_local_get(key) or 0) + n
        _local_set(key, str(cur), ex)
        return cur
    try:
        total = await c.incrby(key, n)
        if ex and total == n:
            await c.expire(key, ex)
        return int(total)
    except Exception:
        cur = int(_local_get(key) or 0) + n
        _local_set(key, str(cur), ex)
        return cur


async def delete(key: str):
    c = client()
    if c is None:
        _local.pop(key, None)
        return
    try:
        await c.delete(key)
    except Exception:
        _local.pop(key, None)


# ---- rate limiting (fixed window) ----
async def rate_limit(bucket: str, limit: int, window: int) -> tuple[int, bool]:
    """Increment a per-window counter. Returns (count, allowed)."""
    key = f"rl:{bucket}:{int(time.time() // window)}"
    c = client()
    if c is None:
        cur = int(_local_get(key) or 0) + 1
        _local_set(key, str(cur), window)
        return cur, cur <= limit
    try:
        cur = await c.incr(key)
        if cur == 1:
            await c.expire(key, window)
        return cur, cur <= limit
    except Exception:
        return 0, True                  # never block on Redis failure


# ---- single-flight refresh lock (used by the SWR cache) ----
async def acquire_lock(name: str, ttl: int) -> bool:
    return await setnx(f"lock:{name}", "1", ttl)


# ---- background job status ----
async def set_job(job_id: str, status: dict, ex: int = 86400):
    import json
    await set(f"job:{job_id}", json.dumps(status, ensure_ascii=False), ex=ex)


async def get_job(job_id: str):
    import json
    raw = await get(f"job:{job_id}")
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


# ---- temporary trend window (rolling per-minute counters) ----
async def bump_trend(target: str, by: int = 1, ttl: int = 7200):
    """Increment the current-minute bucket for a target; buckets self-expire."""
    minute = int(time.time() // 60)
    key = f"trend:{target}:{minute}"
    c = client()
    if c is None:
        _local_set(key, str(int(_local_get(key) or 0) + by), ttl)
        return
    try:
        await c.incr(key, by)
        await c.expire(key, ttl)
    except Exception:
        pass


async def trend_window(target: str, minutes: int = 60) -> list[int]:
    """Return the last `minutes` per-minute counts (oldest→newest)."""
    now = int(time.time() // 60)
    keys = [f"trend:{target}:{now - i}" for i in range(minutes - 1, -1, -1)]
    c = client()
    if c is None:
        return [int(_local_get(k) or 0) for k in keys]
    try:
        vals = await c.mget(keys)
        return [int(v or 0) for v in vals]
    except Exception:
        return [int(_local_get(k) or 0) for k in keys]


# ---- alert dedup + cooldown ----
async def alert_seen(fingerprint: str, cooldown: int) -> bool:
    """True if an identical alert fired within `cooldown` seconds (suppress it).
    First sighting records the fingerprint and returns False (deliver it)."""
    is_new = await setnx(f"alert:{fingerprint}", str(int(time.time())), cooldown)
    return not is_new
