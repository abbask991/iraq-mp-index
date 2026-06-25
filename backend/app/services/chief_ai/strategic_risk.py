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
