"""Monitoring endpoints — news / X / replies / summary. Same response shapes
as the previous Next.js API routes, so the frontend swaps base URL only."""
from fastapi import APIRouter
from pydantic import BaseModel

import asyncio

from app.services import ai, cache, campaign, network, news, sources_extra, sov, trends, x

NEWS_TTL = 300   # seconds — repeated identical queries return instantly
X_TTL = 180

router = APIRouter(prefix="/monitor", tags=["monitor"])


class KeywordReq(BaseModel):
    keywords: list[str] = []
    limit: int | None = None
    range: str | None = None   # day | week | month | year


class RepliesReq(BaseModel):
    tweetId: str | None = None
    limit: int | None = None


class SummaryReq(BaseModel):
    name: str
    stats: dict = {}
    samples: list[dict] = []


class SovReq(BaseModel):
    entities: list[dict] = []   # [{name, aliases:[...]}]
    category: str = ""
    range: str | None = None


def _distinct_sources(hits):
    return len({h["source"] for h in hits})


@router.post("/news")
async def monitor_news(req: KeywordReq):
    if not req.keywords:
        return {"hits": [], "count": 0, "sources": 0}
    rng = req.range or ""
    key = f"news:{rng}:" + ",".join(sorted(req.keywords))
    cached = cache.get(key, NEWS_TTL)
    if cached is not None:
        return cached
    # Google News RSS (per-source) + GDELT + direct RSS + Telegram, in parallel
    gnews, extra = await asyncio.gather(
        news.fetch_news(req.keywords, cap=100, range=rng),
        sources_extra.fetch_extra(req.keywords[0], rng),
    )
    for h in gnews:
        h.setdefault("src_type", "Google News")
    seen = {h["link"] for h in gnews}
    hits = gnews + [h for h in extra if h["link"] not in seen]
    hits.sort(key=lambda h: h.get("date", ""), reverse=True)
    hits = hits[:130]
    cls = await ai.classify_all([h["title"] for h in hits])
    for h, c in zip(hits, cls):
        h["sentiment"], h["type"] = c.get("sentiment", "محايد"), c.get("type", "عام")
    result = {"hits": hits, "count": len(hits), "sources": _distinct_sources(hits),
              "source_types": sorted({h.get("src_type", "Google News") for h in hits})}
    cache.put(key, result)
    return result


@router.post("/x")
async def monitor_x(req: KeywordReq):
    if not req.keywords:
        return {"hits": [], "count": 0, "sources": 0}
    per = min(200, max(10, req.limit or 50))
    rng = req.range or ""
    key = f"x:{per}:{rng}:" + ",".join(sorted(req.keywords))
    cached = cache.get(key, X_TTL)
    if cached is not None:
        return cached
    res = await x.fetch_x(req.keywords, per_keyword=per, range=rng)
    if "error" in res:
        msg = {
            "X_TOKEN_MISSING": "أضِف X_BEARER_TOKEN لتفعيل رصد X.",
        }.get(res["error"], f"تعذّر الاتصال بـX ({res.get('status')}).")
        return {"hits": [], "count": 0, "sources": 0, "platform": "x", "error": res["error"], "message": msg}
    hits = res["items"]
    cls = await ai.classify_all([h["title"] for h in hits])
    for h, c in zip(hits, cls):
        h["sentiment"], h["type"] = c.get("sentiment", "محايد"), c.get("type", "عام")
    result = {"hits": hits, "count": len(hits), "sources": _distinct_sources(hits), "platform": "x"}
    cache.put(key, result)
    return result


@router.post("/x-replies")
async def monitor_x_replies(req: RepliesReq):
    if not req.tweetId:
        return {"replies": []}
    res = await x.fetch_replies(req.tweetId, want=min(100, max(10, req.limit or 60)))
    if "error" in res:
        return {"replies": [], "error": res["error"]}
    replies = res["replies"]
    cls = await ai.classify_all([r["text"] for r in replies])
    for r, c in zip(replies, cls):
        r["sentiment"] = c.get("sentiment", "محايد")
    neg = sum(1 for r in replies if r["sentiment"] == "سلبي")
    pos = sum(1 for r in replies if r["sentiment"] == "إيجابي")
    replies.sort(key=lambda r: r.get("engagement", 0), reverse=True)
    return {"replies": replies, "count": len(replies), "pos": pos, "neg": neg, "neu": len(replies) - pos - neg}


@router.post("/summarize")
async def monitor_summarize(req: SummaryReq):
    return {"summary": await ai.summarize(req.name, req.stats, req.samples)}


@router.post("/index")
async def monitor_index(req: KeywordReq):
    """Composite media-performance index (0-100) for a target, from monitoring
    signals: visibility, sentiment, engagement, source diversity, momentum."""
    if not req.keywords:
        return {"composite": 0, "grade": "—"}
    import math
    from datetime import datetime, timedelta

    key = f"idx:{req.range or ''}:" + ",".join(sorted(req.keywords))
    cached = cache.get(key, NEWS_TTL)
    if cached is not None:
        return cached

    news_res = await monitor_news(KeywordReq(keywords=req.keywords, range=req.range))
    x_res = await monitor_x(KeywordReq(keywords=req.keywords, range=req.range))
    hits = (news_res.get("hits") or []) + (x_res.get("hits") or [])
    total = len(hits)
    if not total:
        result = {"composite": 0, "grade": "—", "total": 0, "dims": {}}
        cache.put(key, result)
        return result

    pos = sum(1 for h in hits if h.get("sentiment") == "إيجابي")
    neg = sum(1 for h in hits if h.get("sentiment") == "سلبي")
    eng = sum(int(h.get("engagement") or 0) for h in hits)
    distinct = len({h.get("source") for h in hits})
    cutoff = (datetime.utcnow() - timedelta(days=2)).strftime("%Y-%m-%d")
    recent = sum(1 for h in hits if (h.get("date") or "") >= cutoff)

    dims = {
        "visibility": min(100, round(total / 1.5)),
        "sentiment": round((pos - neg) / total * 50 + 50),
        "engagement": min(100, round(math.log10(eng + 1) * 20)),
        "diversity": min(100, distinct * 2),
        "momentum": min(100, round(recent / total * 100)),
    }
    W = {"visibility": 0.25, "sentiment": 0.25, "engagement": 0.20, "diversity": 0.15, "momentum": 0.15}
    composite = round(sum(dims[k] * W[k] for k in dims))
    grade = ("A+" if composite >= 85 else "A" if composite >= 75 else "B" if composite >= 60
             else "C" if composite >= 45 else "D")

    result = {"composite": composite, "grade": grade, "total": total, "dims": dims,
              "pos": pos, "neg": neg, "engagement": eng, "sources": distinct}
    cache.put(key, result)
    return result


# Iraq-focused seed so the surfaced hashtags are genuinely Iraqi (not generic
# pan-Arab). Provinces + Iraqi figures/bodies + local issues + Arabic only.
DISCOVER_SEED = (
    '(العراق OR بغداد OR البصرة OR النجف OR كربلاء OR الموصل OR كركوك OR "ذي قار" OR الانبار '
    'OR السوداني OR "مجلس النواب" OR "الاطار التنسيقي" OR الحشد OR الكهرباء OR الرواتب '
    'OR الموازنة OR "الحكومة العراقية" OR العراقي) lang:ar'
)


@router.post("/discover")
async def monitor_discover(req: KeywordReq = KeywordReq()):  # noqa: B008
    """Auto-discover currently trending/emerging hashtags & topics — no keyword."""
    seed = (req.keywords[0] if req.keywords else "") or DISCOVER_SEED
    rng = req.range or "day"
    key = f"discover:{rng}:{seed}"
    cached = cache.get(key, 300)
    if cached is not None:
        return cached

    tw = await x.fetch_trend(seed, want=500, range=rng)
    if "error" in tw:
        return {"hashtags": [], "keywords": [], "error": tw["error"], "message": "تعذّر — تأكد من توكن X"}
    tweets, users = tw["tweets"], tw["users"]
    cls = await ai.classify_all([t["text"] for t in tweets])
    sentiments = [c.get("sentiment", "محايد") for c in cls]

    result = trends.discover(tweets, users, sentiments)
    cache.put(key, result)
    return result


@router.post("/sov")
async def monitor_sov(req: SovReq):
    """Media Share of Voice across compared entities (alias-aware)."""
    ents = [e for e in req.entities if e.get("name")][:6]
    if len(ents) < 2:
        return {"entities": [], "message": "أضِف كيانين على الأقل للمقارنة."}
    rng = req.range or "week"
    key = f"sov:{rng}:" + "|".join(sorted(e["name"] for e in ents))
    cached = cache.get(key, 300)
    if cached is not None:
        return cached

    async def collect(e):
        aliases = e.get("aliases") or [e["name"]]
        q = "(" + " OR ".join(f'"{a}"' for a in aliases[:4]) + ")"
        tw, news_res = await asyncio.gather(
            x.fetch_trend(q, want=100, range=rng),
            monitor_news(KeywordReq(keywords=[e["name"]], range=rng)),
        )
        tweets = [] if "error" in tw else tw["tweets"]
        users = {} if "error" in tw else tw["users"]
        cls = await ai.classify_all([t["text"] for t in tweets])
        for t, c in zip(tweets, cls):
            t["sentiment"], t["type"] = c.get("sentiment", "محايد"), c.get("type", "عام")
        return {"name": e["name"], "aliases": aliases, "x_tweets": tweets,
                "x_users": users, "news_hits": news_res.get("hits", [])}

    inputs = await asyncio.gather(*[collect(e) for e in ents])
    result = sov.compute(inputs, category=req.category)
    cache.put(key, result)
    return result


@router.post("/new-accounts")
async def monitor_new_accounts(req: KeywordReq = KeywordReq()):  # noqa: B008
    """Newly-created accounts active in the Iraqi feed, grouped by age band +
    same-day creation clusters. No AI needed (account metadata only) → fast."""
    seed = (req.keywords[0] if req.keywords else "") or DISCOVER_SEED
    rng = req.range or "day"
    key = f"newacc:{rng}:{seed}"
    cached = cache.get(key, 300)
    if cached is not None:
        return cached
    tw = await x.fetch_trend(seed, want=500, range=rng)
    if "error" in tw:
        return {"bands": [], "error": tw["error"], "message": "تعذّر — تأكد من توكن X"}
    result = network.new_accounts_report(tw["tweets"], tw["users"])
    result["scanned"] = len(tw["tweets"])
    cache.put(key, result)
    return result


@router.post("/campaign-scan")
async def monitor_campaign_scan(req: KeywordReq = KeywordReq()):  # noqa: B008
    """Auto-detect coordinated campaigns — scans the broad feed, finds emerging
    hashtags, and scores each for coordination. No keyword needed. Efficient:
    one fetch + one classification pass, then in-memory scoring per hashtag."""
    from collections import Counter as _C

    seed = (req.keywords[0] if req.keywords else "") or DISCOVER_SEED
    rng = req.range or "day"
    key = f"campscan:{rng}:{seed}"
    cached = cache.get(key, 300)
    if cached is not None:
        return cached

    tw = await x.fetch_trend(seed, want=500, range=rng)
    if "error" in tw:
        return {"campaigns": [], "error": tw["error"], "message": "تعذّر — تأكد من توكن X"}
    tweets, users = tw["tweets"], tw["users"]
    cls = await ai.classify_all([t["text"] for t in tweets])
    for t, c in zip(tweets, cls):
        t["type"] = c.get("type", "عام")

    cred = trends.credible_authors(users)
    htags = _C(h for t in tweets if t["author_id"] in cred
               for h in t.get("hashtags", [])
               if h not in trends.EXCLUDE_HASHTAGS and not trends.is_spam_hashtag(h))
    candidates = [h for h, c in htags.most_common(14) if c >= 4]
    win = {"day": "آخر 24 ساعة", "week": "آخر 7 أيام"}.get(rng, rng)

    campaigns = []
    for h in candidates:
        subset = [t for t in tweets if h in t.get("hashtags", [])]
        sub_users = {t["author_id"]: users[t["author_id"]] for t in subset if t["author_id"] in users}
        det = campaign.detect(h, subset, sub_users, 0, window_label=win)
        if det.get("total_posts", 0) >= 5:
            campaigns.append({
                "hashtag": h, "coordination_score": det["coordination_score"],
                "alert_level": det["alert_level"], "total_posts": det["total_posts"],
                "unique_accounts": det.get("unique_accounts"),
                "duplicate_content_ratio": det.get("duplicate_content_ratio"),
                "suspicious_account_ratio": det.get("suspicious_account_ratio"),
                "peak_15min_post_ratio": det.get("peak_15min_post_ratio"),
                "main_narrative": det.get("main_narrative"),
                "explanation": det.get("explanation"),
            })
    campaigns.sort(key=lambda r: -r["coordination_score"])
    out = {"campaigns": campaigns, "scanned": len(tweets), "accounts": len(users), "candidates": len(candidates)}
    cache.put(key, out)
    return out


@router.post("/campaign")
async def monitor_campaign(req: KeywordReq):
    """Coordinated-campaign detection — 9-signal Coordination Score (0-100)."""
    if not req.keywords:
        return {"coordination_score": 0, "alert_level": {"level": "organic"}}
    kw = req.keywords[0]
    rng = req.range or "week"
    key = f"camp:{rng}:" + kw
    cached = cache.get(key, 180)
    if cached is not None:
        return cached

    tw = await x.fetch_trend(kw, want=200, range=rng)
    if "error" in tw:
        return {"coordination_score": 0, "alert_level": {"level": "organic"},
                "error": tw["error"], "message": "تعذّر — تأكد من توكن X"}
    tweets, users = tw["tweets"], tw["users"]
    cls = await ai.classify_all([t["text"] for t in tweets])
    for t, c in zip(tweets, cls):
        t["type"] = c.get("type", "عام")

    news_res = await monitor_news(KeywordReq(keywords=[kw], range=req.range))
    win = {"day": "آخر 24 ساعة", "week": "آخر 7 أيام", "month": "آخر شهر", "year": "آخر سنة"}.get(rng, rng)
    result = campaign.detect(kw, tweets, users, news_res.get("count", 0), window_label=win)
    cache.put(key, result)
    return result


@router.post("/trends")
async def monitor_trends(req: KeywordReq):
    """Early trend detection — composite Trend Score (0-100) + alert + report."""
    if not req.keywords:
        return {"trend_score": 0, "alert": {"level": "normal"}}
    kw = req.keywords[0]
    key = f"trend:{req.range or 'week'}:" + kw
    cached = cache.get(key, 180)
    if cached is not None:
        return cached

    tw = await x.fetch_trend(kw, want=150, range=req.range or "week")
    if "error" in tw:
        return {"trend_score": 0, "alert": {"level": "normal"}, "error": tw["error"],
                "message": "تعذّر — تأكد من توكن X"}
    tweets, users = tw["tweets"], tw["users"]

    cls = await ai.classify_all([t["text"] for t in tweets])
    sentiments = [c.get("sentiment", "محايد") for c in cls]
    for t, c in zip(tweets, cls):
        t["type"] = c.get("type", "عام")

    news_res = await monitor_news(KeywordReq(keywords=[kw], range=req.range))
    news_count = news_res.get("count", 0)
    platforms_present = 1 + (1 if news_count else 0)  # X + news (live platforms)

    result = trends.analyze(kw, tweets, users, sentiments, news_count, platforms_present)
    cache.put(key, result)
    return result


@router.post("/network")
async def monitor_network(req: KeywordReq):
    """Big-data: fake-account scoring + organized-campaign detection for a term."""
    if not req.keywords:
        return {"accounts": 0, "verdict": "—"}
    key = f"net:{req.range or ''}:" + req.keywords[0]
    cached = cache.get(key, NEWS_TTL)
    if cached is not None:
        return cached
    res = await x.fetch_network(req.keywords[0], want=100, range=req.range or "")
    if "error" in res:
        return {"accounts": 0, "error": res["error"], "verdict": "تعذّر — تأكد من توكن X"}
    result = network.analyze(res["tweets"], res["users"])
    cache.put(key, result)
    return result


@router.post("/risk")
async def monitor_risk(req: KeywordReq):
    """Early-warning risk score for a target: combines news + X, weights recent
    negative mentions. Reuses the same cache entries as the dashboard."""
    if not req.keywords:
        return {"total": 0, "level": "low"}
    from datetime import datetime, timedelta

    news_res = await monitor_news(KeywordReq(keywords=req.keywords, range=req.range))
    x_res = await monitor_x(KeywordReq(keywords=req.keywords, range=req.range))
    hits = (news_res.get("hits") or []) + (x_res.get("hits") or [])

    cutoff = (datetime.utcnow() - timedelta(days=2)).strftime("%Y-%m-%d")
    total = len(hits)
    neg = [h for h in hits if h.get("sentiment") == "سلبي"]
    pos = sum(1 for h in hits if h.get("sentiment") == "إيجابي")
    recent_neg = [h for h in neg if (h.get("date") or "") >= cutoff]
    neg_ratio = (len(neg) / total) if total else 0.0

    # risk: recent negatives matter most, then overall negativity
    score = len(recent_neg) * 2 + len(neg)
    if len(recent_neg) >= 5 or (neg_ratio > 0.5 and total >= 8):
        level = "high"
    elif len(recent_neg) >= 2 or neg_ratio > 0.3:
        level = "medium"
    else:
        level = "low"

    top_neg = sorted(neg, key=lambda h: (h.get("date", ""), h.get("engagement", 0)), reverse=True)[:5]
    return {
        "total": total, "neg": len(neg), "pos": pos, "neu": total - len(neg) - pos,
        "recent_neg": len(recent_neg), "neg_ratio": round(neg_ratio, 2),
        "score": score, "level": level,
        "top_negative": [{
            "title": h.get("title"), "source": h.get("source"), "date": h.get("date"),
            "link": h.get("link"), "platform": "x" if str(h.get("source", "")).startswith("@") else "news",
        } for h in top_neg],
    }
