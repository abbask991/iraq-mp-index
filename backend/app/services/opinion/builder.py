"""PPOI aggregator — turns observed public expression into measurable opinion
intelligence for a target (entity/topic). Composes the existing engines (stance,
emotions, narratives, geo, forecast, bot-filter, news) with the new PPOI layers
(opinion detection, per-item weighting, indices, media–public gap).

Honest framing: outputs are "observed digital public opinion", NOT a
representative survey — every result carries sample size, period, confidence,
platform coverage, and limitations.
"""
import math
from collections import Counter
from datetime import datetime

from app.services import emotions, forecast, geo, narrative_engine, network, news, trends, x
from app.services.collection import smart_classify
from app.services.opinion import indices, media_public_gap, opinion_detector
from app.services.opinion.summary import summarize


def _logn(v, k=20):
    return min(100, math.log10((v or 0) + 1) * k)


def _series(posts):
    hours = Counter()
    for p in posts:
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

    tw = await x.fetch_trend(target, want=limit, range=rng)
    tweets = tw.get("tweets", []) if "error" not in tw else []
    users = tw.get("users", {}) if "error" not in tw else {}
    news_hits = await news.fetch_news([target], cap=40, range=rng)

    # sentiment for all (cheap, clustered)
    all_texts = [t.get("text", "") for t in tweets] + [h.get("title", "") for h in news_hits]
    if all_texts:
        cls, _ = await smart_classify.classify_posts([{"text": x_} for x_ in all_texts])
    else:
        cls = []
    for t, c in zip(tweets, cls[:len(tweets)]):
        t["sentiment"] = c.get("sentiment", "محايد")
        t["type"] = c.get("type", "عام")

    # ---- per-item opinion processing (X = the public) ----
    support_w = oppose_w = 0.0
    opinions = 0
    complaints, praises = [], []
    bots = 0
    platforms_seen = {"x"}
    plat_support = Counter()
    plat_total = Counter()
    for t in tweets:
        u = users.get(t.get("author_id"), {})
        is_bot = u and network.bot_score(u)[0] > 60
        if is_bot:
            bots += 1
        det = opinion_detector.detect(t.get("text", ""))
        if not det["is_opinion"]:
            continue
        opinions += 1
        st = trends_stance(t.get("text", ""))
        fol = u.get("public_metrics", {}).get("followers_count", 0) if u else 0
        w = indices.opinion_weight(
            author_influence=trends.influence_score(u) * 10 if u else 10,
            engagement_quality=_logn(t.get("engagement", 0), 16),
            source_credibility=70 if u.get("verified") else 50,
            opinion_confidence=det["confidence"],
            cross_platform=0, originality=60 if t.get("text", "").startswith("RT") else 75,
            freshness=70)
        w *= indices.PLATFORM_WEIGHTS["x"] * (0.4 if is_bot else 1.0)   # downweight bots, don't delete
        if st == "support":
            support_w += w
            plat_support["x"] += 1
        elif st == "oppose":
            oppose_w += w
            plat_total["x"]  # noqa
        if st in ("support", "oppose"):
            plat_total["x"] += 1
        if det["opinion_type"] == "complaint" and len(complaints) < 6:
            complaints.append(t.get("text", "")[:160])
        elif det["opinion_type"] == "praise" and len(praises) < 6:
            praises.append(t.get("text", "")[:160])

    # emotions over the public (opinion-bearing) texts
    emo = emotions.aggregate([t.get("text", "") for t in tweets])
    anger = emo.get("غضب", emo.get("anger", 0)) / 100
    frustration = emo.get("إحباط", emo.get("frustration", 0)) / 100
    trust = emo.get("ثقة", emo.get("trust", 0)) / 100
    satisfaction = emo.get("رضا", emo.get("satisfaction", 0)) / 100

    tot_w = support_w + oppose_w
    support_frac = support_w / tot_w if tot_w else 0
    oppose_frac = oppose_w / tot_w if tot_w else 0
    pos_score = indices.public_opinion_score(support_w, oppose_w)         # -100..100
    poi = indices.public_opinion_index(support=support_frac, oppose=oppose_frac,
                                       anger=anger, frustration=frustration,
                                       trust=trust, satisfaction=satisfaction)

    # pressure
    neg = sum(1 for t in tweets if t.get("sentiment") == "سلبي")
    total_posts = len(tweets) or 1
    series = _series(tweets)
    vel = min(100, max(0, forecast.velocity(series)) * 16) if len(series) >= 2 else 0
    infl_amp = min(100, sum(1 for u in users.values() if u.get("public_metrics", {}).get("followers_count", 0) > 30000) / max(1, len(users)) * 200)
    complaint_ratio = len(complaints) / max(1, opinions) * 100
    pressure = indices.public_pressure_index(
        neg_volume=neg / total_posts * 100, anger=anger * 100, velocity=vel,
        cross_platform=len(platforms_seen) * 20, influencer_amplification=infl_amp,
        complaint_ratio=complaint_ratio, coordination=0)

    # narratives + geo
    narrs = narrative_engine.narratives(
        [{"title": t["text"], "type": t.get("type", "عام"), "sentiment": t.get("sentiment")} for t in tweets])
    heat = geo.aggregate(users)

    # media–public gap
    npos = sum(1 for c in cls[len(tweets):] if c.get("sentiment") == "إيجابي")
    nneg = sum(1 for c in cls[len(tweets):] if c.get("sentiment") == "سلبي")
    media_score = ((npos - nneg) / len(news_hits) * 100) if news_hits else 0
    gap = media_public_gap.gap(media_score, pos_score)

    # confidence (honest)
    conf = indices.confidence_score(
        n=opinions, platforms=len(platforms_seen), sources=len(users),
        bot_cleanliness=round((1 - bots / total_posts) * 100), classification_conf=60,
        time_stability=60, geo_coverage=round(heat["located"] / max(1, heat["total_accounts"]) * 100))

    # forecast
    fc = forecast.forecast(series) if len(series) >= 3 else {}
    direction = "worsening" if (oppose_frac > support_frac and vel > 30) else "improving" if support_frac > oppose_frac and vel > 30 else "stable"
    forecast_out = {
        "expected_direction": {"worsening": "تصاعد سلبي", "improving": "تحسّن", "stable": "مستقر"}[direction],
        "probability": round(min(0.9, 0.5 + vel / 200 + abs(support_frac - oppose_frac) * 0.3), 2),
        "confidence": round(conf["score"] / 100 * 0.9, 2),
        "reason": f"المواقف {'المعارضة' if oppose_frac>support_frac else 'المؤيدة'} {'تتسارع' if vel>30 else 'مستقرة'} عبر X والأخبار.",
    }

    emo_top = sorted(emo.items(), key=lambda i: -i[1])
    dominant_emotion = emo_top[0][0] if emo_top and emo_top[0][1] > 0 else "محايد"

    out = {
        "target": target, "period": rng, "generated_at": int(_t.time()),
        "public_opinion_index": poi, "public_opinion_label": indices.opinion_label(poi),
        "public_opinion_score": pos_score,
        "public_pressure_index": pressure,
        "support_percent": round(support_frac * 100), "oppose_percent": round(oppose_frac * 100),
        "neutral_percent": max(0, 100 - round(support_frac * 100) - round(oppose_frac * 100)),
        "dominant_emotion": dominant_emotion, "emotions": dict(emo_top),
        "top_complaints": complaints, "top_support_arguments": praises,
        "top_narratives": [{"narrative": n["narrative"], "share": n["share"]} for n in narrs[:5]],
        "platform_breakdown": {"x": {"opinions": opinions, "weight": indices.PLATFORM_WEIGHTS["x"]}},
        "geo_breakdown": heat,
        "confidence_score": conf["score"], "confidence_label": conf["label"], "directional": conf["directional"],
        "media_public_gap": gap,
        "forecast": forecast_out,
        "sample": {"opinions": opinions, "posts_scanned": len(tweets), "news": len(news_hits),
                   "bots_downweighted": bots, "accounts": len(users)},
        "disclaimer": ("يعكس هذا تعبيراً عاماً مرصوداً عبر منصّات رقمية، وليس استطلاعاً تمثيلياً إحصائياً. "
                       f"الثقة: {conf['label']} ({conf['score']}/100)."
                       + (" النتيجة توجيهية لا قاطعة." if conf["directional"] else "")),
    }
    out["ai_summary"] = await summarize(out)
    out["recommended_action"] = out["ai_summary"].get("recommended_action") or (
        "تجهيز توضيح خلال 6 ساعات" if pressure >= 70 else "المتابعة والرصد")
    return out


def trends_stance(text):
    from app.services import stance
    s = stance.classify_stance(text)["stance"]
    return "support" if s == "support" else "oppose" if s in ("oppose", "sarcastic") else "neutral"
