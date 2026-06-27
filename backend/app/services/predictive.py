"""Predictive / early-warning engine. Packages the platform's forward-looking
signals (each entity's & narrative's national_trend_probability + trajectory +
reputation/risk deltas, all produced by the twin's prediction_engine) into
explicit 24–72h forecasts: who is likely to escalate, which narrative is likely
to spike, and the national crisis outlook. Probabilistic — never certainty."""
from app.services import intel_digest


def _eta(p: float) -> str:
    return "خلال 24 ساعة" if p >= 0.6 else "24–48 ساعة" if p >= 0.35 else "48–72 ساعة"


def _entity_forecast(e: dict):
    traj = (e.get("trajectory") or "")
    prob = e.get("national_trend_probability") or 0.0
    rd = e.get("rep_delta", 0)
    risk = e.get("risk", 0)
    crisis = e.get("crisis", 0)
    score = 0
    why = []
    if any(k in traj for k in ("escal", "rising", "تصاعد", "صعود")):
        score += 28; why.append("مسار تصاعدي")
    if rd <= -3:
        score += 26; why.append(f"سمعة هابطة ({rd})")
    if prob >= 0.4:
        score += 24; why.append(f"احتمال ترند وطني {round(prob * 100)}%")
    if crisis >= 40:
        score += 18; why.append(f"مؤشر أزمة {crisis}")
    if risk >= 45:
        score += 14; why.append(f"خطر مرتفع {risk}")
    p = min(95, round(score + prob * 20))
    if p < 30:
        return None
    return {"name": e["name"], "probability": p, "eta": _eta(prob),
            "direction": "تصعيد خطر مُحتمل", "current_risk": risk,
            "reasons": why[:3], "confidence": min(95, 40 + (e.get("data_points", 0) // 4))}


def _narrative_forecast(n: dict):
    prob = n.get("national_trend_probability") or 0.0
    posts = n.get("posts", 0)
    neg = n.get("neg_ratio", 0)
    if prob < 0.3 and posts < 60:
        return None
    p = min(95, round(prob * 70 + min(30, posts / 4)))
    if p < 30:
        return None
    return {"narrative": n["narrative"], "probability": p, "eta": _eta(prob),
            "tone": "سلبية" if neg > 0.5 else "إيجابية/محايدة", "posts": posts,
            "entities": (n.get("entities") or [])[:3],
            "confidence": min(90, 35 + posts // 6)}


async def outlook():
    dg = await intel_digest.get_digest() or {}
    ents = dg.get("entities", [])
    narrs = dg.get("rising_narratives", [])
    rs = dg.get("risk_summary", {})

    entity_fc = sorted((f for f in (_entity_forecast(e) for e in ents) if f),
                       key=lambda x: -x["probability"])[:8]
    narr_fc = sorted((f for f in (_narrative_forecast(n) for n in narrs) if f),
                     key=lambda x: -x["probability"])[:8]

    # national crisis probability (72h) — weighted blend of standing risk + the
    # strongest forward signals.
    base = (rs.get("crisis", 0) * 0.4 + rs.get("political", 0) * 0.3 + rs.get("campaign", 0) * 0.3)
    top_e = entity_fc[0]["probability"] if entity_fc else 0
    top_n = narr_fc[0]["probability"] if narr_fc else 0
    crisis_prob = min(95, round(base * 0.5 + max(top_e, top_n) * 0.5))
    level = ("حرج" if crisis_prob >= 65 else "مرتفع" if crisis_prob >= 45
             else "متوسط" if crisis_prob >= 25 else "منخفض")

    summary = await _summarize(crisis_prob, level, entity_fc, narr_fc) if (entity_fc or narr_fc) else ""

    return {
        "national_outlook": {"crisis_probability_72h": crisis_prob, "level": level,
                             "political": rs.get("political", 0), "crisis": rs.get("crisis", 0),
                             "campaign": rs.get("campaign", 0)},
        "entity_forecasts": entity_fc,
        "narrative_forecasts": narr_fc,
        "summary": summary,
        "generated_at": dg.get("generated_at"),
        "disclaimer": "تنبّؤ احتمالي آلي مبني على إشارات الاتجاه والسرعة — ليس حتمية، ويتطلّب مراجعة بشرية.",
    }


async def _summarize(crisis_prob, level, entity_fc, narr_fc):
    from app.services.media_battlefield import battlefield_summary
    es = "، ".join(f"{e['name']} ({e['probability']}% {e['eta']})" for e in entity_fc[:4]) or "—"
    ns = "، ".join(f"«{n['narrative']}» ({n['probability']}%)" for n in narr_fc[:4]) or "—"
    facts = (
        f"تنبّؤ استخباراتي للـ24–72 ساعة القادمة. احتمال حدث أزمة وطني {crisis_prob}/100 ({level}). "
        f"كيانات مرشّحة للتصعيد: {es}. سرديات مرشّحة للانتشار: {ns}. "
        f"اكتب موجزاً تنبّؤياً: ما الأرجح حدوثه، على من، متى، وما الذي يجب على المحلّل مراقبته والاستعداد له."
    )
    out = await battlefield_summary.summarize(facts)
    return out.get("summary", "")
