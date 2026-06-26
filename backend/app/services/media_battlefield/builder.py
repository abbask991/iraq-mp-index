"""Media Battlefield orchestration — assembles the war-room view (graph, scores,
sides, narratives, timeline, evidence, AI summary) for an entity, and a national
overview from the precomputed digest. Results are cached (Redis SWR) so the
heavy build runs in the background, not on every request.
"""
import math
from collections import Counter
from datetime import datetime

from app.services import (
    ai, campaign, entity_resolver, forecast, narrative_engine, news, x,
)
from app.services.media_battlefield import (
    battlefield_summary, battlefield_timeline, evidence_collector, graph_builder,
    relationship_extractor as rex, scorer,
)

EMPTY = {"summary": "", "risk_level": "—", "nodes": [], "edges": [], "scores": {},
         "top_attackers": [], "top_supporters": [], "top_narratives": [], "top_campaigns": [],
         "timeline": {}, "evidence": [], "recommended_actions": []}


def _logn(v, k=33):
    return min(100, math.log10((v or 0) + 1) * k)


def _acc(a):
    return {"username": a["username"], "name": a.get("name"), "influence": a["influence"],
            "posts": a["posts"], "engagement": a["engagement"], "bot": a["bot"],
            "followers": a["followers"], "confidence": a["confidence"], "evidence": a["evidence"][:2]}


async def build_entity(name, rng="week", limit=300):
    tw = await x.fetch_trend(name, want=limit, range=rng)
    if "error" in tw:
        return {**EMPTY, "error": tw["error"], "message": "تعذّر — تأكد من توكن X", "entity": {"name": name}}
    tweets, users = tw["tweets"], tw["users"]
    if tweets:
        cls = await ai.classify_all([t["text"] for t in tweets])
        for t, c in zip(tweets, cls):
            t["sentiment"], t["type"] = c.get("sentiment", "محايد"), c.get("type", "عام")
    news_hits = await news.fetch_news([name], cap=60, range=rng)
    if news_hits:
        ncls = await ai.classify_all([h["title"] for h in news_hits])
        for h, c in zip(news_hits, ncls):
            h["sentiment"] = c.get("sentiment", "محايد")

    roles = rex.account_roles(tweets, users)
    attackers, supporters, neutral = rex.split_sides(roles)
    narrs = narrative_engine.narratives(
        [{"title": t["text"], "type": t.get("type", "عام"), "sentiment": t.get("sentiment")} for t in tweets])
    camp = campaign.detect(name, tweets, users, len(news_hits)) if len(tweets) >= 5 else {}
    coord = camp.get("coordination_score", 0)

    total = (len(tweets) + len(news_hits)) or 1
    neg = sum(1 for t in tweets if t.get("sentiment") == "سلبي") + sum(1 for h in news_hits if h.get("sentiment") == "سلبي")
    pos = sum(1 for t in tweets if t.get("sentiment") == "إيجابي") + sum(1 for h in news_hits if h.get("sentiment") == "إيجابي")
    neg_vol, pos_vol = min(100, neg / total * 130), min(100, pos / total * 130)
    dom = narrative_engine.dominance_score(narrs).get("score", 0)
    neg_narr = max((n["share"] for n in narrs if n["neg_ratio"] > 0.5), default=0)
    pos_narr = max((n["share"] for n in narrs if n["neg_ratio"] <= 0.5), default=0)
    att_infl = min(100, sum(r["influence"] for r in attackers) * 4)
    sup_infl = min(100, sum(r["influence"] for r in supporters) * 4)
    eng = _logn(sum(t.get("engagement", 0) for t in tweets), 14)
    cross = 100 if (news_hits and tweets) else 55

    hours = Counter()
    for t in tweets:
        try:
            dt = datetime.fromisoformat((t.get("created_at") or "").replace("Z", "+00:00"))
            hours[dt.strftime("%m-%d %H")] += 1
        except Exception:
            pass
    series = [c for _, c in sorted(hours.items())]
    vel = min(100, max(0.0, forecast.velocity(series)) * 16) if len(series) >= 2 else 0

    ap = scorer.attack_pressure(neg_volume=neg_vol, campaign_threat=coord, influencer_amplification=att_infl,
                                narrative_consistency=neg_narr, coordination=coord, velocity=vel)
    ss = scorer.support_strength(pos_volume=pos_vol, supporter_influence=sup_infl, engagement=eng,
                                 narrative_alignment=pos_narr, cross_platform=cross)
    adv = scorer.advantage(positive_support_volume=pos_vol, influencer_support=sup_infl, narrative_dominance=dom,
                           cross_platform=cross, engagement_momentum=eng, attack_pressure_score=ap)
    vd = scorer.verdict(adv, ap, ss)
    risk_level = "حرج" if ap >= 70 else "مرتفع" if ap >= 50 else "متوسط" if ap >= 30 else "منخفض"

    er = entity_resolver.resolve_entity_alias(name)
    etype = er["type"] if er else "entity"
    graph = graph_builder.build(name, etype, roles, narrs, news_hits)
    tl = battlefield_timeline.build(tweets, news_hits, {"campaign_score": coord})
    ev = evidence_collector.collect(tweets, news_hits)

    facts = (
        f"الكيان: {name} (نوع: {etype}). ضغط الهجوم {ap}/100، قوة الدعم {ss}/100، الأفضلية {adv}/100 ({vd['state']}). "
        f"مهاجمون {len(attackers)} (أبرزهم {'، '.join('@' + (a['username'] or '') for a in attackers[:3]) or '—'})، "
        f"داعمون {len(supporters)} (أبرزهم {'، '.join('@' + (a['username'] or '') for a in supporters[:3]) or '—'}). "
        f"أبرز السرديات: {'، '.join(n['narrative'] for n in narrs[:3]) or '—'}. "
        f"درجة تنسيق محتملة {coord}/100. تغطية إخبارية {len(news_hits)} خبر، {len(tweets)} منشور X."
    )
    summ = await battlefield_summary.summarize(facts)

    return {
        "entity": {"name": name, "type": etype}, "period": rng,
        "summary": summ.get("summary", ""), "risk_level": risk_level, "verdict": vd,
        "scores": {"attack_pressure": ap, "support_strength": ss, "advantage": adv},
        "nodes": graph["nodes"], "edges": graph["edges"], "edge_types": graph["edge_types"],
        "top_attackers": [_acc(a) for a in attackers[:8]],
        "top_supporters": [_acc(a) for a in supporters[:8]],
        "top_narratives": narrs[:6],
        "top_campaigns": ([{"hashtag": camp.get("main_hashtag"), "coordination_score": coord,
                            "level": camp.get("alert_level", {}).get("label")}] if coord >= 30 else []),
        "timeline": tl, "evidence": ev["evidence"],
        "recommended_actions": summ.get("recommended_actions", []),
        "totals": {"posts": len(tweets), "news": len(news_hits), "accounts": len(users),
                   "attackers": len(attackers), "supporters": len(supporters), "neutral": len(neutral)},
        "disclaimer": "تحليل احتمالي آلي — إشارات الهجوم/الدعم/التنسيق مؤشرات لا اتهامات قاطعة، وتتطلّب مراجعة بشرية.",
    }


async def build_national():
    """National battlefield from the precomputed digest (fast, no new X cost)."""
    from app.services import intel_digest
    dg = await intel_digest.get_digest() or {}
    ents = dg.get("entities", [])
    rs = dg.get("risk_summary", {})

    nodes, edges = [], []
    for e in sorted(ents, key=lambda x_: -x_.get("risk", 0))[:14]:
        nid = "ent:" + e["name"]
        nodes.append({"id": nid, "name": e["name"], "type": "entity",
                      "influence_score": e.get("influence", 0), "risk_score": e.get("risk", 0),
                      "reputation_score": e.get("reputation"), "activity_level": e.get("data_points", 0)})
    for n in dg.get("rising_narratives", [])[:8]:
        nid = "nar:" + n["narrative"]
        nodes.append({"id": nid, "name": n["narrative"], "type": "narrative",
                      "influence_score": min(100, n["posts"]), "sentiment_score": -1 if n.get("neg_ratio", 0) > 0.5 else 0})
        for en in n.get("entities", []):
            tid = "ent:" + en
            if any(x_["id"] == tid for x_ in nodes):
                edges.append({"id": "e_" + str(len(edges)), "source_id": nid, "target_id": tid,
                              "relationship_type": "narrative_targets" if n.get("neg_ratio", 0) > 0.5 else "narrative_supports",
                              "weight": round(n["posts"] / 8, 1), "confidence": "likely", "sentiment": "—", "evidence_count": n["posts"]})
    for c in dg.get("active_campaigns", [])[:5]:
        nodes.append({"id": "camp:" + (c.get("hashtag") or ""), "name": "#" + (c.get("hashtag") or ""),
                      "type": "campaign", "influence_score": c.get("coordination_score", 0),
                      "risk_score": c.get("coordination_score", 0)})

    pos = graph_builder.layout([n["id"] for n in nodes], [(e["source_id"], e["target_id"]) for e in edges]) if nodes else {}
    for n in nodes:
        p = pos.get(n["id"], [0.5, 0.5])
        n["x"], n["y"] = round(p[0], 3), round(p[1], 3)

    most_attacked = sorted(ents, key=lambda x_: -x_.get("risk", 0))[:5]
    most_defended = sorted(ents, key=lambda x_: -x_.get("reputation", 0))[:5]
    natl_risk = round((rs.get("political", 0) + rs.get("crisis", 0) + rs.get("campaign", 0)) / 3) if rs else 0

    facts = (
        f"عدد الكيانات المرصودة {len(ents)}. أكثرها تعرّضاً للهجوم: {'، '.join(e['name'] for e in most_attacked[:3])}. "
        f"أقوى السرديات: {'، '.join(n['narrative'] for n in dg.get('rising_narratives', [])[:3])}. "
        f"حملات نشطة: {len(dg.get('active_campaigns', []))}. مؤشرات الخطر: سياسي {rs.get('political', 0)}، أزمة {rs.get('crisis', 0)}."
    )
    summ = await battlefield_summary.summarize(facts)

    return {
        "scope": "national", "summary": summ.get("summary", "") or dg.get("executive", {}).get("brief", ""),
        "risk_level": "حرج" if natl_risk >= 70 else "مرتفع" if natl_risk >= 50 else "متوسط" if natl_risk >= 30 else "منخفض",
        "scores": {"national_risk": natl_risk, **rs},
        "nodes": nodes, "edges": edges, "edge_types": dict(Counter(e["relationship_type"] for e in edges)),
        "top_conflicts": [{"name": e["name"], "risk": e.get("risk", 0)} for e in most_attacked],
        "most_attacked": [{"name": e["name"], "risk": e.get("risk", 0), "rep_delta": e.get("rep_delta", 0)} for e in most_attacked],
        "most_defended": [{"name": e["name"], "reputation": e.get("reputation", 0)} for e in most_defended],
        "top_narratives": dg.get("rising_narratives", [])[:6],
        "top_campaigns": dg.get("active_campaigns", [])[:5],
        "platform_distribution": dg.get("platform_activity", []),
        "geo": dg.get("geo"),
        "national_sentiment": dg.get("national_sentiment", {}),
        "emotion_heatmap": dg.get("emotion_heatmap", []),
        "momentum": [{"name": e["name"],
                      "velocity": round((e.get("national_trend_probability") or 0) * 100),
                      "trajectory": e.get("trajectory"), "risk": e.get("risk", 0)}
                     for e in dg.get("rising", [])[:6]],
        "recommended_actions": summ.get("recommended_actions", []),
        "generated_at": dg.get("generated_at"),
        "disclaimer": "تحليل احتمالي آلي — يتطلّب مراجعة بشرية.",
    }
