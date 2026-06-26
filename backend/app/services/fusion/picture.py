"""Unified Intelligence Picture — the final synthesized output.

For one entity/topic it FUSES every platform into a single answer: what's
happening, total cross-platform reach, who's driving it, where it spreads, the
dominant narratives, sentiment, and an AI verdict (risk + recommendation).

Live X is the real-time backbone (TwitterAPI.io); other platforms come from the
unified store (collected via Bright Data). One picture, all sources.
"""
import json
import re
from collections import Counter, defaultdict
from datetime import datetime

from app.config import ANTHROPIC_API_KEY, SUMMARY_MODEL
from app.services import ai_cache, geo, narrative_engine, x
from app.services.collection import smart_classify
from app.services.fusion import reach, store

_HASH = re.compile(r"#[\w؀-ۿ_]+")


def _x_to_fused(t: dict) -> dict:
    fol = (t.get("followers") or 0)
    return {
        "platform": "x", "url": None, "text": t.get("text", ""), "created_at": t.get("created_at"),
        "author": {"username": t.get("author_id"), "followers": fol},
        "engagement": {"likes": 0, "comments": 0, "shares": 0, "views": t.get("views", 0) or 0,
                       "_total": t.get("engagement", 0)},
    }


async def _synthesize(facts: str) -> dict:
    if not ANTHROPIC_API_KEY:
        return {}
    prompt = (
        "أنت كبير محلّلي الاستخبارات. أمامك صورة موحّدة لموضوع عبر عدّة منصّات تواصل. "
        "أنتج تركيباً نهائياً موجزاً. أعد JSON فقط بالعربية:\n"
        '{"executive":"موجز تنفيذي 3-4 جُمل يدمج كل المنصّات",'
        '"key_finding":"أهم استنتاج واحد",'
        '"who_drives":"من يقود الانتشار",'
        '"risk_level":"منخفض|متوسط|مرتفع|حرج","risk_reason":"السبب",'
        '"recommendation":"توصية عملية واحدة","confidence":0-100}\n'
        "استند للمعطيات فقط، لغة احتمالية، يتطلّب مراجعة بشرية.\n\n" + facts)
    cached = await ai_cache.get(SUMMARY_MODEL, prompt)
    if cached is not None:
        return cached
    try:
        import httpx
        async with httpx.AsyncClient() as c:
            r = await c.post("https://api.anthropic.com/v1/messages",
                             headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                                      "content-type": "application/json"},
                             json={"model": SUMMARY_MODEL, "max_tokens": 700,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=60)
            txt = r.json()["content"][0]["text"]
            out = json.loads(txt[txt.find("{"):txt.rfind("}") + 1])
            await ai_cache.put(SUMMARY_MODEL, prompt, out)
            return out
    except Exception:
        return {}


def _fallback(entity, agg, narrs, sentiment, platforms):
    neg = sentiment.get("negative", 0)
    lvl = "حرج" if neg >= 70 and agg["total_reach"] > 500000 else "مرتفع" if neg >= 55 else "متوسط" if neg >= 35 else "منخفض"
    return {
        "executive": (f"موضوع «{entity}» نشط عبر {agg['platform_count']} منصّة بوصول تقديري "
                      f"{agg['total_reach']:,} ونسبة سلبية {neg}%. أبرز السرديات: "
                      f"{'، '.join(n['narrative'] for n in narrs[:2]) or '—'}. (تركيب آلي — يتطلّب مراجعة بشرية.)"),
        "key_finding": f"الانتشار الأكبر على {platforms[0]['platform'] if platforms else '—'}.",
        "who_drives": "حسابات متعدّدة عبر المنصّات.",
        "risk_level": lvl, "risk_reason": "مبني على الطابع السلبي وحجم الوصول.",
        "recommendation": "الردّ بسردية مضادّة موثّقة ومتابعة التصعيد." if lvl in ("مرتفع", "حرج") else "المتابعة والرصد.",
        "confidence": min(70, 40 + agg["platform_count"] * 8), "fallback": True,
    }


async def build_picture(entity: str, rng: str = "week", x_limit: int = 300) -> dict:
    import time as _t
    entity = (entity or "").strip()
    if not entity:
        return {"error": "missing entity"}

    # 1) live X
    tw = await x.fetch_trend(entity, want=x_limit, range=rng)
    x_tweets = tw.get("tweets", []) if "error" not in tw else []
    x_users = tw.get("users", {}) if "error" not in tw else {}
    for t in x_tweets:                                   # attach follower count from users
        u = x_users.get(t.get("author_id"), {})
        t["followers"] = u.get("public_metrics", {}).get("followers_count", 0)
    fused = [_x_to_fused(t) for t in x_tweets]

    # 2) classify the whole fused feed (cluster-before-AI keeps cost down)
    if fused:
        cls, _ = await smart_classify.classify_posts([{"text": p["text"]} for p in fused])
        for p, c in zip(fused, cls):
            p["sentiment"], p["type"] = c.get("sentiment", "محايد"), c.get("type", "عام")

    # progressive enrichment: fire keyword-search across search-capable platforms
    # (background, throttled to once per 6h per entity) so the picture fills with
    # all platforms over time — like X, no links needed.
    try:
        import asyncio

        from app.services import redis_client
        from app.services.social import cross_platform
        if await redis_client.setnx(f"enrich:{entity}", "1", 21600):
            asyncio.create_task(cross_platform.enrich_entity(entity, limit=10))
    except Exception:
        pass

    # 3a) Google News (native — already in the platform via RSS)
    try:
        from app.services import news
        news_hits = await news.fetch_news([entity], cap=40, range=rng)
    except Exception:
        news_hits = []
    if news_hits:
        ncls, _ = await smart_classify.classify_posts([{"text": h.get("title", "")} for h in news_hits])
        for h, c in zip(news_hits, ncls):
            h["_sent"] = c.get("sentiment", "محايد")
    for h in news_hits:
        fused.append({"platform": "news", "url": h.get("link"), "text": h.get("title", ""),
                      "created_at": h.get("date"), "type": "عام", "sentiment": h.get("_sent", "محايد"),
                      "author": {"username": h.get("source"), "followers": 0},
                      "engagement": {"likes": 0, "comments": 0, "shares": 0, "views": 0}})

    # 3b) stored cross-platform posts for this entity (Apify-collected)
    cross = [store.to_post(r) for r in await store.query(entity, limit=300)]
    for p in cross:
        p.setdefault("type", "عام")
    fused += cross

    # persist X posts for future fusion (best-effort)
    try:
        await store.store_posts([{**p, "id": (p["author"]["username"] or "") + str(i)} for i, p in enumerate(fused) if p["platform"] == "x"][:300], entity)
    except Exception:
        pass

    if not fused:
        return {"error": tw.get("error") or "NO_DATA", "entity": entity}

    # 4) reach normalization + platform breakdown
    agg = reach.aggregate(fused)

    # 5) narratives across all platforms
    narrs = narrative_engine.narratives(
        [{"title": p["text"], "type": p.get("type", "عام"), "sentiment": p.get("sentiment")} for p in fused])
    # which platforms each narrative spans
    for n in narrs:
        plats = {p["platform"] for p in fused if p.get("type") == n["type"]}
        n["platforms"] = sorted(plats)
        n["cross_platform"] = len(plats)

    # 6) top influencers across platforms (by reach)
    accs = defaultdict(lambda: {"reach": 0, "posts": 0, "platform": None, "followers": 0})
    for p in fused:
        a = (p.get("author") or {}).get("username")
        if not a:
            continue
        d = accs[(p["platform"], a)]
        d["reach"] += reach.estimated_reach(p["platform"], p.get("engagement", {}), (p.get("author") or {}).get("followers", 0))
        d["posts"] += 1
        d["platform"] = p["platform"]
        d["followers"] = max(d["followers"], (p.get("author") or {}).get("followers", 0))
    influencers = sorted(({"username": k[1], **v} for k, v in accs.items()), key=lambda x_: -x_["reach"])[:10]

    # 7) sentiment + timeline + geo
    total = len(fused) or 1
    neg = sum(1 for p in fused if p.get("sentiment") == "سلبي")
    pos = sum(1 for p in fused if p.get("sentiment") == "إيجابي")
    sentiment = {"negative": round(neg / total * 100), "positive": round(pos / total * 100),
                 "neutral": round((total - neg - pos) / total * 100)}
    hours = Counter()
    for p in fused:
        try:
            dt = datetime.fromisoformat((p.get("created_at") or "").replace("Z", "+00:00"))
            hours[dt.strftime("%m-%d %H")] += 1
        except Exception:
            pass
    timeline = [{"t": k, "count": v} for k, v in sorted(hours.items())][-24:]
    heat = geo.aggregate(x_users)

    # 8) AI synthesis (fallback if unavailable)
    facts = (
        f"الموضوع: {entity}. منصّات: {agg['platform_count']} ({'، '.join(b['platform'] for b in agg['platforms'])}). "
        f"وصول تقديري إجمالي {agg['total_reach']:,}. منشورات {len(fused)}. "
        f"سلبي {sentiment['negative']}% / إيجابي {sentiment['positive']}%. "
        f"أبرز السرديات: {'، '.join(n['narrative']+' ('+str(n['cross_platform'])+' منصّة)' for n in narrs[:3]) or '—'}. "
        f"أكبر المؤثّرين: {'، '.join('@'+(i['username'] or '') for i in influencers[:3]) or '—'}."
    )
    ai = await _synthesize(facts)
    if not ai.get("executive"):
        ai = _fallback(entity, agg, narrs, sentiment, agg["platforms"])

    return {
        "entity": entity, "period": rng, "generated_at": int(_t.time()),
        "reach": agg, "sentiment": sentiment,
        "narratives": [{"narrative": n["narrative"], "posts": n["posts"], "share": n["share"],
                        "platforms": n["platforms"], "cross_platform": n["cross_platform"],
                        "neg_ratio": n["neg_ratio"]} for n in narrs[:6]],
        "influencers": influencers,
        "timeline": timeline, "heatmap": heat,
        "totals": {"posts": len(fused), "x_posts": len(x_tweets), "cross_posts": len(cross),
                   "platforms": agg["platform_count"]},
        "synthesis": ai,
        "disclaimer": "صورة استخباراتية موحّدة عبر المنصّات — تقديرات آلية تتطلّب مراجعة بشرية.",
    }
