"""Priority engine — ranks everything (campaigns, narratives, entities-under-
pressure) into "today's most important events" by a weighted Priority Score."""


def _clamp(v):
    return max(0, min(100, round(v)))


def priority_score(*, risk=0, reach=0, velocity=0, campaign_score=0,
                   influencer=0, narrative_dominance=0, strategic_importance=0, freshness=100):
    return _clamp(0.20 * risk + 0.15 * reach + 0.15 * velocity + 0.15 * campaign_score
                  + 0.10 * influencer + 0.10 * narrative_dominance
                  + 0.10 * strategic_importance + 0.05 * freshness)


def rank_events(dg: dict, top=10):
    """Derive strategic events from the digest and rank them."""
    events = []
    for c in dg.get("active_campaigns", []):
        cs = c.get("coordination_score", 0)
        events.append({
            "type": "campaign", "title": f"حملة مشتبهة حول #{c.get('hashtag')}",
            "importance": priority_score(risk=cs, campaign_score=cs, velocity=60, reach=55,
                                         narrative_dominance=50, strategic_importance=70),
            "risk": cs, "reach_estimate": (c.get("total_posts", 0) or 0) * 1500,
            "platforms": ["X"], "summary": f"درجة تنسيق محتملة {cs}/100 على {c.get('total_posts', 0)} منشور.",
        })
    for n in dg.get("rising_narratives", []):
        prob = (n.get("national_trend_probability") or 0) * 100
        events.append({
            "type": "narrative", "title": f"سردية صاعدة: {n.get('narrative')}",
            "importance": priority_score(risk=int(n.get("neg_ratio", 0) * 100), velocity=prob,
                                         narrative_dominance=min(100, n.get("posts", 0)),
                                         reach=prob, strategic_importance=60),
            "risk": int(n.get("neg_ratio", 0) * 100), "reach_estimate": (n.get("posts", 0) or 0) * 2000,
            "platforms": ["X", "أخبار"], "summary": f"احتمال ترند وطني {round(prob)}% · {'، '.join(n.get('entities', [])[:3])}.",
        })
    for e in sorted(dg.get("entities", []), key=lambda x: -x.get("risk", 0))[:6]:
        if e.get("risk", 0) < 30:
            continue
        events.append({
            "type": "entity", "title": f"ضغط متزايد على {e.get('name')}",
            "importance": priority_score(risk=e.get("risk", 0), influencer=e.get("influence", 0),
                                         reach=e.get("influence", 0), strategic_importance=75,
                                         velocity=abs(e.get("risk_delta", 0)) * 5),
            "risk": e.get("risk", 0), "reach_estimate": e.get("data_points", 0) * 1800,
            "platforms": ["X", "أخبار"], "summary": f"الخطر {e.get('risk', 0)}/100، تغيّر السمعة {e.get('rep_delta', 0):+d}.",
        })
    events.sort(key=lambda x: -x["importance"])
    return events[:top]
