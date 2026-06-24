"""Tiny in-process cache with stale-while-revalidate. Render Starter runs a
single always-on instance, so an in-memory cache makes repeated queries (same
keyword reopened, the report page re-fetching, multiple users on a trending
name) return instantly.

`swr()` is the key primitive: once a key has ANY value, callers get it back
instantly forever — when it goes stale we refresh in the background instead of
making the caller wait. Combined with the startup prewarm loop, every monitored
entity's heavy page opens in ~0.4s even though the data underneath is live."""
import asyncio
import time

_store: dict[str, tuple[float, object]] = {}
_refreshing: set[str] = set()


def get(key: str, ttl: float):
    v = _store.get(key)
    if v and (time.time() - v[0]) < ttl:
        return v[1]
    return None


def put(key: str, value) -> None:
    _store[key] = (time.time(), value)
    # opportunistic cleanup so the dict can't grow unbounded
    if len(_store) > 500:
        now = time.time()
        for k in [k for k, (t, _) in _store.items() if now - t > 3600]:
            _store.pop(k, None)


async def swr(key: str, ttl: float, factory):
    """Stale-while-revalidate. Returns the cached value instantly even when
    stale, kicking off a single background refresh; only blocks the caller when
    nothing is cached yet. `factory` is a zero-arg async callable that computes
    and returns the fresh value."""
    v = _store.get(key)
    if v is None:                       # cold — must compute and wait once
        result = await factory()
        put(key, result)
        return result
    if (time.time() - v[0]) >= ttl and key not in _refreshing:
        _refreshing.add(key)

        async def _bg():
            try:
                put(key, await factory())
            except Exception:
                pass
            finally:
                _refreshing.discard(key)

        asyncio.create_task(_bg())
    return v[1]                         # serve stale instantly
