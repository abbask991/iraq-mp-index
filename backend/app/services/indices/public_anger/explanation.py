"""PAI explanation (§3.8 / §13) — grounded, structured narrative of the score.

Receives ONLY summarised structured data (never raw datasets, per §13). Produces
a rule-based explanation that always works; when paid AI is available it upgrades
the prose via ai.analyst_brief, but never depends on it.
"""

_LEVEL_AR = {"Low": "منخفض", "Moderate": "متوسط", "High": "مرتفع", "Critical": "حرج"}
_TREND_AR = {"rising": "متصاعد", "accelerating": "متسارع", "stable": "مستقر",
             "declining": "متراجع", "cooling_down": "يهدأ"}


def _rule_summary(d: dict) -> str:
    drivers = d.get("drivers", [])
    plats = d.get("platform_breakdown", [])
    top_d = "، ".join(x["driver_name"] for x in drivers[:2]) or "عوامل متعدّدة"
    top_p = plats[0]["platform"] if plats else "فيسبوك"
    chg = d.get("change_24h", 0)
    dir_txt = f"ارتفع {chg}+ خلال 24 ساعة" if isinstance(chg, (int, float)) and chg > 0 else \
              (f"تراجع {chg} خلال 24 ساعة" if isinstance(chg, (int, float)) and chg < 0 else "استقرّ خلال 24 ساعة")
    return (f"مؤشّر الغضب العام عند {d.get('score')}/100 ({_LEVEL_AR.get(d.get('risk_level'), '')}) و{dir_txt}. "
            f"أبرز الدوافع: {top_d}. أقوى الإشارات من منصّة {top_p}. "
            f"مستوى الثقة {d.get('confidence_score')}% "
            f"{'— يتطلّب مراجعة بشرية.' if d.get('needs_review') else '.'}")


def _what_to_watch(d: dict) -> list:
    out = []
    if any(x["driver_name"].startswith("نقص الكهرباء") for x in d.get("drivers", [])):
        out.append("استمرار انقطاع الكهرباء قد يرفع الغضب أكثر خلال ساعات الذروة.")
    if (d.get("components", {}).get("protest_language", 0) or 0) >= 30:
        out.append("ظهور لغة تعبئة/دعوات نزول — راقب التحوّل من غضب إلى حشد.")
    if (d.get("components", {}).get("cross_platform", 0) or 0) >= 55:
        out.append("انتقال السردية بين المنصّات — مؤشّر اتساع.")
    if not out:
        out.append("راقب أي قفزة مفاجئة في حجم التعليقات السلبية على المنصّة الأعلى.")
    return out


def _actions(d: dict) -> list:
    s = d.get("score", 0)
    if s >= 76:
        return ["تصعيد فوري للقيادة", "تحضير ردّ/بيان استباقي", "رصد مكثّف كل ساعة", "توثيق الأدلّة"]
    if s >= 51:
        return ["مراقبة مكثّفة (6 ساعات)", "تحضير ردّ احترازي", "متابعة أبرز الدوافع"]
    if s >= 26:
        return ["مراقبة دورية", "إعداد تقرير عند التصاعد"]
    return ["مراقبة روتينية"]


async def generate(d: dict, allow_ai: bool = True) -> dict:
    summary = _rule_summary(d)
    if allow_ai:
        try:
            from app.services import ai
            facts = (f"PAI={d.get('score')} ({d.get('risk_level')}), 24h change {d.get('change_24h')}, "
                     f"confidence {d.get('confidence_score')}. "
                     f"Top drivers: {', '.join(x['driver_name'] for x in d.get('drivers', [])[:3])}. "
                     f"Platforms: {', '.join(p['platform'] + '=' + str(p['anger_score']) for p in d.get('platform_breakdown', [])[:3])}. "
                     f"Components: {d.get('components')}.")
            txt = await ai.analyst_brief("مؤشر الغضب العام", facts)
            if txt and len(txt) > 40:
                summary = txt.strip()
        except Exception:
            pass
    return {
        "summary": summary,
        "explanation": _rule_summary(d),
        "why_changed": (f"التغيّر مدفوع أساساً بـ{d['drivers'][0]['driver_name']}."
                        if d.get("drivers") else "لا تغيّر جوهري مرصود."),
        "what_to_watch": _what_to_watch(d),
        "recommended_actions": _actions(d),
        "uncertainty": ("النتيجة ذات ثقة منخفضة وتتطلّب مراجعة بشرية قبل الاعتماد عليها."
                        if d.get("needs_review") else
                        "مؤشّر احتمالي آلي — يُستأنس به ولا يُعتمد كحقيقة قاطعة."),
    }
