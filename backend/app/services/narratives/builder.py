"""Narrative War Room orchestration — assembles the dashboard (today's active
narratives) and the per-narrative deep view (the 8 sections: evolution, timeline,
battlefield, network, heatmap, forecast, DNA, AI summary). One X fetch powers the
whole detail; everything is cached (Redis SWR) by the router.
"""
import re
from collections import Counter
from datetime import datetime

from app.services import ai, geo, narrative_engine, news, x
from app.services.media_battlefield import battlefield_timeline
from app.services.narratives import (
    battlefield, clustering, discovery, dna as dna_mod, dominance,
    evolution as evo, forecast as nfc, summary as nsum,
)

_HASH = re.compile(r"#[\w؀-ۿ_]+")


async def build_dashboard(rng="day", limit=600):
    """Section 1 source — today's active narratives, scored + ranked."""
    res = await discovery.discover_national(rng=rng, limit=limit)
    narrs = res.get("narratives", [])
    if len(narrs) > 1:
        narrs = clustering.merge_similar(narrs, threshold=0.6)
        narrs.sort(key=lambda n: -n.get("dominance", 0))
    import time
    return {
        "narratives": narrs[:18],
        "scanned": res.get("scanned", 0),
        "accounts": res.get("accounts", 0),
        "range": rng,
        "error": res.get("error"),
        "generated_at": int(time.time()),
        "disclaimer": "اكتشاف آلي للسرديات بالتجميع الدلالي (لا يعتمد على الهاشتاغات فقط) — يتطلّب مراجعة بشرية.",
    }


def _series(posts):
    hours = Counter()
    for p in posts:
        try:
            dt = datetime.fromisoformat((p.get("created_at") or "").replace("Z", "+00:00"))
            hours[dt.strftime("%m-%d %H")] += 1
        except Exception:
            pass
    return [c for _, c in sorted(hours.items())]


async def build_detail(term, rng="week", limit=300):
    import time
    tw = await x.fetch_trend(term, want=limit, range=rng)
    if "error" in tw:
        return {"error": tw["error"], "message": "تعذّر — تأكد من توكن X", "narrative": {"name": term}}
    tweets, users = tw["tweets"], tw["users"]
    if tweets:
        cls = await ai.classify_all([t["text"] for t in tweets])
        for t, c in zip(tweets, cls):
            t["sentiment"], t["type"] = c.get("sentiment", "محايد"), c.get("type", "عام")
    news_hits = await news.fetch_news([term], cap=50, range=rng)
    if news_hits:
        ncls = await ai.classify_all([h["title"] for h in news_hits])
        for h, c in zip(news_hits, ncls):
            h["sentiment"] = c.get("sentiment", "محايد")

    posts = [{"title": t["text"], "type": t.get("type", "عام"), "sentiment": t.get("sentiment"),
              "created_at": t.get("created_at")} for t in tweets]
    narrs = narrative_engine.narratives(posts)
    lead = narrs[0] if narrs else {"narrative": term, "keywords": [], "share": 0, "neg_ratio": 0}

    total = len(tweets) or 1
    neg = sum(1 for t in tweets if t.get("sentiment") == "سلبي")
    pos = sum(1 for t in tweets if t.get("sentiment") == "إيجابي")
    neg_ratio = neg / total
    sentiment = {"negative": round(neg / total * 100), "positive": round(pos / total * 100),
                 "neutral": round((total - neg - pos) / total * 100)}

    # battlefield (sides, media, campaigns, network)
    bf = battlefield.build(term, tweets, users, news_hits, narrs)
    coord = bf["coordination_score"]

    # signals
    followers = [u.get("followers", 0) for u in users.values()] if isinstance(users, dict) else []
    avg_fol = round(sum(followers) / len(followers)) if followers else 0
    infl = min(100, sum(1 for f in followers if f > 30000) / max(1, len(followers)) * 200)
    series = _series(tweets)
    vel = 0
    from app.services import forecast as _fc
    if len(series) >= 2:
        vel = min(100, max(0.0, _fc.velocity(series)) * 16)
    pers = min(100, _fc.persistence(series) * 100) if len(series) >= 2 else 0
    eng = min(100, (sum(t.get("engagement", 0) for t in tweets) / total) / 12)
    media_n = min(100, len(news_hits) * 6)
    cross = 100 if (news_hits and tweets) else 55

    dom = dominance.dominance(mention_share=lead.get("share", 0), velocity=vel, cross_platform=cross,
                              influencer=infl, media=media_n, engagement=eng, persistence=pers)
    thr = dominance.threat(sentiment_neg=neg_ratio * 100, coordination=coord,
                           attack_pressure=neg_ratio * 90, reach=infl, velocity=vel,
                           media=media_n, political=min(100, lead.get("share", 0) * 1.5))

    # geo heatmap
    heat = geo.aggregate(users)

    # forecast
    fcast = nfc.predict(series, avg_followers=avg_fol, neg_ratio=neg_ratio, coordination=coord,
                        influencer=infl, media_present=bool(news_hits))

    # evolution
    lifecycle = evo.lifecycle(posts, window="hour")

    # timeline (cross-platform chronological)
    tl = battlefield_timeline.build(tweets, news_hits, {"campaign_score": coord})

    # DNA
    hashtags = Counter(h for t in tweets for h in _HASH.findall(t.get("text", "")))
    fp = dna_mod.fingerprint(
        keywords=lead.get("keywords"), entities=[en for en in (lead.get("entities") or [])],
        hashtags=[h for h, _ in hashtags.most_common(10)],
        campaigns=[c["hashtag"] for c in bf["campaigns"]],
        emotions={"غضب": neg_ratio, "أمل": pos / total}, platforms=["X"] + (["news"] if news_hits else []),
        media=[m["source"] for m in bf["media"]], geo=[g["name"] for g in heat["top"]],
        influencers=[a["username"] for a in bf["influencers"][:5]])
    similar = await dna_mod.compare_with_known(fp, top=3)

    # AI intelligence summary
    facts = (
        f"السردية: {lead['narrative']}. كلمات مفتاحية: {'، '.join(lead.get('keywords', [])[:6]) or '—'}. "
        f"هيمنة {dom}/100، تهديد {thr['score']}/100 ({thr['label']}). "
        f"المنشورات {len(tweets)}، الأخبار {len(news_hits)}. سلبي {sentiment['negative']}% / إيجابي {sentiment['positive']}%. "
        f"داعمون {bf['counts']['supporters']} (أبرزهم {'، '.join('@'+(a['username'] or '') for a in bf['supporters'][:3]) or '—'})، "
        f"معارضون {bf['counts']['opponents']} (أبرزهم {'، '.join('@'+(a['username'] or '') for a in bf['opponents'][:3]) or '—'}). "
        f"إعلام يضخّمها: {'، '.join(m['source'] for m in bf['media'][:3]) or '—'}. تنسيق محتمل {coord}/100. "
        f"احتمال النمو {fcast['growth_probability']}%، تصعيد سياسي {fcast['political_escalation_probability']}%."
    )
    ai_summary = await nsum.summarize(facts)

    return {
        "narrative": {"id": re.sub(r"\s+", "-", term)[:40], "name": lead["narrative"], "query": term,
                      "type": lead.get("type"), "keywords": lead.get("keywords", [])},
        "period": rng, "generated_at": int(time.time()),
        "dominance": dom, "threat": thr, "sentiment": sentiment,
        "metrics": {"posts": len(tweets), "news": len(news_hits), "accounts": len(users),
                    "growth_rate": round(vel), "coordination": coord, "avg_followers": avg_fol},
        "evolution": lifecycle,           # section 2
        "timeline": tl,                   # section 3
        "battlefield": {k: bf[k] for k in ("supporters", "opponents", "influencers", "media",
                                           "campaigns", "counts")},  # section 4
        "network": {"nodes": bf["nodes"], "edges": bf["edges"], "edge_types": bf["edge_types"]},  # section 5
        "heatmap": heat,                  # section 6
        "forecast": fcast,                # section 7
        "ai_summary": ai_summary,         # section 8
        "dna": {"fingerprint": fp, "similar": similar},
        "evidence": bf["evidence"],
        "top_narratives": narrs[:6],
        "disclaimer": "تحليل احتمالي آلي — إشارات الدعم/المعارضة/التنسيق مؤشرات لا اتهامات قاطعة، وتتطلّب مراجعة بشرية.",
    }
