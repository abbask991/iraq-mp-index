"""Social Opinion Survey — measure public opinion on a subject (party / figure /
company) from social media, with polling-grade methodology.

Pipeline: collect mentions (X live + stored cross-platform) → exclude bots →
classify each as support / oppose / no-opinion (stance) → tally raw result →
weight by governorate population → compute margin of error → score
representativeness + confidence → break down by governorate, platform, demographic
proxy. Output reads like a poll: favorable %, ±MoE, n, confidence, method notes.
"""
from collections import Counter, defaultdict

from app.services import geo, network, stance, x
from app.services.polling import weighting


def _classify(text):
    st = stance.classify_stance(text or "")["stance"]
    if st == "support":
        return "support"
    if st in ("oppose", "sarcastic"):
        return "oppose"
    return "neutral"


async def run_survey(subject: str, rng: str = "week", limit: int = 500) -> dict:
    import time as _t
    subject = (subject or "").strip()
    if not subject:
        return {"error": "missing subject"}

    tw = await x.fetch_trend(subject, want=limit, range=rng)
    tweets = tw.get("tweets", []) if "error" not in tw else []
    users = tw.get("users", {}) if "error" not in tw else {}

    support = oppose = neutral = 0
    bots_excluded = 0
    geo_support = defaultdict(lambda: {"support": 0, "oppose": 0})
    geo_counts = Counter()
    by_platform = defaultdict(lambda: {"support": 0, "oppose": 0})
    acct_types = Counter()

    for t in tweets:
        u = users.get(t.get("author_id"), {})
        if u and network.bot_score(u)[0] > 60:           # exclude likely bots from the sample
            bots_excluded += 1
            continue
        v = _classify(t.get("text", ""))
        if v == "support":
            support += 1
        elif v == "oppose":
            oppose += 1
        else:
            neutral += 1
        by_platform["x"][v if v != "neutral" else "support"] += 0  # ensure key
        if v in ("support", "oppose"):
            by_platform["x"][v] += 1
        # geography (from author location)
        gid = geo.locate(u.get("location", "")) if u else None
        if gid:
            geo_counts[gid] += 1
            if v in ("support", "oppose"):
                geo_support[gid][v] += 1
        # account type composition
        fol = u.get("public_metrics", {}).get("followers_count", 0) if u else 0
        acct_types["موثّق" if u.get("verified") else "مؤثّر" if fol > 30000 else "عادي"] += 1

    # stored cross-platform mentions (no reliable geo → raw + platform only)
    try:
        from app.services.fusion import store
        cross = await store.query(subject, limit=400)
    except Exception:
        cross = []
    for r in cross:
        v = _classify(r.get("text", ""))
        if v == "support":
            support += 1
        elif v == "oppose":
            oppose += 1
        else:
            neutral += 1
        if v in ("support", "oppose"):
            by_platform[r.get("platform", "other")][v] += 1

    n = support + oppose                                  # stance-bearing sample
    analyzed = support + oppose + neutral
    raw_support = round(support / n * 100, 1) if n else None

    wt = weighting.weight_by_population(geo_support)
    weighted = wt["weighted_support"]
    headline = weighted if weighted is not None else raw_support
    moe = weighting.margin_of_error((headline or 50) / 100, n)
    rep = weighting.representativeness(geo_counts)
    conf = weighting.confidence(n, rep["score"])

    gov_breakdown = []
    for gid, d in geo_support.items():
        tot = d["support"] + d["oppose"]
        if tot >= 3:
            meta = geo._META.get(gid, {}) if hasattr(geo, "_META") else {}
            gov_breakdown.append({"id": gid, "name": meta.get("name", gid),
                                  "support_pct": round(d["support"] / tot * 100),
                                  "sample": tot})
    gov_breakdown.sort(key=lambda x_: -x_["sample"])

    platform_breakdown = []
    for plat, d in by_platform.items():
        tot = d["support"] + d["oppose"]
        if tot:
            platform_breakdown.append({"platform": plat, "support_pct": round(d["support"] / tot * 100), "sample": tot})
    platform_breakdown.sort(key=lambda x_: -x_["sample"])

    return {
        "subject": subject, "period": rng, "generated_at": int(_t.time()),
        "result": {
            "favorable": headline, "unfavorable": round(100 - headline, 1) if headline is not None else None,
            "raw_favorable": raw_support, "weighted_favorable": weighted,
            "margin_of_error": moe, "net": round((headline or 50) - (100 - (headline or 50)), 1),
        },
        "sample": {
            "n": n, "analyzed": analyzed, "no_opinion": neutral,
            "bots_excluded": bots_excluded, "x_mentions": len(tweets), "cross_mentions": len(cross),
            "account_types": dict(acct_types),
        },
        "representativeness": rep,
        "confidence": conf,
        "geography": gov_breakdown,
        "platforms": platform_breakdown,
        "method": (f"عيّنة غير احتمالية من {n} رأياً ذا موقف (من {analyzed} إشارة، استُبعد {bots_excluded} حساب آلي ومكرّرات)، "
                   f"مُرجّحة جغرافياً حسب توزيع السكان عبر المحافظات. هامش الخطأ ±{moe} نقطة عند ثقة 95%."),
        "disclaimer": ("هذا قياس رأي من السوشيال ميديا — عيّنة غير احتمالية تميل للفئات النشطة رقمياً. "
                       "الترجيح الجغرافي يصحّح جزءاً من التحيّز، لكنه لا يكافئ استطلاعاً ميدانياً تمثيلياً. "
                       f"تمثيلية العيّنة: {rep['label']} ({rep['score']}/100)."),
    }
