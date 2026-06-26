"""Coordinated-network builder — fetch, detect, and AI-summarize "who is behind
the campaign". SWR-cached at the router so repeats are instant."""
from app.services import news, x
from app.services.coordination import detector
from app.services.media_battlefield import battlefield_summary


async def build(target, rng="week", limit=220):
    tw = await x.fetch_trend(target, want=limit, range=rng)
    if "error" in tw:
        return {"error": tw["error"], "topic": target, "period": rng,
                "message": "تعذّر الجلب — تأكد من توكن X أو سقف الميزانية."}
    tweets, users = tw["tweets"], tw["users"]
    news_hits = await news.fetch_news([target], cap=30, range=rng)
    res = detector.detect_network(target, tweets, users, len(news_hits))
    res["period"] = rng

    summ = await _summarize(res)
    res["summary"] = summ.get("summary", "")
    res["recommended_actions"] = summ.get("recommended_actions", [])
    return res


async def _summarize(res):
    net, rings = res["network"], res["rings"]
    top = "، ".join("@" + n["username"] for n in sorted(net["nodes"], key=lambda x: -x["degree"])[:5]) or "—"
    sample = rings[0]["text"][:120] if rings else "—"
    facts = (
        f"الموضوع: {res['topic']}. درجة التنسيق {res['coordination_score']}/100 ({res['verdict']['label']}). "
        f"الخلايا المتناسقة {net['cells']}، أكبر خليّة {net['largest_cell']} حساباً، روابط قوية {net['strong_edges']}. "
        f"حلقات المحتوى المتكرّر {res['metrics']['rings']}، نسبة التكرار {res['metrics']['duplicate_ratio']}، "
        f"نسبة الحسابات المشبوهة {res['metrics']['suspicious_ratio']}. "
        f"أبرز الحسابات المتشابكة: {top}. مثال نص متكرّر: «{sample}». "
        f"دفعات نشر متزامنة: {len(res['bursts'])}. "
        f"المطلوب: لخّص بإيجاز من يقف خلف الحملة (إن وُجدت)، وما هدفها المرجّح، ودرجة الثقة، ثم توصيات."
    )
    return await battlefield_summary.summarize(facts)
