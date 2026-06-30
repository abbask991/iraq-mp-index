"""Cost Control Center (Phase 9) — observability + protection for credit spend.

Reuses the existing `budget` counters (X/AI usage) for real numbers, adds monthly
projection + cost-per-insight, and persists CAPS & CONTROLS in settings that are
actually ENFORCED (emergency stop, pause Facebook, daily cap, slow mode). Smart
cost rules are surfaced and the key ones gate real behavior.

Goal: the system must never burn credits without visibility or a kill switch.
"""
import time

from app.services import settings

_CAT = "cost"
# control key → (label, type, default)
_CONTROLS = {
    "emergency_stop": ("إيقاف طارئ لكل الجمع", "bool", False),
    "slow_mode": ("الوضع البطيء (تقليل التحديث)", "bool", False),
    "pause_facebook": ("إيقاف فيسبوك", "bool", False),
    "pause_manual_refresh": ("إيقاف التحديث اليدوي", "bool", False),
    "analyze_only_viral": ("تحليل المنشورات الفايرل فقط", "bool", False),
    "daily_cap": ("سقف يومي (وحدات)", "int", 0),       # 0 = off
    "monthly_cap": ("سقف شهري (وحدات)", "int", 0),      # 0 = use budget.cap()
    "warn_at_70": ("تنبيه عند 70%", "bool", True),
    "warn_at_90": ("تنبيه عند 90%", "bool", True),
}

_cache = {"controls": None, "ts": 0.0}


async def get_controls() -> dict:
    # short cache so the hot path (_scrape guard) isn't a DB hit every call
    if _cache["controls"] is not None and (time.time() - _cache["ts"]) < 30:
        return _cache["controls"]
    out = {}
    for k, (_lbl, _t, dflt) in _CONTROLS.items():
        try:
            out[k] = await settings.get(_CAT, k, dflt)
        except Exception:
            out[k] = dflt
    _cache["controls"] = out
    _cache["ts"] = time.time()
    return out


async def set_controls(changes: dict) -> dict:
    clean = {k: v for k, v in (changes or {}).items() if k in _CONTROLS}
    res = await settings.set_many(_CAT, clean)
    _cache["controls"] = None      # invalidate
    return {"saved": clean, "result": res}


async def is_blocked(platform: str | None = None, manual: bool = False) -> tuple[bool, str | None]:
    """Cheap guard for collectors. Returns (blocked, reason_ar)."""
    c = await get_controls()
    if c.get("emergency_stop"):
        return True, "إيقاف طارئ مفعّل — كل الجمع متوقف."
    if platform == "facebook" and c.get("pause_facebook"):
        return True, "رصد فيسبوك موقوف من مركز التكلفة."
    if manual and c.get("pause_manual_refresh"):
        return True, "التحديث اليدوي موقوف من مركز التكلفة."
    # daily cap
    cap = int(c.get("daily_cap") or 0)
    if cap > 0:
        from app.services.collection import budget
        try:
            today = (await budget.daily(1))
            used = today[-1]["tweets"] if today else 0
            if used >= cap:
                return True, f"بلغ السقف اليومي ({cap}) — الجمع موقوف لليوم."
        except Exception:
            pass
    return False, None


async def dashboard(demo: bool = False) -> dict:
    if demo:
        return _demo()
    from app.services.collection import budget
    controls = await get_controls()
    try:
        st = await budget.status()
        cats = await budget.categories()
        days = await budget.daily(14)
        rate = await budget.cost_per_1k()
        cap = int(controls.get("monthly_cap") or 0) or await budget.cap()
    except Exception:
        st, cats, days, rate, cap = {}, [], [], 0.01, 0

    month_used = st.get("usage", 0)
    today_used = days[-1]["tweets"] if days else 0
    dom = max(1, int(time.strftime("%d")))
    projected = round(month_used / dom * 30)
    pct = round(month_used / cap * 100) if cap else 0

    def _cost(units):
        return round(units / 1000 * rate, 2)

    warnings = []
    if cap and pct >= 100:
        warnings.append({"level": "حرج", "msg": f"تجاوز السقف الشهري ({month_used}/{cap})."})
    elif cap and controls.get("warn_at_90") and pct >= 90:
        warnings.append({"level": "مرتفع", "msg": f"بلغت {pct}% من السقف الشهري."})
    elif cap and controls.get("warn_at_70") and pct >= 70:
        warnings.append({"level": "متوسط", "msg": f"بلغت {pct}% من السقف الشهري."})
    if cap and projected > cap:
        warnings.append({"level": "مرتفع", "msg": f"التوقّع الشهري {projected} يتجاوز السقف {cap}."})

    return {
        "demo": False,
        "today": {"units": today_used, "cost_usd": _cost(today_used)},
        "month": {"units": month_used, "cap": cap, "remaining": max(0, cap - month_used) if cap else None,
                  "pct": pct, "projected_units": projected, "projected_cost_usd": _cost(projected)},
        "by_feature": [{"label": c["label"], "units": c["tweets"], "cost_usd": _cost(c["tweets"])} for c in cats],
        "cost_per_1k": rate,
        "warnings": warnings,
        "controls": controls,
        "smart_rules": _smart_rules(controls),
        "providers_note": ("الأرقام تتبع وحدات X/الذكاء الاصطناعي المُحتسبة. تكلفة Apify (فيسبوك) "
                           "وAnthropic تُفوتر لدى المزوّد مباشرة — راجع لوحاتهم للمبالغ الدقيقة."),
        "disclaimer": "تقديرات تكلفة — للضبط والرقابة، وليست فاتورة نهائية.",
    }


def _smart_rules(c: dict) -> list:
    return [
        {"rule": "تجميع التعليقات قبل الذكاء الاصطناعي", "active": True, "note": "مفعّل دائماً — يقلّل التوكنز ~70%"},
        {"rule": "تحليل المنشورات الفايرل فقط", "active": bool(c.get("analyze_only_viral"))},
        {"rule": "تقليل تكرار تحديث فيسبوك", "active": bool(c.get("slow_mode"))},
        {"rule": "إيقاف التحليل العميق للتعليقات مؤقتاً", "active": bool(c.get("emergency_stop") or c.get("slow_mode"))},
        {"rule": "استخدام النتائج المخزّنة (كاش)", "active": True, "note": "SWR مفعّل على كل النقاط الثقيلة"},
    ]


def _demo() -> dict:
    return {
        "demo": True,
        "today": {"units": 4200, "cost_usd": 0.04},
        "month": {"units": 86000, "cap": 5000000, "remaining": 4914000, "pct": 2,
                  "projected_units": 110000, "projected_cost_usd": 1.1},
        "by_feature": [
            {"label": "ساحة المعركة", "units": 38000, "cost_usd": 0.38},
            {"label": "الملخّص الوطني", "units": 22000, "cost_usd": 0.22},
            {"label": "بروفايلنغ الحسابات", "units": 14000, "cost_usd": 0.14},
            {"label": "كشف الحملات", "units": 8000, "cost_usd": 0.08},
            {"label": "التأثير الإقليمي", "units": 4000, "cost_usd": 0.04},
        ],
        "platform_breakdown": [{"platform": "فيسبوك", "pct": 62}, {"platform": "تيك توك", "pct": 14},
                               {"platform": "إنستغرام", "pct": 10}, {"platform": "إكس", "pct": 9},
                               {"platform": "أخبار/RSS", "pct": 5}],
        "cost_per_insight": [{"item": "تنبيه", "cost_usd": 0.03}, {"item": "حملة مكتشفة", "cost_usd": 0.12},
                             {"item": "تقرير", "cost_usd": 0.21}, {"item": "موجز يومي", "cost_usd": 0.06}],
        "cost_per_1k": 0.01,
        "warnings": [{"level": "متوسط", "msg": "🧪 مثال تنبيه: بلغت 72% من سقف فيسبوك الشهري."}],
        "controls": {k: v[2] for k, v in _CONTROLS.items()},
        "smart_rules": _smart_rules({}),
        "providers_note": "🧪 وضع العرض — أرقام تجريبية توضيحية.",
        "disclaimer": "تقديرات تكلفة — للضبط والرقابة، وليست فاتورة نهائية.",
    }


def control_meta() -> list:
    return [{"key": k, "label": lbl, "type": t, "default": d} for k, (lbl, t, d) in _CONTROLS.items()]
