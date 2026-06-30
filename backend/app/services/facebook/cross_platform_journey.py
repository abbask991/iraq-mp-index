"""Cross-Platform Journey (spec §7+§10+§11).

Traces whether a Facebook narrative moved to X / Telegram / TikTok / news, with
the time lag, similarity, and leading source for each hop. Answers: did the story
START on Facebook or move TO it? which platform amplified it first?

Demo mode returns curated synthetic journeys. Real mode requires the other
platforms to be persisted with timestamps (X/Telegram/news collectors) so we can
match content across them — that pipeline is not built yet, so real mode returns
an honest 'not available' rather than a fabricated journey.
"""
from app.services import facebook as fb

_PLATFORM_AR = {"facebook": "فيسبوك", "x": "إكس", "telegram": "تيليجرام",
                "tiktok": "تيك توك", "instagram": "إنستغرام", "news": "الأخبار"}


def _enrich(j: dict) -> dict:
    hops = j.get("hops", [])
    total_lag = hops[-1]["lag_minutes"] if hops else 0
    platforms = [h["platform"] for h in hops]
    amplifier = None
    if len(hops) > 1:
        amplifier = max(hops[1:], key=lambda h: h.get("reach") or 0).get("platform")
    return {
        **j,
        "platforms": platforms,
        "platform_count": len(set(platforms)),
        "total_lag_minutes": total_lag,
        "total_lag_human": f"{round(total_lag/60,1)} ساعة" if total_lag >= 60 else f"{total_lag} دقيقة",
        "first_amplifier": amplifier,
        "hops": [{**h, "platform_ar": _PLATFORM_AR.get(h["platform"], h["platform"]),
                  "lag_human": ("الأصل" if h.get("lag_minutes", 0) == 0
                                else f"+{round(h['lag_minutes']/60,1)} ساعة" if h.get("lag_minutes", 0) >= 60
                                else f"+{h['lag_minutes']} دقيقة")} for h in hops],
    }


async def journeys(demo: bool = False) -> dict:
    if demo:
        from app.services.facebook import demo as _demo
        js = [_enrich(j) for j in _demo.journeys()]
        return {"available": True, "demo": True, "journeys": js,
                "summary": f"{len(js)} روايات تتبّعنا انتقالها عبر المنصّات.",
                "disclaimer": "تتبّع احتمالي لانتقال المحتوى — مؤشرات تشابه لا أحكام قاطعة."}
    # real mode needs X/Telegram/news stored with timestamps to match content
    return {"available": False, "demo": False, "journeys": [],
            "note": "تتبّع الرحلة عبر المنصّات يتطلّب تخزين X/تيليجرام/الأخبار مع الطوابع الزمنية (قيد الإنشاء). "
                    "جرّب وضع العرض (?demo=1) لمعاينة الميزة."}
