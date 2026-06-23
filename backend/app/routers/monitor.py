"""Monitoring endpoints — news / X / replies / summary. Same response shapes
as the previous Next.js API routes, so the frontend swaps base URL only."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.services import ai, cache, network, news, x

NEWS_TTL = 300   # seconds — repeated identical queries return instantly
X_TTL = 180

router = APIRouter(prefix="/monitor", tags=["monitor"])


class KeywordReq(BaseModel):
    keywords: list[str] = []
    limit: int | None = None


class RepliesReq(BaseModel):
    tweetId: str | None = None
    limit: int | None = None


class SummaryReq(BaseModel):
    name: str
    stats: dict = {}
    samples: list[dict] = []


def _distinct_sources(hits):
    return len({h["source"] for h in hits})


@router.post("/news")
async def monitor_news(req: KeywordReq):
    if not req.keywords:
        return {"hits": [], "count": 0, "sources": 0}
    key = "news:" + ",".join(sorted(req.keywords))
    cached = cache.get(key, NEWS_TTL)
    if cached is not None:
        return cached
    hits = await news.fetch_news(req.keywords, cap=100)
    cls = await ai.classify_all([h["title"] for h in hits])
    for h, c in zip(hits, cls):
        h["sentiment"], h["type"] = c.get("sentiment", "محايد"), c.get("type", "عام")
    result = {"hits": hits, "count": len(hits), "sources": _distinct_sources(hits)}
    cache.put(key, result)
    return result


@router.post("/x")
async def monitor_x(req: KeywordReq):
    if not req.keywords:
        return {"hits": [], "count": 0, "sources": 0}
    per = min(200, max(10, req.limit or 50))
    key = f"x:{per}:" + ",".join(sorted(req.keywords))
    cached = cache.get(key, X_TTL)
    if cached is not None:
        return cached
    res = await x.fetch_x(req.keywords, per_keyword=per)
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


@router.post("/network")
async def monitor_network(req: KeywordReq):
    """Big-data: fake-account scoring + organized-campaign detection for a term."""
    if not req.keywords:
        return {"accounts": 0, "verdict": "—"}
    key = "net:" + req.keywords[0]
    cached = cache.get(key, NEWS_TTL)
    if cached is not None:
        return cached
    res = await x.fetch_network(req.keywords[0], want=100)
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

    news_res = await monitor_news(KeywordReq(keywords=req.keywords))
    x_res = await monitor_x(KeywordReq(keywords=req.keywords))
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
