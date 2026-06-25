"""System Settings API. Schema + values for the admin settings center, plus
system health, connection tests, and the audit log. Secrets are masked in
get_view(); the frontend never receives full keys."""
import time

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.services import settings as S

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SaveReq(BaseModel):
    category: str
    changes: dict


class ResetReq(BaseModel):
    category: str


@router.get("")
async def get_settings():
    return {"schema": await S.get_view()}


@router.put("")
async def save_settings(req: SaveReq, request: Request):
    ip = request.client.host if request.client else None
    return await S.set_many(req.category, req.changes, ip=ip)


@router.post("/reset")
async def reset_settings(req: ResetReq):
    return await S.reset_category(req.category)


@router.get("/audit")
async def audit(limit: int = 100):
    return {"logs": await S.audit_log(limit)}


@router.get("/health")
async def health():
    """System Health panel — subsystem status + best-effort operational metrics."""
    from app import jobq
    from app.config import ANTHROPIC_API_KEY, X_BEARER_TOKEN
    from app.services import db, notify, redis_client

    redis_ok = False
    if redis_client.enabled():
        try:
            await redis_client.set("status:ping", "1", ex=30)
            redis_ok = (await redis_client.get("status:ping")) == "1"
        except Exception:
            redis_ok = False

    services = {
        "backend": True,
        "database": db.enabled(),
        "redis": redis_ok,
        "queue": jobq.available(),
        "ai_provider": bool(ANTHROPIC_API_KEY),
        "x_api": bool(X_BEARER_TOKEN),
        "telegram": bool(notify.TELEGRAM_BOT_TOKEN),
        "rss": True,
    }

    metrics = {"last_collection": None, "failed_jobs": 0, "posts_today": None,
               "posts_month": None, "ai_calls_today": None, "x_quota_usage": None,
               "storage_usage": None, "error_rate": None}
    if db.enabled():
        try:
            rows = await db.select("job_runs", "select=created_at,status&order=created_at.desc&limit=50")
            if rows:
                metrics["last_collection"] = rows[0].get("created_at")
                metrics["failed_jobs"] = sum(1 for r in rows if r.get("status") == "failed")
        except Exception:
            pass

    return {"services": services, "metrics": metrics, "checked_at": int(time.time())}


@router.post("/test/{service}")
async def test_connection(service: str):
    """Test an external service connection; returns ok + latency_ms."""
    t0 = time.time()
    ok, detail = False, ""
    try:
        if service == "x":
            from app.services import x
            r = await x.fetch_trend("العراق", want=10, range="day")
            ok = "error" not in r
            detail = r.get("error", f"{len(r.get('tweets', []))} tweets") if isinstance(r, dict) else ""
        elif service == "ai":
            from app.config import ANTHROPIC_API_KEY, SUMMARY_MODEL
            if ANTHROPIC_API_KEY:
                import httpx
                async with httpx.AsyncClient() as c:
                    rr = await c.post("https://api.anthropic.com/v1/messages",
                                      headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                                               "content-type": "application/json"},
                                      json={"model": SUMMARY_MODEL, "max_tokens": 5,
                                            "messages": [{"role": "user", "content": "ping"}]}, timeout=20)
                    ok = rr.status_code == 200
                    detail = "200 OK" if ok else f"HTTP {rr.status_code}"
            else:
                detail = "no key"
        elif service == "redis":
            from app.services import redis_client
            if redis_client.enabled():
                await redis_client.set("test:ping", "1", ex=10)
                ok = (await redis_client.get("test:ping")) == "1"
                detail = "pong" if ok else "no reply"
            else:
                detail = "disabled"
        elif service == "database":
            from app.services import db
            ok = db.enabled()
            if ok:
                await db.select("job_runs", "select=created_at&limit=1")
            detail = "connected" if ok else "disabled"
        elif service == "telegram":
            from app.services import notify
            ok = bool(notify.TELEGRAM_BOT_TOKEN)
            detail = "token set" if ok else "no token"
        else:
            detail = "unknown service"
    except Exception as e:
        ok, detail = False, str(e)[:120]
    return {"service": service, "ok": ok, "detail": detail,
            "latency_ms": round((time.time() - t0) * 1000)}
