"""Response cache with stale-while-revalidate, backed by Redis when available.

Once a key has ANY value, callers get it back instantly forever — when it goes
stale we refresh in the background instead of making the caller wait. With Redis
the cache is SHARED across processes, so the RQ worker can precompute a heavy
analysis and the web process serves it in ~0.4s. Without Redis it falls back to
a per-process in-memory store and behaves exactly as before.

`get`/`put` stay synchronous (in-process L1) for light callers; `swr` is the
async, Redis-aware path used by the heavy endpoints.
"""
import asyncio
import json
import time

from app.services import redis_client as _r

_store: dict[str, tuple[float, object]] = {}   # in-process L1 + fallback
_refreshing: set[str] = set()


def get(key: str, ttl: float):
    v = _store.get(key)
    if v and (time.time() - v[0]) < ttl:
        return v[1]
    return None


def put(key: str, value) -> None:
    _store[key] = (time.time(), value)
    if len(_store) > 500:
        now = time.time()
        for k in [k for k, (t, _) in _store.items() if now - t > 3600]:
            _store.pop(k, None)


async def _read(key: str):
    """Return (ts, value) from the shared store (Redis) or L1, else None."""
    if _r.enabled():
        raw = await _r.get("swr:" + key)
        if raw:
            try:
                d = json.loads(raw)
                return d["ts"], d["v"]
            except Exception:
                pass
        return None
    v = _store.get(key)
    return (v[0], v[1]) if v else None


async def _write(key: str, value, ttl: float):
    _store[key] = (time.time(), value)              # keep L1 warm too
    if _r.enabled():
        payload = json.dumps({"ts": time.time(), "v": value}, ensure_ascii=False)
        # physical TTL >> logical TTL so stale data survives for bg refresh
        await _r.set("swr:" + key, payload, ex=int(ttl * 6) + 600)


async def swr(key: str, ttl: float, factory):
    """Stale-while-revalidate. Instant even when stale; refreshes in the
    background (single-flight across processes via a Redis lock). Only the very
    first, never-computed call blocks. `factory` is a zero-arg async callable."""
    entry = await _read(key)
    if entry is None:                                # cold — compute once
        result = await factory()
        await _write(key, result, ttl)
        return result

    ts, value = entry
    if (time.time() - ts) >= ttl and key not in _refreshing:
        # one refresher per key across the whole fleet
        if await _r.acquire_lock("swr:" + key, max(60, int(ttl))):
            _refreshing.add(key)

            async def _bg():
                try:
                    await _write(key, await factory(), ttl)
                except Exception:
                    pass
                finally:
                    _refreshing.discard(key)

            asyncio.create_task(_bg())
    return value                                     # serve stale instantly
