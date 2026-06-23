"""Media Share of Voice (SOV).

Weighted attention across compared entities — not just mention count, but also
engagement, estimated reach, source weight, prominence, and quality. Returns
total SOV %, sentiment-adjusted SOV, platform SOV, and risk alerts.

Modules (spec → here):
  engagement_calculator → per-entity engagement sum
  reach_estimator       → followers (X) + news readership proxy
  source_weighting      → SOURCE_WEIGHT / X influence
  prominence_detector   → alias-in-title vs body
  quality_scorer        → credible-account / source share
  share_of_voice_calc   → compute()
  period_comparison     → (needs history → noted, not stored yet)
"""
from collections import Counter

from app.services import network, trends

W = {"mentions": 0.30, "engagement": 0.20, "reach": 0.15,
     "source": 0.15, "prominence": 0.10, "quality": 0.10}
NEWS_SOURCE_WEIGHT = 7.0     # news outlet baseline (serious source)
NEWS_REACH = 8000            # avg readership proxy per article


def _entity_raw(e: dict) -> dict:
    """e = {name, aliases, x_tweets(+sentiment), x_users, news_hits(+sentiment)}."""
    xt, users, news = e["x_tweets"], e["x_users"], e["news_hits"]
    aliases = [a.lower() for a in (e.get("aliases") or [e["name"]])]

    mentions = len(xt) + len(news)
    engagement = sum(int(t.get("engagement") or 0) for t in xt)

    # reach
    reach = sum(users.get(t["author_id"], {}).get("public_metrics", {}).get("followers_count", 0) for t in xt)
    reach += len(news) * NEWS_REACH

    # source weight (X influence 1-10 + news baseline)
    sw = [trends.influence_score(users.get(t["author_id"], {})) for t in xt]
    sw += [NEWS_SOURCE_WEIGHT] * len(news)
    source_weight = sum(sw) / len(sw) if sw else 0

    # prominence: news title containing an alias = main subject; X = subject by query
    prom = [0.8 for _ in xt]
    for h in news:
        title = (h.get("title") or "").lower()
        prom.append(1.0 if any(a in title for a in aliases) else 0.5)
    prominence = sum(prom) / len(prom) if prom else 0

    # quality: credible (non-bot) X accounts + news baseline
    q = [1 - network.bot_score(users.get(t["author_id"], {}))[0] / 100 for t in xt]
    q += [0.8] * len(news)
    quality = sum(q) / len(q) if q else 0

    sent = Counter((t.get("sentiment") or "محايد") for t in xt)
    for h in news:
        sent[h.get("sentiment") or "محايد"] += 1

    types = Counter(t.get("type") for t in xt if t.get("type"))
    for h in news:
        if h.get("type"):
            types[h["type"]] += 1
    narrative = trends.NARRATIVE_MAP.get(types.most_common(1)[0][0], "نقاش عام") if types else "نقاش عام"

    src_counter = Counter([t.get("source") for t in xt] + [h.get("source") for h in news])
    x_count, news_count = len(xt), len(news)

    return {
        "name": e["name"], "mentions": mentions, "engagement": engagement, "reach": reach,
        "source_weight": round(source_weight, 1), "prominence": round(prominence, 2),
        "quality": round(quality, 2),
        "pos": sent.get("إيجابي", 0), "neg": sent.get("سلبي", 0), "neu": sent.get("محايد", 0),
        "narrative": narrative,
        "platform": {"news": news_count, "x": x_count},
        "main_platform": "X" if x_count >= news_count else "أخبار",
        "top_sources": [s for s, _ in src_counter.most_common(5) if s],
    }


def _alerts(r: dict, sov: float) -> list:
    out = []
    tot_sent = r["pos"] + r["neg"] + r["neu"]
    neg_ratio = (r["neg"] / tot_sent) if tot_sent else 0
    if sov >= 40 and neg_ratio >= 0.6:
        out.append("⚠️ خطر سمعة: حضور مرتفع بنبرة سلبية غالبة")
    if sov >= 50:
        out.append("📢 هيمنة على المحادثة")
    return out


def compute(entity_inputs: list, category: str = "") -> dict:
    raws = [_entity_raw(e) for e in entity_inputs]
    raws = [r for r in raws if r["mentions"] > 0]
    if not raws:
        return {"category": category, "entities": []}

    def mx(key):
        return max((r[key] for r in raws), default=0) or 1
    maxes = {k: mx(k) for k in ("mentions", "engagement", "reach", "source_weight", "prominence", "quality")}

    for r in raws:
        score = (W["mentions"] * r["mentions"] / maxes["mentions"]
                 + W["engagement"] * r["engagement"] / maxes["engagement"]
                 + W["reach"] * r["reach"] / maxes["reach"]
                 + W["source"] * r["source_weight"] / maxes["source_weight"]
                 + W["prominence"] * r["prominence"] / maxes["prominence"]
                 + W["quality"] * r["quality"] / maxes["quality"])
        r["_score"] = score

    total = sum(r["_score"] for r in raws) or 1
    tot_pos = sum(r["pos"] for r in raws) or 1
    tot_neg = sum(r["neg"] for r in raws) or 1
    tot_neu = sum(r["neu"] for r in raws) or 1

    for r in raws:
        r["share_of_voice"] = round(r["_score"] / total * 100, 1)
        r["positive_sov"] = round(r["pos"] / tot_pos * 100, 1)
        r["negative_sov"] = round(r["neg"] / tot_neg * 100, 1)
        r["neutral_sov"] = round(r["neu"] / tot_neu * 100, 1)
        ts = r["pos"] + r["neg"] + r["neu"]
        r["dominant_sentiment"] = ("سلبي" if r["neg"] > r["pos"] and r["neg"] > r["neu"]
                                   else "إيجابي" if r["pos"] > r["neu"] else "محايد")
        r["alerts"] = _alerts(r, r["share_of_voice"])
        r.pop("_score", None)

    raws.sort(key=lambda r: -r["share_of_voice"])
    for i, r in enumerate(raws):
        r["rank"] = i + 1

    leader = raws[0]
    report = (f"«{leader['name']}» تصدّر المحادثة بـ{leader['share_of_voice']}% من الحضور الإعلامي الموزون"
              f"{' — لكن بنبرة سلبية غالبة (تحذير سمعة)' if leader['dominant_sentiment']=='سلبي' and leader['share_of_voice']>=40 else ''}.")

    return {
        "category": category, "entities": raws,
        "report": report,
        "note": "الحضور المرتفع لا يعني إيجابياً بالضرورة — قد يكون أزمة. مقارنة الفترة السابقة تحتاج تخزيناً تاريخياً (لاحقاً).",
    }
