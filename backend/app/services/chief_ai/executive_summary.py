"""Assembles the full AI Chief Intelligence Officer dashboard payload from the
precomputed digest + the analyst AI generation. This is what /api/chief-ai/
dashboard returns (cached)."""
from app.services import intel_digest
from app.services.chief_ai import (
    forecast_engine, priority_engine, question_engine, recommendation_engine, strategic_risk,
)


def _kpis(dg: dict) -> list:
    ents = dg.get("entities", [])
    rs = dg.get("risk_summary", {})
    n = len(ents) or 1
    avg = lambda f: round(sum(f(e) for e in ents) / n) if ents else 0
    rep = avg(lambda e: e.get("reputation", 0))
    trust = avg(lambda e: e.get("public_trust", 0))
    pol = rs.get("political", 0)
    overall_risk = round((rs.get("political", 0) + rs.get("crisis", 0) + rs.get("campaign", 0)) / 3) if rs else 0
    visibility = min(100, round(sum(e.get("data_points", 0) for e in ents) / (n * 200) * 100)) if ents else 0
    narr_pressure = round(max((nr.get("national_trend_probability", 0) for nr in dg.get("rising_narratives", [])), default=0) * 100)
    camp_activity = min(100, len(dg.get("active_campaigns", [])) * 20)
    movers = dg.get("movers", [])
    rep_change = round(sum(m.get("rep_delta", 0) for m in movers) / len(movers)) if movers else None
    risk_change = round(sum(m.get("risk_delta", 0) for m in movers) / len(movers)) if movers else None

    def k(name, cur, change=None, invert=False):
        return {"name": name, "current": cur, "change": change, "invert": invert}
    return [
        k("الخطر العام", overall_risk, risk_change, invert=True),
        k("الاستقرار السياسي", max(0, 100 - pol)),
        k("مزاج الإعلام", rep, rep_change),
        k("نشاط الحملات", camp_activity, invert=True),
        k("ضغط السرديات", narr_pressure, invert=True),
        k("مؤشر السمعة", rep, rep_change),
        k("ثقة الجمهور", trust),
        k("الظهور الإعلامي", visibility),
    ]


def _facts(dg: dict) -> str:
    rs = dg.get("risk_summary", {})
    return (
        f"الكيانات الأعلى خطراً: {'، '.join(e['name'] + '(' + str(e.get('risk', 0)) + ')' for e in dg.get('top_risk', [])[:3]) or '—'}. "
        f"أكبر تغيّرات السمعة: {'، '.join(e['name'] + ' ' + ('+' if e.get('rep_delta', 0) >= 0 else '') + str(e.get('rep_delta', 0)) for e in dg.get('movers', [])[:3]) or 'مستقرة'}. "
        f"حملات نشطة مشتبهة: {len(dg.get('active_campaigns', []))} ({'، '.join('#' + (c.get('hashtag') or '') for c in dg.get('active_campaigns', [])[:3]) or '—'}). "
        f"سرديات صاعدة: {'، '.join(n['narrative'] + ' (' + str(round((n.get('national_trend_probability') or 0) * 100)) + '% وطني)' for n in dg.get('rising_narratives', [])[:3]) or '—'}. "
        f"مؤشرات الخطر: سياسي {rs.get('political', 0)}، سمعة {rs.get('reputation', 0)}، أزمة {rs.get('crisis', 0)}، حملات {rs.get('campaign', 0)}. "
        f"توزيع المنصّات: {'، '.join(p['platform'] + ' ' + str(p['pct']) + '%' for p in dg.get('platform_activity', [])[:4])}."
    )


async def build_dashboard() -> dict:
    dg = await intel_digest.get_digest() or {}
    events = priority_engine.rank_events(dg)
    forecast = forecast_engine.strategic(dg)
    advisor = await recommendation_engine.generate(_facts(dg))
    questions = advisor.get("questions") or question_engine.suggest(dg)
    risk_lv = (dg.get("executive") or {}).get("risk_level", "—")

    return {
        "generated_at": dg.get("generated_at"),
        "executive_brief": advisor.get("executive_brief") or (dg.get("executive") or {}).get("brief", ""),
        "risk_level": risk_lv,
        "events": events,
        "threats": advisor.get("threats") or strategic_risk.fallback_threats(dg),
        "opportunities": advisor.get("opportunities") or strategic_risk.fallback_opportunities(dg),
        "recommendations": advisor.get("recommendations", []),
        "questions": questions,
        "forecast": forecast,
        "kpis": _kpis(dg),
        "timeline": [{"label": e["title"], "summary": e["summary"], "type": e["type"],
                      "importance": e["importance"]} for e in events[:6]],
        "entities_monitored": dg.get("count", 0),
        "disclaimer": "تقرير استخباراتي آلي — كل استنتاج احتمالي مبني على بيانات المنصّة ويتطلّب مراجعة بشرية.",
    }
