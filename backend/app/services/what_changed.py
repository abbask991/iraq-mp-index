"""What Changed? (Phase 7) — compares the current picture with the previous period
and surfaces only what MOVED. A daily-retention feature: the user opens it and
instantly sees new campaigns, reputation drops, sentiment shifts, viral posts,
anger/pressure spikes — each with reason, evidence count, and risk level.

Real mode reads the precomputed digest deltas (rep_delta/risk_delta are vs the
previous digest build ≈ last cycle) + the Facebook snapshot. True multi-day
comparison needs historical snapshots (noted honestly). Demo mode is curated.

Reused by: Command Center, Entity Workspace, Daily Brief, AI Chief.
"""

_META = {
    "reputation_drop": ("📉", "تراجع سمعة"), "reputation_gain": ("📈", "تحسّن سمعة"),
    "risk_rise": ("⚠️", "ارتفاع خطر"), "risk_drop": ("✅", "انخفاض خطر"),
    "new_campaign": ("📢", "حملة جديدة"), "narrative_growth": ("🧵", "نمو سردية"),
    "new_narrative": ("🆕", "سردية جديدة"), "new_viral_post": ("🔥", "منشور فايرل جديد"),
    "anger_spike": ("😠", "تصاعد غضب"), "pressure_spike": ("📣", "تصاعد ضغط شعبي"),
    "new_high_risk": ("🚨", "كيان عالي الخطورة جديد"), "platform_shift": ("🔄", "تحوّل منصّة"),
}

_PERIODS = {"last_24h": "آخر 24 ساعة مقابل سابقتها",
            "last_7d": "آخر 7 أيام مقابل سابقتها", "custom": "مدى مخصّص"}


def _card(typ, subject, change, reason, evidence=0, risk="متوسط", first_seen=None):
    em, lbl = _META.get(typ, ("•", typ))
    return {"type": typ, "icon": em, "label": lbl, "entity": subject, "change": change,
            "reason": reason, "evidence_count": evidence, "risk_level": risk, "first_seen": first_seen}


def _level(s):
    return "حرج" if s >= 70 else "مرتفع" if s >= 50 else "متوسط" if s >= 30 else "منخفض"


async def build(period: str = "last_24h", demo: bool = False, owner: str | None = None) -> dict:
    if demo:
        return _demo(period)
    changes = []
    from app.services import facebook as fb, intel_digest
    dg = await intel_digest.get_digest(owner) or {}
    ents = dg.get("entities", [])

    for e in sorted(ents, key=lambda e: -(abs(e.get("rep_delta", 0)) + abs(e.get("risk_delta", 0)))):
        rd, kd = e.get("rep_delta", 0), e.get("risk_delta", 0)
        risk = _level(e.get("risk", 0))
        if rd <= -5:
            changes.append(_card("reputation_drop", e["name"], f"{rd} سمعة", _reason(e), e.get("data_points", 0), risk))
        elif rd >= 5:
            changes.append(_card("reputation_gain", e["name"], f"+{rd} سمعة", _reason(e), e.get("data_points", 0), risk))
        if kd >= 5:
            changes.append(_card("risk_rise", e["name"], f"+{kd} خطر", _reason(e), e.get("data_points", 0), risk))
        # newly high-risk
        if e.get("risk", 0) >= 70 and kd >= 8:
            changes.append(_card("new_high_risk", e["name"], f"خطر {e['risk']}", _reason(e), e.get("data_points", 0), "حرج"))

    for n in dg.get("rising_narratives", [])[:5]:
        prob = round((n.get("national_trend_probability", 0) or 0) * 100)
        if prob >= 40 or n.get("posts", 0) >= 25:
            typ = "narrative_growth" if n.get("posts", 0) >= 25 else "new_narrative"
            changes.append(_card(typ, n["narrative"], f"{n.get('posts',0)} منشور · احتمال ترند {prob}%",
                                 f"سردية {'سلبية' if n.get('neg_ratio',0)>0.5 else 'مختلطة'} صاعدة",
                                 n.get("posts", 0), "مرتفع" if n.get("neg_ratio", 0) > 0.6 else "متوسط"))

    for c in dg.get("active_campaigns", [])[:4]:
        if (c.get("coordination_score", 0) or 0) >= 40:
            changes.append(_card("new_campaign", "#" + (c.get("hashtag") or ""),
                                 f"تنسيق {c.get('coordination_score')}", "حملة مشتبهة نشطة", 0, "مرتفع"))

    # Facebook snapshot signals
    snap = await fb.get_snapshot() or {}
    bd = snap.get("reaction_breakdown") or {}
    if bd.get("dominant") == "angry":
        changes.append(_card("anger_spike", "فيسبوك (وطني)", bd.get("dominant_signal", "غضب"),
                             "تصدّر الغضب توزيع التفاعلات", snap.get("comments_analyzed", 0), "مرتفع"))
    for v in (snap.get("viral_posts") or [])[:2]:
        changes.append(_card("new_viral_post", v.get("page", "—"), f"👍 {v.get('reactions',0)}",
                             (v.get("text") or "")[:80], v.get("comments", 0),
                             "مرتفع" if (v.get("mood_score") or 50) < 40 else "متوسط"))

    return {"demo": False, "period": period, "period_label": _PERIODS.get(period, period),
            "changes": changes[:20], "count": len(changes),
            "note": None if changes else "لا تغيّرات ملحوظة — أو لا بيانات كافية بعد. جرّب وضع العرض (?demo=1).",
            "history_note": ("المقارنة الحالية ≈ مقابل الدورة السابقة. المقارنة الدقيقة لأيام متعددة تتطلّب أرشيف لقطات يومي (قيد الإنشاء)."
                             if period != "last_24h" else None),
            "disclaimer": "مؤشرات احتمالية آلية — تتطلّب مراجعة بشرية."}


def _reason(e):
    bits = []
    if e.get("top_narrative"):
        bits.append(f"السردية: {e['top_narrative']}")
    if (e.get("crisis", 0) or 0) >= 50:
        bits.append("مؤشر أزمة مرتفع")
    return " · ".join(bits) or "نشاط سلبي مرصود"


def _demo(period: str) -> dict:
    changes = [
        _card("reputation_drop", "وزارة الكهرباء", "-18 سمعة", "تعليقات فيسبوك أصبحت أكثر سلبية بوضوح", 342, "حرج", "2026-06-29T08:00"),
        _card("new_campaign", "#فشل_الخدمات", "تنسيق 71", "ظهرت على فيسبوك وانتقلت لإكس خلال ~70 دقيقة", 230, "مرتفع", "2026-06-29T08:14"),
        _card("anger_spike", "فيسبوك (وطني)", "+24% غضب", "تصاعد ردود الفعل الغاضبة حول الخدمات", 412, "مرتفع"),
        _card("new_viral_post", "ست اشواق", "👍 40,100", "أزمة الكهرباء وغياب الحلول الحكومية", 1500, "مرتفع"),
        _card("risk_rise", "أسعار السلة الغذائية", "+11 خطر", "ارتفاع نبرة الغضب حول الغلاء", 140, "مرتفع"),
        _card("narrative_growth", "فشل الخدمات وغياب الحلول", "64 منشور · احتمال ترند 82%", "سردية سلبية صاعدة بقوة", 64, "مرتفع"),
        _card("pressure_spike", "وزارة الكهرباء", "ضغط 78/100", "حجم تعليقات + تكرار صياغات مرتفع", 342, "حرج"),
        _card("reputation_gain", "هيئة النزاهة", "+7 سمعة", "تفاعل إيجابي مع حملة الاعتقالات", 96, "متوسط"),
        _card("platform_shift", "سردية الكهرباء", "فيسبوك → إكس", "انتقلت السردية وتضخّمت على تيليجرام لاحقاً", 30, "متوسط"),
    ]
    return {"demo": True, "period": period, "period_label": _PERIODS.get(period, period),
            "changes": changes, "count": len(changes),
            "note": "🧪 وضع العرض — بيانات تجريبية واقعية.",
            "history_note": None,
            "disclaimer": "مؤشرات احتمالية آلية — تتطلّب مراجعة بشرية."}
