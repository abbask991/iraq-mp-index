"""Monitoring endpoints — news / X / replies / summary. Same response shapes
as the previous Next.js API routes, so the frontend swaps base URL only."""
from fastapi import APIRouter
from pydantic import BaseModel

import asyncio

from app.config import CRON_SECRET
from app.services import (
    ai, alerts, bigdata, cache, campaign, db, network, news, notify,
    sources_extra, sources_social, store, sov, trends, x,
)

# Freshness windows. With stale-while-revalidate the user never WAITS this long
# — once a key is warm they always get an instant answer and the refresh happens
# in the background. Generous windows keep X-API/AI usage bounded (a key is
# recomputed at most once per window, only while it's actively viewed).
NEWS_TTL = 900   # 15 min
X_TTL = 600      # 10 min
HEAVY_TTL = 900  # content / dossier / bigdata
OVERVIEW_TTL = 600

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

    async def _build():
        # Google News RSS + GDELT + direct RSS + Telegram + Reddit + gov feeds, in parallel
        gnews, extra, social = await asyncio.gather(
            news.fetch_news(req.keywords, cap=100, range=rng),
            sources_extra.fetch_extra(req.keywords[0], rng),
            sources_social.fetch_social(req.keywords[0]),
        )
        for h in gnews:
            h.setdefault("src_type", "Google News")
        seen = {h["link"] for h in gnews}
        hits = gnews + [h for h in (extra + social) if h.get("link") and h["link"] not in seen]
        hits.sort(key=lambda h: h.get("date", ""), reverse=True)
        hits = hits[:130]
        cls = await ai.classify_all([h["title"] for h in hits])
        for h, c in zip(hits, cls):
            h["sentiment"], h["type"] = c.get("sentiment", "محايد"), c.get("type", "عام")
        result = {"hits": hits, "count": len(hits), "sources": _distinct_sources(hits),
                  "source_types": sorted({h.get("src_type", "Google News") for h in hits})}
        if db.enabled():                       # persist to the intelligence layer (best-effort)
            asyncio.create_task(store.store_mentions(hits, keyword=req.keywords[0]))
        return result

    return await cache.swr(key, NEWS_TTL, _build)


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
    if db.enabled():                           # persist to the intelligence layer (best-effort)
        for h in hits:
            h.setdefault("platform", "x")
        asyncio.create_task(store.store_mentions(hits, keyword=req.keywords[0]))
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


@router.post("/ingest")
async def monitor_ingest(req: KeywordReq):
    """Fetch + persist mentions for a keyword (deterministic backfill). Powers the
    Digital Twin / scores / knowledge graph / grounded ask with real data."""
    if not req.keywords:
        return {"stored": 0}
    rng = req.range or "week"
    nr, xr = await asyncio.gather(
        monitor_news(KeywordReq(keywords=req.keywords, range=rng)),
        monitor_x(KeywordReq(keywords=req.keywords, range=rng)),
    )
    hits = ([{**h, "platform": "news"} for h in (nr.get("hits") or [])]
            + [{**h, "platform": "x"} for h in (xr.get("hits") or [])])
    n = await store.store_mentions(hits, keyword=req.keywords[0])
    return {"stored": n, "entity_id": store.resolve_entity_id(req.keywords[0]),
            "news": len(nr.get("hits") or []), "x": len(xr.get("hits") or [])}


@router.post("/dossier")
async def monitor_dossier(req: KeywordReq):
    """Comprehensive intelligence dossier — aggregates every section for one
    entity from a single fetch."""
    if not req.keywords:
        return {"total": 0}
    import re as _re
    from collections import Counter as _C
    from datetime import datetime, timezone

    name = req.keywords[0]
    rng = req.range or "week"
    key = f"dossier:{rng}:" + name

    async def _build():
      tw, news_res = await asyncio.gather(
        x.fetch_trend(name, want=150, range=rng),
        monitor_news(KeywordReq(keywords=[name], range=rng)),
      )
      tweets = [] if "error" in tw else tw["tweets"]
      users = {} if "error" in tw else tw["users"]
      cls = await ai.classify_all([t["text"] for t in tweets])
      for t, c in zip(tweets, cls):
        t["sentiment"], t["type"] = c.get("sentiment", "محايد"), c.get("type", "عام")
      news_hits = news_res.get("hits") or []

      all_hits = ([{**h, "platform": "x"} for h in
                   ({"title": t["text"], "source": "@" + (users.get(t["author_id"], {}).get("username") or "x"),
                     "sentiment": t["sentiment"], "type": t["type"], "engagement": t.get("engagement", 0),
                     "link": ""} for t in tweets)] +
                  [{**h, "platform": "news"} for h in news_hits])
      total = len(all_hits)
      if total == 0:
        return {"total": 0, "message": "لا محتوى كافٍ عن هذه الشخصية."}

      pos = sum(1 for h in all_hits if h.get("sentiment") == "إيجابي")
      neg = sum(1 for h in all_hits if h.get("sentiment") == "سلبي")
      neu = total - pos - neg
      media_index = round(50 + 50 * (pos - neg) / total)

      by_src: dict = {}
      for h in all_hits:
        s = h.get("source") or "—"
        d = by_src.setdefault(s, {"source": s, "pos": 0, "neg": 0, "neu": 0, "total": 0})
        d[{"إيجابي": "pos", "سلبي": "neg"}.get(h.get("sentiment"), "neu")] += 1
        d["total"] += 1
      sources = sorted(by_src.values(), key=lambda d: -d["total"])[:8]
      for d in sources:
        d["lean"] = round((d["pos"] - d["neg"]) / d["total"] * 100)
      themes = [{"label": trends.NARRATIVE_MAP.get(t, t), "count": c}
                for t, c in _C(h.get("type") for h in all_hits if h.get("type") and h["type"] != "عام").most_common(6)]
      words = _C()
      for h in all_hits:
        for w in _re.findall(r"[؀-ۿ]{4,}", h.get("title", "")):
            if w not in trends.AR_STOP and w not in name:
                words[w] += 1
      key_terms = [{"term": w, "count": c} for w, c in words.most_common(18) if c >= 2]

      bd = bigdata.analyze(name, tweets, users) if len(tweets) >= 5 else {}

      # every engine, same data → a section each
      import math
      from datetime import timedelta
      sentiments = [t.get("sentiment", "محايد") for t in tweets]
      platforms_present = 1 + (1 if news_hits else 0)
      trend = trends.analyze(name, tweets, users, sentiments, len(news_hits), platforms_present) if len(tweets) >= 3 else {}
      camp = campaign.detect(name, tweets, users, len(news_hits)) if len(tweets) >= 5 else {}
      new_acc = network.new_accounts_report(tweets, users) if tweets else {}

      cutoff = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d")
      eng = sum(int(t.get("engagement") or 0) for t in tweets)
      distinct = len({h.get("source") for h in all_hits})
      recent_neg = sum(1 for t in tweets if t.get("sentiment") == "سلبي"
                       and (t.get("created_at") or "")[:10] >= cutoff)
      neg_ratio = neg / total
      risk_level = ("high" if recent_neg >= 5 or (neg_ratio > 0.5 and total >= 8)
                    else "medium" if recent_neg >= 2 or neg_ratio > 0.3 else "low")
      dims = {
        "visibility": min(100, round(total / 2)),
        "sentiment": round((pos - neg) / total * 50 + 50),
        "engagement": min(100, round(math.log10(eng + 1) * 20)),
        "diversity": min(100, distinct * 3),
      }
      perf = round(0.3 * dims["visibility"] + 0.3 * dims["sentiment"] + 0.2 * dims["engagement"] + 0.2 * dims["diversity"])

      samples = [{"title": h["title"], "sentiment": h.get("sentiment"), "source": h.get("source")} for h in all_hits[:40]]
      facts = (f"إجمالي {total} منشور ({len(news_hits)} خبر، {len(tweets)} تغريدة). "
               f"المؤشر الإعلامي {media_index}/100 (إيجابي {pos}، سلبي {neg}، محايد {neu}). "
               f"مؤشّر التلاعب {bd.get('manipulation_index', '—')}. "
               f"أبرز القضايا: {'، '.join(t['label'] for t in themes[:4])}.")
      content, conclusion = await asyncio.gather(
        ai.content_analysis(name, samples),
        ai.dossier_conclusion(name, facts),
      )

      spread = bd.get("network") and trends.spread_analysis(
        tweets, users, [trends._hours_ago(t["created_at"], datetime.now(timezone.utc)) for t in tweets]) or {}

      result = {
        "entity": name, "period": rng, "total": total, "news": len(news_hits), "x": len(tweets),
        "sentiment": {"pos": pos, "neg": neg, "neu": neu}, "media_index": media_index,
        "executive": conclusion,
        "content": content,
        "sources": sources, "themes": themes, "key_terms": key_terms,
        "performance": {"score": perf, "dims": dims},
        "early_warning": {"level": risk_level, "neg": neg, "recent_neg": recent_neg, "neg_ratio": round(neg_ratio, 2)},
        "trend": {"score": trend.get("trend_score"), "alert": trend.get("alert", {}).get("label"),
                  "mention_velocity": trend.get("metrics", {}).get("mention_velocity"),
                  "influencer_weight": trend.get("metrics", {}).get("influencer_weight"),
                  "narrative": trend.get("narrative")},
        "campaign": {"score": camp.get("coordination_score"), "level": camp.get("alert_level", {}).get("label"),
                     "sub_scores": camp.get("sub_scores", {}), "explanation": camp.get("explanation"),
                     "duplicate_ratio": camp.get("duplicate_content_ratio"),
                     "suspicious_ratio": camp.get("suspicious_account_ratio")},
        "bigdata": {"manipulation_index": bd.get("manipulation_index"), "level": bd.get("level"),
                    "drivers": bd.get("drivers"), "bot_histogram": bd.get("bot_histogram"),
                    "age_cohorts": bd.get("age_cohorts"), "activity_by_hour": bd.get("activity_by_hour"),
                    "automation_suspects": bd.get("automation_suspects", [])[:6],
                    "coordination_waves": bd.get("coordination_waves", [])[:5],
                    "related_hashtags": bd.get("related_hashtags", [])[:8],
                    "duplicate_clusters": bd.get("duplicate_clusters", [])[:5],
                    "network_accounts": len(bd.get("network", {}).get("nodes", [])),
                    "network_edges": len(bd.get("network", {}).get("edges", []))},
        "new_accounts": {"new_total": new_acc.get("new_accounts", 0), "total": new_acc.get("total_accounts", 0),
                         "clusters": new_acc.get("creation_clusters", [])[:3],
                         "today": (new_acc.get("bands", [{}])[0].get("count", 0) if new_acc.get("bands") else 0)},
        "spread": {"first_poster": spread.get("first_poster"), "first_influential": spread.get("first_influential"),
                   "amplifiers": spread.get("amplifiers", [])[:6]},
        "top_items": [{"title": h["title"], "source": h.get("source"), "sentiment": h.get("sentiment"),
                       "platform": h.get("platform"), "link": h.get("link")}
                      for h in sorted(all_hits, key=lambda h: h.get("engagement", 0), reverse=True)[:10]],
      }
      return result

    return await cache.swr(key, HEAVY_TTL, _build)


@router.post("/content")
async def monitor_content(req: KeywordReq):
    """Professional media content analysis: narratives, framing, tone, key
    messages, source bias, key terms, themes + editorial brief."""
    if not req.keywords:
        return {"total": 0}
    import re as _re
    from collections import Counter as _C

    kw = req.keywords[0]
    rng = req.range or "week"
    key = f"content:{rng}:" + kw

    async def _build():
        nr, xr = await asyncio.gather(
            monitor_news(KeywordReq(keywords=req.keywords, range=rng)),
            monitor_x(KeywordReq(keywords=req.keywords, range=rng)),
        )
        hits = [{**h, "platform": "news"} for h in (nr.get("hits") or [])] + \
               [{**h, "platform": "x"} for h in (xr.get("hits") or [])]
        total = len(hits)
        if total == 0:
            return {"total": 0, "message": "لا محتوى كافٍ لهذا الموضوع."}

        pos = sum(1 for h in hits if h.get("sentiment") == "إيجابي")
        neg = sum(1 for h in hits if h.get("sentiment") == "سلبي")
        neu = total - pos - neg
        media_index = round(50 + 50 * (pos - neg) / total)

        # source bias: per-source sentiment lean
        by_src: dict = {}
        for h in hits:
            s = h.get("source") or "—"
            d = by_src.setdefault(s, {"source": s, "pos": 0, "neg": 0, "neu": 0, "total": 0})
            d[{"إيجابي": "pos", "سلبي": "neg"}.get(h.get("sentiment"), "neu")] += 1
            d["total"] += 1
        sources = sorted(by_src.values(), key=lambda d: -d["total"])[:10]
        for d in sources:
            d["lean"] = round((d["pos"] - d["neg"]) / d["total"] * 100)

        # themes (issue types) + key terms
        themes = [{"label": trends.NARRATIVE_MAP.get(t, t), "count": c}
                  for t, c in _C(h.get("type") for h in hits if h.get("type") and h["type"] != "عام").most_common(6)]
        words = _C()
        for h in hits:
            for w in _re.findall(r"[؀-ۿ]{4,}", h.get("title", "")):
                if w not in trends.AR_STOP and w not in kw:
                    words[w] += 1
        key_terms = [{"term": w, "count": c} for w, c in words.most_common(20) if c >= 2]

        samples = [{"title": h["title"], "sentiment": h.get("sentiment"), "source": h.get("source")} for h in hits[:50]]
        ai_res = await ai.content_analysis(kw, samples)

        return {
            "keyword": kw, "total": total, "news": len(nr.get("hits") or []), "x": len(xr.get("hits") or []),
            "sentiment": {"pos": pos, "neg": neg, "neu": neu}, "media_index": media_index,
            "sources": sources, "themes": themes, "key_terms": key_terms,
            "narratives": ai_res.get("narratives", []), "frames": ai_res.get("frames", []),
            "tone": ai_res.get("tone", {}), "key_messages": ai_res.get("key_messages", []),
            "brief": ai_res.get("brief", ""),
            "top_items": [{"title": h["title"], "source": h.get("source"), "sentiment": h.get("sentiment"),
                           "link": h.get("link"), "platform": h.get("platform")} for h in hits[:12]],
        }

    return await cache.swr(key, HEAVY_TTL, _build)


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


@router.post("/cron/snapshot")
async def cron_snapshot(secret: str = "", limit: int = 12):
    """Scheduled: snapshot each monitor's metrics + raise spike alerts. Protected
    by CRON_SECRET. Called by the GitHub Actions cron."""
    if not CRON_SECRET or secret != CRON_SECRET:
        return {"error": "unauthorized"}
    if not db.enabled():
        return {"error": "db_not_configured"}

    monitors = await db.get_monitors(limit)
    processed, alerts_made = 0, 0
    for m in monitors:
        kws = m.get("keywords") or []
        if not kws:
            continue
        nr, xr = await asyncio.gather(
            monitor_news(KeywordReq(keywords=kws, range="day")),
            monitor_x(KeywordReq(keywords=kws, range="day")),
        )
        hits = (nr.get("hits") or []) + (xr.get("hits") or [])
        total = len(hits)
        if total == 0:
            continue
        await store.store_mentions(hits, keyword=kws[0], owner=m.get("owner"))  # durable layer
        pos = sum(1 for h in hits if h.get("sentiment") == "إيجابي")
        neg = sum(1 for h in hits if h.get("sentiment") == "سلبي")
        neu = total - pos - neg
        neg_ratio = round(neg / total, 3)
        media_index = round(50 + 50 * (pos - neg) / total)
        prev = await db.last_snapshot(m["id"])

        await db.insert_snapshot({
            "monitor_id": m["id"], "owner": m.get("owner"), "mentions": total,
            "pos": pos, "neg": neg, "neu": neu, "media_index": media_index, "neg_ratio": neg_ratio,
        })
        processed += 1

        # spike alerts vs previous snapshot
        new_alerts = []
        if prev:
            if neg_ratio - float(prev.get("neg_ratio") or 0) >= 0.2 and neg >= 5:
                new_alerts.append(("نبرة سلبية", "high", f"ارتفاع حاد بالنبرة السلبية لـ«{m['name']}» ({int(neg_ratio*100)}%)."))
            if prev.get("mentions", 0) >= 3 and total >= max(10, prev["mentions"] * 2):
                new_alerts.append(("حجم", "medium", f"قفزة بحجم الذِكر لـ«{m['name']}» ({prev['mentions']}→{total})."))
        if neg_ratio >= 0.6 and neg >= 8 and not (prev and float(prev.get("neg_ratio") or 0) >= 0.6):
            new_alerts.append(("سمعة", "high", f"نبرة سلبية غالبة حول «{m['name']}» ({int(neg_ratio*100)}%) — يُنصح بالمراجعة."))
        sub = await db.get_subscription(m.get("owner")) if new_alerts else None
        for typ, sev, msg in new_alerts:
            await db.insert_alert({"monitor_id": m["id"], "owner": m.get("owner"),
                                   "type": typ, "severity": sev, "message": msg})
            alerts_made += 1
            # policy layer: dedup + cooldown + escalation + history (delivers if not suppressed)
            await alerts.raise_alert(sub, owner=m.get("owner"), monitor_id=m["id"],
                                     atype=typ, severity=sev, message=msg)

    return {"processed": processed, "alerts": alerts_made, "monitors": len(monitors)}


@router.post("/overview")
async def monitor_overview(req: KeywordReq = KeywordReq()):  # noqa: B008
    """Command-center overview — all live stats from ONE broad fetch:
    trending hashtags/keywords, suspected campaigns, new accounts, overall
    sentiment, and top issues."""
    from collections import Counter as _C

    rng = req.range or "day"
    key = f"overview:{rng}"

    async def _build():
        tw = await x.fetch_trend(DISCOVER_SEED, want=500, range=rng)
        if "error" in tw:
            return {"error": tw["error"], "message": "تعذّر — تأكد من توكن X"}
        tweets, users = tw["tweets"], tw["users"]
        cls = await ai.classify_all([t["text"] for t in tweets])
        sentiments = [c.get("sentiment", "محايد") for c in cls]
        for t, c in zip(tweets, cls):
            t["sentiment"], t["type"] = c.get("sentiment", "محايد"), c.get("type", "عام")

        disc = trends.discover(tweets, users, sentiments)

        # suspected campaigns from credible-account hashtags
        cred = trends.credible_authors(users)
        htags = _C(h for t in tweets if t["author_id"] in cred
                   for h in t.get("hashtags", [])
                   if h not in trends.EXCLUDE_HASHTAGS and not trends.is_spam_hashtag(h))
        campaigns = []
        for h, c in htags.most_common(12):
            if c < 5:
                continue
            subset = [t for t in tweets if h in t.get("hashtags", [])]
            sub_users = {t["author_id"]: users[t["author_id"]] for t in subset if t["author_id"] in users}
            det = campaign.detect(h, subset, sub_users, 0, window_label=rng)
            if det.get("coordination_score", 0) >= 30:
                campaigns.append({"hashtag": h, "coordination_score": det["coordination_score"],
                                  "alert_level": det["alert_level"], "total_posts": det["total_posts"]})
        campaigns.sort(key=lambda r: -r["coordination_score"])

        newacc = network.new_accounts_report(tweets, users)
        pos = sentiments.count("إيجابي")
        neg = sentiments.count("سلبي")
        neu = len(sentiments) - pos - neg
        issues = [{"label": trends.NARRATIVE_MAP.get(t, t), "count": c}
                  for t, c in _C(t.get("type") for t in tweets if t.get("type") and t["type"] != "عام").most_common(6)]

        return {
            "scanned": len(tweets), "accounts": len(users), "window": rng,
            "sentiment": {"pos": pos, "neg": neg, "neu": neu},
            "media_index": round(50 + (50 * (pos - neg) / len(tweets))) if tweets else 50,
            "trending": disc["hashtags"][:8], "keywords": disc["keywords"][:8],
            "campaigns": campaigns[:5],
            "new_accounts": {"new_today": newacc["bands"][0]["count"] if newacc["bands"] else 0,
                             "new_total": newacc["new_accounts"],
                             "clusters": newacc["creation_clusters"][:3]},
            "issues": issues,
        }

    return await cache.swr(key, HEAVY_TTL, _build)


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
    same-day creation clusters. No AI needed (account metadata only)  fast."""
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


@router.post("/bigdata")
async def monitor_bigdata(req: KeywordReq):
    """Advanced big-data analytics for a topic: manipulation index, influence
    network graph, activity heatmap, distributions, timeline, fingerprints."""
    if not req.keywords:
        return {"sparse": True}
    kw = req.keywords[0]
    rng = req.range or "week"
    key = f"bigdata:{rng}:" + kw

    async def _build():
        tw = await x.fetch_trend(kw, want=200, range=rng)
        if "error" in tw:
            return {"sparse": True, "error": tw["error"], "message": "تعذّر — تأكد من توكن X"}
        tweets, users = tw["tweets"], tw["users"]
        cls = await ai.classify_all([t["text"] for t in tweets])
        for t, c in zip(tweets, cls):
            t["sentiment"] = c.get("sentiment", "محايد")
        result = bigdata.analyze(kw, tweets, users)
        if not result.get("sparse"):
            result["analyst_brief"] = await ai.analyst_brief(kw, bigdata.brief_facts(result))
        return result

    return await cache.swr(key, OVERVIEW_TTL, _build)


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
