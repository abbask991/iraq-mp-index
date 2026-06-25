"""Strategic risk view — threats + opportunities. Uses the analyst AI output,
with a rule-based fallback so the panels are never empty."""


def fallback_threats(dg: dict) -> list:
    out = []
    for c in dg.get("active_campaigns", [])[:2]:
        cs = c.get("coordination_score", 0)
        out.append({"title": f"حملة مشتبهة #{c.get('hashtag')}",
                    "severity": "critical" if cs >= 70 else "high" if cs >= 50 else "medium",
                    "probability": cs, "impact": f"{c.get('total_posts', 0)} منشور بإشارات تنسيق",
                    "response": "راقب المصدر والمضخّمين وجهّز رداً واقعياً."})
    for n in dg.get("rising_narratives", [])[:1]:
        if n.get("neg_ratio", 0) > 0.5:
            out.append({"title": f"سردية سلبية صاعدة: {n.get('narrative')}",
                        "severity": "high", "probability": round((n.get("national_trend_probability") or 0) * 100),
                        "impact": "قد تتحوّل لترند وطني", "response": "تفنيد مبكر + متابعة الانتقال للتلفزيون."})
    return out


def fallback_recommendations(dg: dict) -> list:
    out = []
    rs = dg.get("risk_summary", {})
    camps = dg.get("active_campaigns", [])
    movers = [m for m in dg.get("movers", []) if m.get("rep_delta", 0) < 0]
    if camps:
        cs = camps[0].get("coordination_score", 0)
        out.append({"recommendation": f"جهّز رداً واقعياً على حملة #{camps[0].get('hashtag')} خلال ساعات",
                    "priority": "critical" if cs >= 70 else "high", "confidence": min(90, 50 + cs // 2),
                    "reason": "إشارات تنسيق مرتفعة قد تتحوّل إلى ترند", "evidence": f"{camps[0].get('total_posts', 0)} منشور · تنسيق {cs}/100",
                    "estimated_impact": "خفض زخم الحملة ~25%", "expected_outcome": "كبح زخم الحملة وتأخير انتقالها للإعلام التقليدي",
                    "deadline": "خلال 4 ساعات", "owner": "الفريق الإعلامي", "status": "مقترح"})
    if movers:
        out.append({"recommendation": f"عالج تراجع سمعة {movers[0]['name']} بمحتوى توضيحي",
                    "priority": "high", "confidence": 70, "reason": "هبوط ملحوظ بمؤشر السمعة",
                    "evidence": f"تغيّر {movers[0]['rep_delta']}", "estimated_impact": "وقف الانزلاق وتحسين النبرة",
                    "expected_outcome": "تعافٍ تدريجي للسمعة", "deadline": "خلال 12 ساعة", "owner": "العلاقات العامة", "status": "مقترح"})
    if rs.get("crisis", 0) >= 50:
        out.append({"recommendation": "فعّل بروتوكول إدارة الأزمة بمتابعة كل ساعة",
                    "priority": "high", "confidence": 65, "reason": "مؤشر تصعيد أزمة مرتفع",
                    "evidence": f"أزمة {rs.get('crisis', 0)}/100", "estimated_impact": "استجابة أسرع قبل التصعيد",
                    "expected_outcome": "احتواء مبكر للأزمة", "deadline": "فوري", "owner": "خلية الأزمة", "status": "مقترح"})
    out.append({"recommendation": "راقب تيليغرام و X للساعات الـ6 القادمة قبل أي رد علني",
                "priority": "medium", "confidence": 60, "reason": "رصد مبكر لأي تحوّل بالخطاب",
                "evidence": "نشاط متعدّد المنصّات", "estimated_impact": "كشف التحوّلات مبكراً",
                "expected_outcome": "تجنّب ردود متسرّعة", "deadline": "خلال 6 ساعات", "owner": "غرفة الرصد", "status": "مقترح"})
    return out[:5]


def fallback_opportunities(dg: dict) -> list:
    out = []
    for e in sorted(dg.get("entities", []), key=lambda x: -x.get("reputation", 0))[:1]:
        if e.get("reputation", 0) >= 60:
            out.append({"title": f"زخم إيجابي حول {e.get('name')}",
                        "description": f"مؤشر سمعة {e.get('reputation')}/100", "action": "ضخّم التغطية الداعمة."})
    movers = [m for m in dg.get("movers", []) if m.get("rep_delta", 0) > 0]
    if movers:
        out.append({"title": f"تحسّن سمعة {movers[0]['name']}",
                    "description": f"ارتفاع +{movers[0]['rep_delta']}", "action": "استثمر اللحظة بمحتوى داعم."})
    return out
