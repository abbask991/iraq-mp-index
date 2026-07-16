"""Command Center (Phase 1) — the single "what should the client know right now?"
view. Pure ASSEMBLY over the precomputed intel_digest (no new collection / no AI
cost). Recommended actions are RULE-BASED so the page is decision-support even
when AI credits are down. A demo payload powers offline presentations.

Answers in ~60 seconds: top risks · what changed (24h) · active campaigns ·
trending now · most urgent recommendation · executive brief.
"""


def _risk_label(s: int) -> str:
    return "حرج" if s >= 70 else "مرتفع" if s >= 50 else "متوسط" if s >= 30 else "منخفض"


def _actions_for(e: dict) -> list:
    risk = e.get("risk", 0)
    has_campaign = (e.get("campaign_threat", 0) or 0) >= 40
    if risk >= 70:
        acts = ["تصعيد للقيادة فوراً", "تحضير بيان توضيحي", "رصد تعليقات فيسبوك عن كثب"]
    elif risk >= 50:
        acts = ["مراقبة مكثّفة (6 ساعات)", "تحضير ردّ احترازي", "رصد التعليقات"]
    elif risk >= 30:
        acts = ["مراقبة", "إعداد تقرير عند التصاعد"]
    else:
        acts = ["لا ردّ موصى به الآن"]
    if has_campaign:
        acts.insert(0, "رصد حملة منسّقة محتملة")
    return acts


def _reason(e: dict) -> str:
    bits = []
    if e.get("top_narrative"):
        bits.append(f"السردية: {e['top_narrative']}")
    rd, kd = e.get("rep_delta", 0), e.get("risk_delta", 0)
    if kd >= 5:
        bits.append(f"ارتفاع الخطر +{kd}")
    if rd <= -5:
        bits.append(f"تراجع السمعة {rd}")
    if (e.get("crisis", 0) or 0) >= 50:
        bits.append("مؤشر أزمة مرتفع")
    return " · ".join(bits) or "نشاط سلبي مرصود"


def _rule_brief(top_risk: list, changes: list, campaigns: list) -> str:
    parts = []
    if top_risk:
        names = "، ".join(e["name"] for e in top_risk[:3])
        parts.append(f"أبرز الكيانات خطراً اليوم: {names}.")
    if changes:
        c = changes[0]
        parts.append(f"أبرز تغيّر: {c['entity']} ({c['change']}) — {c['reason']}.")
    if campaigns:
        parts.append(f"حملات نشطة مشتبهة: {len(campaigns)}.")
    parts.append("ملخّص آلي مبسّط (بدون ذكاء اصطناعي) — يُستبدل بالموجز التنفيذي الكامل عند توفّر الرصيد.")
    return " ".join(parts)


async def build(demo: bool = False) -> dict:
    if demo:
        return _demo_payload()
    from app.services import intel_digest
    dg = await intel_digest.get_digest() or {}
    ents = dg.get("entities", [])
    ex = dg.get("executive") or {}

    top_risk = sorted(ents, key=lambda e: -e.get("risk", 0))[:5]
    risks = [{
        "entity": e["name"], "risk": e.get("risk", 0), "level": _risk_label(e.get("risk", 0)),
        "reason": _reason(e), "evidence_count": e.get("data_points", 0),
        "evidence_capped": e.get("data_points_capped", False),
        "recommended_action": _actions_for(e)[0],
    } for e in top_risk]

    # what changed (24h) — significant reputation/risk deltas
    changes = []
    for e in sorted(ents, key=lambda e: -(abs(e.get("rep_delta", 0)) + abs(e.get("risk_delta", 0)))):
        rd, kd = e.get("rep_delta", 0), e.get("risk_delta", 0)
        if abs(rd) >= 5 or abs(kd) >= 5:
            typ = ("reputation_drop" if rd <= -5 else "reputation_gain" if rd >= 5
                   else "risk_rise" if kd >= 5 else "risk_drop")
            changes.append({
                "type": typ, "entity": e["name"],
                "change": (f"{'+' if rd >= 0 else ''}{rd} سمعة" if abs(rd) >= 5 else f"{'+' if kd >= 0 else ''}{kd} خطر"),
                "reason": _reason(e), "evidence_count": e.get("data_points", 0),
                "risk_level": _risk_label(e.get("risk", 0)),
            })
    changes = changes[:7]

    most_damaged = min(ents, key=lambda e: e.get("rep_delta", 0), default=None)
    most_improved = max(ents, key=lambda e: e.get("rep_delta", 0), default=None)

    campaigns = [c for c in dg.get("active_campaigns", []) if (c.get("coordination_score", 0) or 0) >= 30][:5]
    narrs = dg.get("rising_narratives", [])[:5]
    trending = [{
        "topic": n["narrative"], "velocity": round((n.get("national_trend_probability", 0) or 0) * 100),
        "sentiment": "سلبي" if (n.get("neg_ratio", 0) or 0) > 0.5 else "إيجابي/مختلط",
        "posts": n.get("posts", 0),
        "risk": "مرتفع" if (n.get("neg_ratio", 0) or 0) > 0.6 and n.get("posts", 0) > 20 else "متوسط",
    } for n in narrs]

    # most urgent recommendation
    urgent = (_actions_for(top_risk[0])[0] if top_risk else "الوضع مستقر — مراقبة روتينية")

    brief = ex.get("brief") or _rule_brief(top_risk, changes, campaigns)

    return {
        "demo": False,
        "generated_at": dg.get("generated_at"),
        "executive_brief": brief,
        "executive": {"risk_level": ex.get("risk_level"), "top_event": ex.get("top_event"),
                      "recommendation": ex.get("recommendation")},
        "national_risk": dg.get("risk_summary", {}),
        # Pass-through of fields the digest ALREADY computes. Zero extra cost — this
        # service is pure assembly — and they turn the page from text cards into
        # actual charts (sentiment split, platform mix, emotion grid, geography).
        "national_sentiment": dg.get("national_sentiment") or {},
        "platform_activity": dg.get("platform_activity") or [],
        "emotion_heatmap": dg.get("emotion_heatmap") or [],
        "coverage": dg.get("coverage") or {},
        "geo": dg.get("geo"),
        "top_risks": risks,
        "what_changed": changes,
        "most_damaged": ({"entity": most_damaged["name"], "change": most_damaged.get("rep_delta", 0)}
                         if most_damaged and most_damaged.get("rep_delta", 0) < 0 else None),
        "most_improved": ({"entity": most_improved["name"], "change": most_improved.get("rep_delta", 0)}
                          if most_improved and most_improved.get("rep_delta", 0) > 0 else None),
        "active_campaigns": [{"hashtag": c.get("hashtag"), "coordination": c.get("coordination_score", 0),
                              "level": c.get("alert_level", {}).get("label") if isinstance(c.get("alert_level"), dict) else None}
                             for c in campaigns],
        "trending": trending,
        "urgent_recommendation": urgent,
        "recommended_actions": (_actions_for(top_risk[0]) if top_risk else ["مراقبة روتينية"]),
        "empty": not ents,
        "note": None if ents else "لا توجد بيانات مرصودة بعد — شغّل الجمع أو جرّب وضع العرض (?demo=1).",
        "disclaimer": "مؤشرات احتمالية آلية — تتطلّب مراجعة بشرية. لا تُثبت تنسيقاً أو انتماءً كحقيقة.",
    }


def _demo_payload() -> dict:
    return {
        "demo": True, "generated_at": None,
        "executive_brief": ("يسود اليوم توتر متصاعد حول أداء الخدمات، تتصدّره وزارة الكهرباء مع تراجع واضح في "
                            "مزاج التعليقات على فيسبوك (سلبي ~78%) رغم تفاعلات سطحية إيجابية. تُرصد حملة مشتبهة "
                            "حول «فشل الخدمات» انتقلت من فيسبوك إلى منصّات أخرى خلال ساعتين. يُوصى بالمراقبة المكثّفة "
                            "وتحضير ردّ احترازي قبل اتساع السردية. (وضع العرض — بيانات تجريبية)."),
        "executive": {"risk_level": "مرتفع", "top_event": "تصاعد الغضب حول الكهرباء على فيسبوك",
                      "recommendation": "مراقبة مكثّفة 6 ساعات + تحضير بيان"},
        "national_risk": {"political": 58, "reputation": 61, "crisis": 47, "campaign": 52},
        # Consistent with the demo story above: electricity-driven negativity,
        # Facebook-heavy, anger concentrated on the service ministries.
        "national_sentiment": {"pos": 412, "neg": 1985, "neu": 733},
        "coverage": {"signals": 3130, "sample": 3130, "platforms": 4, "sources": 86,
                     "engagement": 412_800, "latest": "2026-07-17T09:20:00Z", "comments": 8420},
        "platform_activity": [
            {"platform": "facebook", "count": 1840, "pct": 59},
            {"platform": "x", "count": 742, "pct": 24},
            {"platform": "telegram", "count": 356, "pct": 11},
            {"platform": "tiktok", "count": 192, "pct": 6},
        ],
        # Each row is a DISTRIBUTION summing to 100 — same contract as the real
        # emotions.aggregate(), which returns round(share * 100) per emotion.
        "emotion_heatmap": [
            {"entity": "وزارة الكهرباء", "emotions": {"anger": 38, "frustration": 26, "sarcasm": 14, "fear": 6, "sadness": 5, "disgust": 8, "trust": 2, "joy": 1}},
            {"entity": "أسعار السلة الغذائية", "emotions": {"anger": 30, "frustration": 32, "sarcasm": 9, "fear": 12, "sadness": 10, "disgust": 5, "trust": 1, "joy": 1}},
            {"entity": "ملف المنافذ الحدودية", "emotions": {"anger": 26, "frustration": 16, "sarcasm": 20, "fear": 6, "sadness": 4, "disgust": 22, "trust": 4, "joy": 2}},
            {"entity": "هيئة النزاهة", "emotions": {"anger": 12, "frustration": 10, "sarcasm": 15, "fear": 5, "sadness": 4, "disgust": 6, "trust": 34, "joy": 14}},
            {"entity": "البرلمان", "emotions": {"anger": 22, "frustration": 18, "sarcasm": 30, "fear": 5, "sadness": 7, "disgust": 12, "trust": 4, "joy": 2}},
        ],
        "geo": None,
        "top_risks": [
            {"entity": "وزارة الكهرباء", "risk": 74, "level": "حرج", "reason": "السردية: فشل الخدمات · ارتفاع الخطر +12 · مؤشر أزمة مرتفع", "evidence_count": 342, "recommended_action": "تصعيد للقيادة فوراً"},
            {"entity": "ملف المنافذ الحدودية", "risk": 61, "level": "مرتفع", "reason": "السردية: التهريب والفساد · تراجع السمعة -9", "evidence_count": 188, "recommended_action": "مراقبة مكثّفة (6 ساعات)"},
            {"entity": "أسعار السلة الغذائية", "risk": 55, "level": "مرتفع", "reason": "غضب شعبي متصاعد على الغلاء", "evidence_count": 140, "recommended_action": "تحضير ردّ احترازي"},
            {"entity": "هيئة النزاهة", "risk": 38, "level": "متوسط", "reason": "جدل حول انتقائية المحاسبة", "evidence_count": 96, "recommended_action": "مراقبة"},
            {"entity": "البرلمان", "risk": 31, "level": "متوسط", "reason": "سرديات نقدية متفرّقة", "evidence_count": 64, "recommended_action": "مراقبة"},
        ],
        "what_changed": [
            {"type": "reputation_drop", "entity": "وزارة الكهرباء", "change": "-18 سمعة", "reason": "تعليقات فيسبوك أصبحت أكثر سلبية بوضوح", "evidence_count": 342, "risk_level": "حرج"},
            {"type": "new_campaign", "entity": "فشل الخدمات", "change": "حملة جديدة", "reason": "ظهرت على فيسبوك وانتقلت لإكس خلال ~70 دقيقة", "evidence_count": 230, "risk_level": "مرتفع"},
            {"type": "risk_rise", "entity": "أسعار السلة الغذائية", "change": "+11 خطر", "reason": "ارتفاع نبرة الغضب", "evidence_count": 140, "risk_level": "مرتفع"},
            {"type": "reputation_gain", "entity": "هيئة النزاهة", "change": "+7 سمعة", "reason": "تفاعل إيجابي مع حملة الاعتقالات", "evidence_count": 96, "risk_level": "متوسط"},
        ],
        "most_damaged": {"entity": "وزارة الكهرباء", "change": -18},
        "most_improved": {"entity": "هيئة النزاهة", "change": 7},
        "active_campaigns": [
            {"hashtag": "فشل_الخدمات", "coordination": 71, "level": "مرتفع"},
            {"hashtag": "وين_الكهرباء", "coordination": 54, "level": "متوسط"},
        ],
        "trending": [
            {"topic": "أزمة الكهرباء", "velocity": 82, "sentiment": "سلبي", "posts": 64, "risk": "مرتفع"},
            {"topic": "غلاء الأسعار", "velocity": 67, "sentiment": "سلبي", "posts": 48, "risk": "مرتفع"},
            {"topic": "حملة مكافحة الفساد", "velocity": 59, "sentiment": "إيجابي/مختلط", "posts": 52, "risk": "متوسط"},
        ],
        "urgent_recommendation": "تصعيد ملف الكهرباء للقيادة + تحضير بيان توضيحي خلال الساعات القادمة",
        "recommended_actions": ["تصعيد للقيادة فوراً", "تحضير بيان توضيحي", "رصد تعليقات فيسبوك عن كثب", "إعداد تقرير موجز"],
        "empty": False, "note": "🧪 وضع العرض — بيانات تجريبية واقعية.",
        "disclaimer": "مؤشرات احتمالية آلية — تتطلّب مراجعة بشرية. لا تُثبت تنسيقاً أو انتماءً كحقيقة.",
    }
