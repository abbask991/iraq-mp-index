"""RQ + Redis job queue.

Heavy work (source fetches, AI classification, trend/campaign math, report
generation, notifications) is enqueued here instead of blocking API requests.
When Redis is unset there is no worker, so `enqueue()` returns None and callers
fall back to running inline — the app stays functional in every environment.

The RQ worker process runs `rq worker rasd` against the same codebase (see
worker.py + render.yaml). Tasks live in app/tasks.py as importable functions.
"""
from app.config import REDIS_URL

try:
    from redis import Redis
    from rq import Queue
except Exception:                       # pragma: no cover - optional dep
    Redis = None
    Queue = None

_conn = None
_queue = None

QUEUE_NAME = "rasd"


def available() -> bool:
    return bool(REDIS_URL and Queue)


def connection():
    global _conn
    if not available():
        return None
    if _conn is None:
        _conn = Redis.from_url(REDIS_URL)
    return _conn


def queue():
    global _queue
    if not available():
        return None
    if _queue is None:
        _queue = Queue(QUEUE_NAME, connection=connection())
    return _queue


def enqueue(func_path: str, *args, job_timeout: int = 600, **kwargs):
    """Enqueue `app.tasks.<func>` by dotted path. Returns the RQ job (with .id)
    or None when no queue is configured (caller should run inline)."""
    q = queue()
    if q is None:
        return None
    try:
        return q.enqueue(func_path, *args, job_timeout=job_timeout, **kwargs)
    except Exception:
        return None
