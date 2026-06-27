"""AICE Phase 4 — spend cap + usage accounting. Tracks tweets fetched (the
TwitterAPI.io cost driver) in Redis counters and blocks fetching once the monthly
cap is reached. Now also breaks usage down BY FEATURE (category) and BY DAY so the
Settings → Usage dashboard can show where the credits go.

Category is set per request via a contextvar (`set_category`) at each feature's
entry point, so the provider-level `add()` attributes the spend automatically.
"""
import contextvars
import time
from datetime import datetime, timedelta, timezone

from app.services import redis_client, settings

_DEFAULT_COST_PER_1K = 0.01            # user's real TwitterAPI.io rate (~$10 / 984k)
_TTL = 45 * 86400
_cap_cache = {"v": None, "t": 0.0}
_cost_cache = {"v": None, "t": 0.0}

_category: contextvars.ContextVar = contextvars.ContextVar("aice_cat", default="other")

CATEGORY_LABELS = {
    "national": "المسح الوطني / لوحة القيادة", "battlefield": "ساحة المعركة",
    "coordination": "كشف الشبكات المنسّقة", "regional": "التأثير الإقليمي",
    "cross_influence": "التأثير العابر", "patient_zero": "تتبّع المصدر",
    "profiler": "بروفايلنغ حساب", "disinfo": "كشف التضليل", "polling": "استطلاع الرأي",
    "opinion": "الرأي العام (PPOI)", "influencers": "رادار المؤثّرين",
    "ingest": "مراقبة الكيانات", "other": "أخرى",
}


def set_category(c: str) -> None:
    try:
        _category.set(c or "other")
    except Exception:
        pass


def _m() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _d() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _month_key() -> str:
    return "aice:tweets:" + _m()


async def cap() -> int:
    now = time.time()
    if _cap_cache["v"] is None or now - _cap_cache["t"] > 120:
        try:
            v = await settings.get("aice", "monthly_tweet_cap", 600000)
        except Exception:
            v = 600000
        _cap_cache["v"], _cap_cache["t"] = int(v or 0), now
    return _cap_cache["v"]


async def cost_per_1k() -> float:
    now = time.time()
    if _cost_cache["v"] is None or now - _cost_cache["t"] > 120:
        try:
            v = await settings.get("aice", "cost_per_1k", _DEFAULT_COST_PER_1K)
        except Exception:
            v = _DEFAULT_COST_PER_1K
        _cost_cache["v"], _cost_cache["t"] = float(v or _DEFAULT_COST_PER_1K), now
    return _cost_cache["v"]


async def usage() -> int:
    try:
        return int(await redis_client.get(_month_key()) or 0)
    except Exception:
        return 0


async def add(n: int, category: str | None = None) -> int:
    if n <= 0:
        return await usage()
    n = int(n)
    total = await redis_client.incrby(_month_key(), n, ex=_TTL)
    cat = category or _category.get()
    try:
        await redis_client.incrby(f"aice:cat:{_m()}:{cat}", n, ex=_TTL)
        await redis_client.incrby(f"aice:day:{_d()}", n, ex=_TTL)
    except Exception:
        pass
    return total


async def allowed() -> bool:
    c = await cap()
    if c <= 0:
        return True
    return (await usage()) < c


async def categories() -> list:
    m = _m()
    out = []
    for c in CATEGORY_LABELS:
        try:
            v = int(await redis_client.get(f"aice:cat:{m}:{c}") or 0)
        except Exception:
            v = 0
        if v:
            out.append({"category": c, "label": CATEGORY_LABELS[c], "tweets": v})
    out.sort(key=lambda x: -x["tweets"])
    return out


async def daily(days: int = 14) -> list:
    out = []
    today = datetime.now(timezone.utc)
    for i in range(days - 1, -1, -1):
        d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        try:
            v = int(await redis_client.get(f"aice:day:{d}") or 0)
        except Exception:
            v = 0
        out.append({"date": d, "tweets": v})
    return out


async def status() -> dict:
    used = await usage()
    c = await cap()
    rate = await cost_per_1k()
    return {
        "used": used, "cap": c,
        "remaining": max(0, c - used) if c > 0 else None,
        "pct": round(used / c * 100) if c > 0 else None,
        "cost_per_1k": rate,
        "est_cost_usd": round(used / 1000 * rate, 2),
        "cap_cost_usd": round(c / 1000 * rate, 2) if c > 0 else None,
        "month": _m(),
        "capped": (c > 0 and used >= c),
    }
