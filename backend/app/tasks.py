"""Background tasks executed by the RQ worker.

Each task is a plain importable function (RQ requirement). The heavy lifting
lives in the service layer; these wrappers just (1) bridge sync↔async, (2) record
job status to Redis + the job_runs table, and (3) keep a single definition of
"the heavy job" so both the API and the scheduler enqueue the same code.

Run inline anywhere by calling the function directly; enqueue via
jobq.enqueue("app.tasks.<name>", ...).
"""
import asyncio
import time


def _run(coro):
    """Execute an async coroutine from a sync RQ worker context."""
    return asyncio.run(coro)


async def _record(job_id, status, **extra):
    from app.services import redis_client
    payload = {"id": job_id, "status": status, "ts": int(time.time()), **extra}
    await redis_client.set_job(job_id, payload)
    try:
        from app.services import db
        if db.enabled():
            await db.insert_job_run(payload)
    except Exception:
        pass
    return payload


# ---- collection / analysis ----
def fetch_sources(keywords, rng="day"):
    """Fetch news + X for keywords, classified. Populates the shared cache."""
    from app.routers import monitor as m

    async def _go():
        nr, xr = await asyncio.gather(
            m.monitor_news(m.KeywordReq(keywords=keywords, range=rng)),
            m.monitor_x(m.KeywordReq(keywords=keywords, range=rng)),
        )
        return {"news": nr.get("count", 0), "x": xr.get("count", 0)}

    return _run(_go())


def classify(texts):
    from app.services import ai
    return _run(ai.classify_all(texts))


def compute_trends(keyword, rng="week"):
    from app.routers import monitor as m
    return _run(m.monitor_trends(m.KeywordReq(keywords=[keyword], range=rng)))


def detect_campaign(keyword, rng="week"):
    from app.routers import monitor as m
    return _run(m.monitor_campaign(m.KeywordReq(keywords=[keyword], range=rng)))


def generate_report(kind, target, rng="week", fmt="pdf", job_id=None):
    """Render a server-side report (pdf|docx|pptx) and return its bytes ref."""
    from app.services import reports

    async def _go():
        if job_id:
            await _record(job_id, "running", kind=kind, target=target, format=fmt)
        out = await reports.build(kind, target, rng, fmt)
        if job_id:
            await _record(job_id, "done", kind=kind, target=target,
                          format=fmt, bytes=out.get("bytes"))
        return out

    return _run(_go())


def send_notification(sub, message, severity="info"):
    from app.services import notify
    return _run(notify.deliver_alert(sub, message, severity))


def run_snapshot(limit=12):
    """Scheduled collection + alerting for every monitor (the cron's heavy part)."""
    from app.routers import monitor as m
    from app.config import CRON_SECRET
    return _run(m.cron_snapshot(secret=CRON_SECRET, limit=limit))
