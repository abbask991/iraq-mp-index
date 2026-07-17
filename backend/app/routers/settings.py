"""System Settings API. Schema + values for the admin settings center, plus
system health, connection tests, and the audit log. Secrets are masked in
get_view(); the frontend never receives full keys."""
import os
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


@router.get("/collector")
async def collector(limit: int = 30):
    """AICE Collection Center — recent collector runs + aggregate AI savings +
    monthly spend-cap status."""
    from app.services.collection import budget, runlog
    runs = await runlog.recent(limit)
    agg = {"runs": len(runs),
           "fetched": sum(r.get("fetched_count", 0) for r in runs),
           "ai_calls_saved": sum(r.get("ai_calls_saved", 0) for r in runs),
           "duplicates": sum(r.get("duplicate_count", 0) for r in runs),
           "clusters": sum(r.get("cluster_count", 0) for r in runs)}
    return {"runs": runs, "totals": agg, "budget": await budget.status()}


@router.get("/usage")
async def usage_dashboard():
    """Spend & usage dashboard — total, by-category breakdown, 14-day series,
    and the automatic-refresh frequencies (X-fetch cost drivers)."""
    from app.services.collection import budget
    b = await budget.status()
    return {
        "budget": b,
        "categories": await budget.categories(),
        "daily": await budget.daily(14),
        "frequencies": [
            {"job": "المسح الوطني (تسخين تلقائي)", "every": "مرّة باليوم", "fetches_x": True, "tweets": 15000},
            {"job": "عند نشر تحديث (إعادة تشغيل السيرفر)", "every": "عند كل deploy", "fetches_x": True, "tweets": 15000},
            {"job": "التنبيهات", "every": "كل ٣٠ دقيقة", "fetches_x": False, "tweets": 0},
            {"job": "تحديث الديجست", "every": "كل ٦ ساعات", "fetches_x": False, "tweets": 0},
            {"job": "التقرير اليومي", "every": "مرّة باليوم", "fetches_x": False, "tweets": 0},
            {"job": "غرفة الحرب (تحديث تلقائي)", "every": "كل ٤٥ ثانية وهي مفتوحة", "fetches_x": False, "tweets": 0},
        ],
        "note": "X يُجلب فقط عند فتح تحليل جديد لهدف برد كاشه، أو التسخين التلقائي مرّة باليوم.",
    }


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

    from app.services.providers import twitterapi_io
    # `bool(KEY)` only proves a string is set in the environment. It does NOT prove
    # the provider works: an Anthropic key with no credit, an expired X token, and a
    # topped-up Apify account all report the same green. That is how collection sat
    # stopped for three weeks behind an emergency switch while this panel showed
    # every subsystem healthy. Configured and working are different facts — report
    # both, and never let "configured" render as "up".
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
    data_provider = "twitterapi_io" if twitterapi_io.enabled() else "official_x"

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

    # What is actually stopping data from arriving, named plainly. A kill switch or
    # a stale collector is invisible in `services` above, yet it is the whole answer
    # to "why is my dashboard empty".
    blockers = []
    try:
        from app.services import cost_center
        ctl = await cost_center.get_controls()
        if ctl.get("emergency_stop"):
            blockers.append({"key": "emergency_stop", "severity": "crit",
                             "label": "الإيقاف الطارئ مفعّل — كل الجمع متوقف",
                             "fix": "مركز التكلفة ← أطفئ «إيقاف طارئ لكل الجمع»"})
        if ctl.get("pause_facebook"):
            blockers.append({"key": "pause_facebook", "severity": "crit",
                             "label": "رصد فيسبوك موقوف",
                             "fix": "مركز التكلفة ← أطفئ «إيقاف رصد فيسبوك»"})
        if int(ctl.get("daily_cap") or 0) > 0:
            blockers.append({"key": "daily_cap", "severity": "warn",
                             "label": f"سقف يومي مفعّل ({ctl['daily_cap']})",
                             "fix": "مركز التكلفة ← راجع السقف اليومي"})
    except Exception:
        pass

    if not os.getenv("APIFY_TOKEN"):
        blockers.append({"key": "apify", "severity": "warn",
                         "label": "رصد فيسبوك غير مهيّأ", "fix": "أضف APIFY_TOKEN في إعدادات الخادم"})

    # a collector that last ran days ago is stopped in every way that matters,
    # however green its key looks
    last = metrics.get("last_collection")
    if last:
        try:
            from datetime import datetime, timezone
            age_h = (datetime.now(timezone.utc) - datetime.fromisoformat(str(last).replace("Z", "+00:00"))).total_seconds() / 3600
            metrics["last_collection_age_hours"] = round(age_h, 1)
            if age_h > 48:
                blockers.append({"key": "stale_collection", "severity": "crit",
                                 "label": f"آخر جمع قبل {round(age_h / 24)} يوم — لا بيانات جديدة تصل",
                                 "fix": "افحص الإيقاف الطارئ ومفاتيح المزوّدين"})
        except Exception:
            pass
    else:
        blockers.append({"key": "never_collected", "severity": "crit",
                         "label": "لم يُسجَّل أي جمع بعد", "fix": "أضف كياناً لقائمة المتابعة وشغّل الجمع"})

    return {"services": services, "data_provider": data_provider,
            "metrics": metrics, "blockers": blockers,
            "healthy": not any(b["severity"] == "crit" for b in blockers),
            "checked_at": int(time.time())}


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
