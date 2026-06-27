"""Social Opinion Survey — configurable public-opinion measurement.

The researcher controls the sampling design:
  • sample_size   — how many mentions to draw (the target n)
  • account_types — which respondents count (verified / influencer / regular)
  • exclude_bots  — drop automated accounts
  • platforms     — which platforms to include
  • weighting     — population (correct geographic skew) | equal (balance
                    governorates) | raw (no weighting)

Then: collect → filter to the chosen sample → classify stance → tally →
weight → margin of error → representativeness → breakdowns. Output reads like a
poll and is honest about non-probability sampling.
"""
from collections import Counter, defaultdict

from app.services import geo, network, stance, x
from app.services.polling import weighting

ACCOUNT_TYPES = ["موثّق", "مؤثّر", "عادي"]


def _classify(text):
    st = stance.classify_stance(text or "")["stance"]
    if st == "support":
        return "support"
    if st in ("oppose", "sarcastic"):
        return "oppose"
    return "neutral"


def _acct_type(verified, followers):
    return "موثّق" if verified else "مؤثّر" if (followers or 0) > 30000 else "عادي"


async def run_survey(subject: str, rng: str = "week", *, sample_size: int = 500,
                     account_types=None, exclude_bots: bool = True,
                     platforms=None, weighting_method: str = "population") -> dict:
    import time as _t
    subject = (subject or "").strip()
    if not subject:
        return {"error": "missing subject"}
    allowed_types = set(account_types) if account_types else set(ACCOUNT_TYPES)
    allowed_plats = set(platforms) if platforms else None        # None = all

    from app.services.opinion import ai_opinion
    from app.services.collection import budget
    budget.set_category("polling")
    tw = await x.fetch_trend(subject, want=sample_size, range=rng)
    tweets = tw.get("tweets", []) if "error" not in tw else []
    users = tw.get("users", {}) if "error" not in tw else {}
    # target-aware classification (AI when available; rule fallback) — accuracy
    xv = await ai_opinion.classify(subject, [{"text": t.get("text", "")} for t in tweets])
    x_stance = {id(tweets[i]): xv[i].get("stance", "neutral") for i in range(len(tweets))}

    support = oppose = neutral = 0
    bots_excluded = filtered_out = 0
    geo_support = defaultdict(lambda: {"support": 0, "oppose": 0})
    geo_counts = Counter()
    by_platform = defaultdict(lambda: {"support": 0, "oppose": 0})
    acct_types = Counter()

    def _tally(v, plat):
        nonlocal support, oppose, neutral
        if v == "support":
            support += 1
        elif v == "oppose":
            oppose += 1
        else:
            neutral += 1
        if v in ("support", "oppose"):
            by_platform[plat][v] += 1

    if allowed_plats is None or "x" in allowed_plats:
        for t in tweets:
            u = users.get(t.get("author_id"), {})
            if exclude_bots and u and network.bot_score(u)[0] > 60:
                bots_excluded += 1
                continue
            fol = u.get("public_metrics", {}).get("followers_count", 0) if u else 0
            atype = _acct_type(u.get("verified"), fol)
            if atype not in allowed_types:
                filtered_out += 1
                continue
            acct_types[atype] += 1
            v = x_stance.get(id(t), "neutral")
            _tally(v, "x")
            gid = geo.locate(u.get("location", "")) if u else None
            if gid:
                geo_counts[gid] += 1
                if v in ("support", "oppose"):
                    geo_support[gid][v] += 1

    # stored cross-platform mentions
    cross = []
    try:
        from app.services.fusion import store
        rows = await store.query(subject, limit=400)
        cv = await ai_opinion.classify(subject, [{"text": r.get("text", "")} for r in rows]) if rows else []
        for i, r in enumerate(rows):
            plat = r.get("platform", "other")
            if allowed_plats is not None and plat not in allowed_plats:
                continue
            atype = _acct_type(False, r.get("author_followers", 0))
            if atype not in allowed_types:
                filtered_out += 1
                continue
            acct_types[atype] += 1
            cross.append(r)
            _tally(cv[i].get("stance", "neutral") if i < len(cv) else "neutral", plat)
    except Exception:
        pass

    n = support + oppose
    analyzed = support + oppose + neutral
    raw_support = round(support / n * 100, 1) if n else None

    wt = weighting.weight_by_population(geo_support, method=weighting_method) if weighting_method != "raw" else {"weighted_support": None}
    weighted = wt["weighted_support"]
    weighting_applied = weighting_method != "raw" and weighted is not None
    headline = weighted if weighting_applied else raw_support
    moe = weighting.margin_of_error((headline or 50) / 100, n)
    rep = weighting.representativeness(geo_counts)
    conf = weighting.confidence(n, rep["score"])

    gov_breakdown = []
    for gid, d in geo_support.items():
        tot = d["support"] + d["oppose"]
        if tot >= 3:
            meta = getattr(geo, "_META", {}).get(gid, {})
            gov_breakdown.append({"id": gid, "name": meta.get("name", gid),
                                  "support_pct": round(d["support"] / tot * 100), "sample": tot})
    gov_breakdown.sort(key=lambda x_: -x_["sample"])

    platform_breakdown = []
    for plat, d in by_platform.items():
        tot = d["support"] + d["oppose"]
        if tot:
            platform_breakdown.append({"platform": plat, "support_pct": round(d["support"] / tot * 100), "sample": tot})
    platform_breakdown.sort(key=lambda x_: -x_["sample"])

    wm_ar = {"population": "ترجيح سكّاني", "equal": "موازنة المحافظات", "raw": "بدون ترجيح"}.get(weighting_method, weighting_method)
    return {
        "subject": subject, "period": rng, "generated_at": int(_t.time()),
        "config": {"sample_size": sample_size, "account_types": sorted(allowed_types),
                   "exclude_bots": exclude_bots, "weighting_method": weighting_method,
                   "platforms": sorted(allowed_plats) if allowed_plats else "الكل"},
        "result": {
            "favorable": headline, "unfavorable": round(100 - headline, 1) if headline is not None else None,
            "raw_favorable": raw_support, "weighted_favorable": weighted,
            "weighting_applied": weighting_applied,
            "margin_of_error": moe, "net": round((headline or 50) - (100 - (headline or 50)), 1),
        },
        "sample": {"n": n, "analyzed": analyzed, "no_opinion": neutral,
                   "bots_excluded": bots_excluded, "filtered_out": filtered_out,
                   "x_mentions": len(tweets), "cross_mentions": len(cross),
                   "account_types": dict(acct_types)},
        "representativeness": rep, "confidence": conf,
        "geography": gov_breakdown, "platforms": platform_breakdown,
        "method": (f"عيّنة غير احتمالية، الحجم المستهدف {sample_size}، n={n} رأياً ذا موقف (من {analyzed} إشارة؛ "
                   f"استُبعد {bots_excluded} آلي و{filtered_out} خارج نوع العيّنة). طريقة الترجيح: {wm_ar}. "
                   + ("" if weighting_applied or weighting_method == "raw" else "(تعذّر الترجيح — عيّنة جغرافية غير كافية، عُرضت النتيجة الخام.) ")
                   + f"هامش الخطأ ±{moe} نقطة عند ثقة 95%."),
        "disclaimer": ("قياس رأي من السوشيال ميديا — عيّنة غير احتمالية تميل للفئات النشطة رقمياً. "
                       f"تمثيلية العيّنة: {rep['label']} ({rep['score']}/100). يُكمّل الاستطلاع الميداني ولا يستبدله."),
    }
