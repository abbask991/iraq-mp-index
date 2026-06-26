"""PPOI aggregator — observed digital public opinion for a target.

Composes existing engines (stance, emotions, narratives, geo, forecast, bots,
news) with the PPOI layers (opinion detection, per-item weighting, indices,
media–public gap). Enhanced: target-aware AI classification (accuracy), ALL
platforms folded in (X + news + Apify-collected cross-platform), and opinion
drift over time (snapshots). Honest framing on every result.
"""
import math
from collections import Counter
from datetime import datetime

from app.services import emotions, forecast, geo, narrative_engine, network, news, trends, x
from app.services.collection import smart_classify
from app.services.opinion import ai_opinion, drift, indices, media_public_gap
from app.services.opinion.summary import summarize

EMO_AR = {"anger": "غضب", "trust": "ثقة", "fear": "خوف", "hope": "أمل", "sadness": "حزن",
          "sarcasm": "سخرية", "satisfaction": "رضا", "frustration": "إحباط", "neutral": "محايد"}


def _logn(v, k=20):
    return min(100, math.log10((v or 0) + 1) * k)


def _series(items):
    hours = Counter()
    for p in items:
        try:
            dt = datetime.fromisoformat((p.get("created_at") or "").replace("Z", "+00:00"))
            hours[dt.strftime("%m-%d %H")] += 1
        except Exception:
            pass
    return [c for _, c in sorted(hours.items())]


async def build_opinion(target: str, rng: str = "day", limit: int = 400) -> dict:
    import time as _t
    target = (target or "").strip()
    if not target:
        return {"error": "missing target"}

    # ---- collect from ALL platforms ----
    tw = await x.fetch_trend(target, want=limit, range=rng)
    tweets = tw.get("tweets", []) if "error" not in tw else []
    users = tw.get("users", {}) if "error" not in tw else {}
    news_hits = await news.fetch_news([target], cap=40, range=rng)

    items = []                                       # unified opinion items
    for t in tweets:
        u = users.get(t.get("author_id"), {})
        items.append({"text": t.get("text", ""), "platform": "x", "created_at": t.get("created_at"),
                      "engagement": t.get("engagement", 0),
                      "followers": u.get("public_metrics", {}).get("followers_count", 0) if u else 0,
                      "verified": bool(u.get("verified")), "is_bot": bool(u and network.bot_score(u)[0] > 60)})
    # Apify-collected cross-platform (stored)
    cross_n = 0
    try:
        from app.services.fusion import store
        for r in await store.query(target, limit=300):
            cross_n += 1
            eng = (r.get("likes", 0) or 0) + (r.get("comments", 0) or 0) + (r.get("shares", 0) or 0)
            items.append({"text": r.get("text", ""), "platform": r.get("platform", "other"),
                          "created_at": r.get("created_at"), "engagement": eng,
                          "followers": r.get("author_followers", 0) or 0, "verified": False, "is_bot": False})
    except Exception:
        pass
    # news as a platform
    for h in news_hits:
        items.append({"text": h.get("title", ""), "platform": "news", "created_at": h.get("date"),
                      "engagement": 0, "followers": 0, "verified": False, "is_bot": False, "is_news": True})

    if not items:
        return {"error": tw.get("error") or "NO_DATA", "target": target}

    # ---- target-aware classification (AI, accurate; rule fallback) ----
    verdicts = await ai_opinion.classify(target, items)

    support_w = oppose_w = 0.0
    opinions = bots = 0
    complaints, praises = [], []
    platforms_seen, plat_op = set(), Counter()
    emo_counts = Counter()
    public_items = []                                # non-news opinion items (for emotions/pressure)

    for it, v in zip(items, verdicts):
        plat = it["platform"]
        if it.get("is_bot"):
            bots += 1
        if not v.get("is_opinion"):
            continue
        opinions += 1
        platforms_seen.add(plat)
        plat_op[plat] += 1
        if not it.get("is_news"):
            public_items.append(it)
        pw = indices.PLATFORM_WEIGHTS.get(plat, 0.5)
        w = indices.opinion_weight(
            author_influence=min(100, _logn(it["followers"], 11)),
            engagement_quality=_logn(it["engagement"], 16),
            source_credibility=85 if it.get("is_news") else 70 if it["verified"] else 50,
            opinion_confidence=0.7, cross_platform=20 if plat != "x" else 0,
            originality=75, freshness=70)
        w *= pw * (0.4 if it.get("is_bot") else 1.0)
        st = v.get("stance")
        if st == "support":
            support_w += w
        elif st == "oppose":
            oppose_w += w
        emo = v.get("emotion")
        if emo and emo != "neutral":
            emo_counts[EMO_AR.get(emo, emo)] += 1
        if st == "oppose" and len(complaints) < 6:
            complaints.append(it["text"][:160])
        elif st == "support" and len(praises) < 6:
            praises.append(it["text"][:160])

    # emotions: from AI verdicts if present, else rule aggregate over public text
    if emo_counts:
        tot_e = sum(emo_counts.values())
        emo = {k: round(v / tot_e * 100) for k, v in emo_counts.most_common()}
    else:
        emo = emotions.aggregate([p["text"] for p in public_items])
    anger = emo.get("غضب", 0) / 100
    frustration = emo.get("إحباط", 0) / 100
    trust = emo.get("ثقة", 0) / 100
    satisfaction = emo.get("رضا", 0) / 100

    tot_w = support_w + oppose_w
    support_frac = support_w / tot_w if tot_w else 0
    oppose_frac = oppose_w / tot_w if tot_w else 0
    pos_score = indices.public_opinion_score(support_w, oppose_w)
    poi = indices.public_opinion_index(support=support_frac, oppose=oppose_frac, anger=anger,
                                       frustration=frustration, trust=trust, satisfaction=satisfaction)

    # pressure
    pub_total = len(public_items) or 1
    neg = sum(1 for it, v in zip(items, verdicts) if v.get("stance") == "oppose" and not it.get("is_news"))
    series = _series([it for it in items if it["platform"] != "news"])
    vel = min(100, max(0, forecast.velocity(series)) * 16) if len(series) >= 2 else 0
    infl_amp = min(100, sum(1 for it in public_items if it["followers"] > 30000) / pub_total * 200)
    complaint_ratio = len(complaints) / max(1, opinions) * 100
    pressure = indices.public_pressure_index(
        neg_volume=neg / pub_total * 100, anger=anger * 100, velocity=vel,
        cross_platform=len(platforms_seen) * 18, influencer_amplification=infl_amp,
        complaint_ratio=complaint_ratio, coordination=0)

    narrs = narrative_engine.narratives([{"title": p["text"], "type": "عام"} for p in public_items])
    heat = geo.aggregate(users)

    # media–public gap
    news_v = [v for it, v in zip(items, verdicts) if it.get("is_news")]
    n_sup = sum(1 for v in news_v if v.get("stance") == "support")
    n_opp = sum(1 for v in news_v if v.get("stance") == "oppose")
    media_score = ((n_sup - n_opp) / len(news_hits) * 100) if news_hits else 0
    gap = media_public_gap.gap(media_score, pos_score)

    conf = indices.confidence_score(
        n=opinions, platforms=len(platforms_seen), sources=len(users) + cross_n,
        bot_cleanliness=round((1 - bots / (len(tweets) or 1)) * 100), classification_conf=75 if verdicts and verdicts[0].get("source") == "ai" else 55,
        time_stability=60, geo_coverage=round(heat["located"] / max(1, heat["total_accounts"]) * 100))

    direction = "worsening" if (oppose_frac > support_frac and vel > 30) else "improving" if support_frac > oppose_frac and vel > 30 else "stable"
    forecast_out = {
        "expected_direction": {"worsening": "تصاعد سلبي", "improving": "تحسّن", "stable": "مستقر"}[direction],
        "probability": round(min(0.9, 0.5 + vel / 200 + abs(support_frac - oppose_frac) * 0.3), 2),
        "confidence": round(conf["score"] / 100 * 0.9, 2),
        "reason": f"المواقف {'المعارضة' if oppose_frac>support_frac else 'المؤيدة'} {'تتسارع' if vel>30 else 'مستقرة'} عبر {len(platforms_seen)} منصّة.",
    }

    emo_top = sorted(emo.items(), key=lambda i: -i[1])
    out = {
        "target": target, "period": rng, "generated_at": int(_t.time()),
        "public_opinion_index": poi, "public_opinion_label": indices.opinion_label(poi),
        "public_opinion_score": pos_score, "public_pressure_index": pressure,
        "support_percent": round(support_frac * 100), "oppose_percent": round(oppose_frac * 100),
        "neutral_percent": max(0, 100 - round(support_frac * 100) - round(oppose_frac * 100)),
        "dominant_emotion": emo_top[0][0] if emo_top and emo_top[0][1] > 0 else "محايد",
        "emotions": dict(emo_top),
        "top_complaints": complaints, "top_support_arguments": praises,
        "top_narratives": [{"narrative": n["narrative"], "share": n["share"]} for n in narrs[:5]],
        "platform_breakdown": {p: {"opinions": c, "weight": indices.PLATFORM_WEIGHTS.get(p, 0.5)} for p, c in plat_op.items()},
        "geo_breakdown": heat,
        "confidence_score": conf["score"], "confidence_label": conf["label"], "directional": conf["directional"],
        "classifier": "ai" if (verdicts and verdicts[0].get("source") == "ai") else "rule",
        "media_public_gap": gap, "forecast": forecast_out,
        "sample": {"opinions": opinions, "posts_scanned": len(tweets), "news": len(news_hits),
                   "cross_platform": cross_n, "platforms": sorted(platforms_seen),
                   "bots_downweighted": bots, "accounts": len(users)},
        "disclaimer": ("يعكس هذا تعبيراً عاماً مرصوداً عبر منصّات رقمية، وليس استطلاعاً تمثيلياً إحصائياً. "
                       f"الثقة: {conf['label']} ({conf['score']}/100)."
                       + (" النتيجة توجيهية لا قاطعة." if conf["directional"] else "")),
    }
    out["ai_summary"] = await summarize(out)
    out["recommended_action"] = out["ai_summary"].get("recommended_action") or (
        "تجهيز توضيح خلال 6 ساعات" if pressure >= 70 else "المتابعة والرصد")

    # drift: store this snapshot + compute change over time
    await drift.store_snapshot(target, out)
    out["drift"] = await drift.compute(target)

    # progressive cross-platform enrichment (background, throttled) so next builds are richer
    try:
        import asyncio

        from app.services import redis_client
        from app.services.social import cross_platform
        if await redis_client.setnx(f"enrich:{target}", "1", 21600):
            asyncio.create_task(cross_platform.enrich_entity(target, limit=10))
    except Exception:
        pass

    return out
