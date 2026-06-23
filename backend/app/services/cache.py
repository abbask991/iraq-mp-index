"""Tiny in-process TTL cache. Render free tier runs a single instance, so an
in-memory cache makes repeated identical queries (same keyword reopened, the
report page re-fetching, multiple users on a trending name) return instantly."""
import time

_store: dict[str, tuple[float, object]] = {}


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
        for k in [k for k, (t, _) in _store.items() if now - t > 900]:
            _store.pop(k, None)
