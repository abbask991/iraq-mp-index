"""Ready-made intelligence digest.

A scheduled job (every ~3h) precomputes a ranked digest for the monitored
entities and caches it. The intelligence landing page then reads it INSTANTLY
from cache — no live fetch, no AI at page-load time. This is what makes the
dashboard open with insights already there.

build_digest() itself is cheap: it reads ALREADY-STORED mentions and runs the
pure (rule-based) engines — no Claude calls. Fresh data collection happens
separately in the cron before this runs.
"""
import json
import time

from app.services import db, digital_twin, redis_client, store

DIGEST_KEY = "intel:digest"
_TTL = 86400          # survive a day; refreshed every ~3h by the cron


_SB_KEY = "intel.digest_snapshot"


async def get_digest():
    """Return the latest digest. Redis first (fast); on miss/outage fall back to the
    DURABLE copy in Supabase so the national picture survives a Redis limit/outage."""
    raw = await redis_client.get(DIGEST_KEY)
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            pass
    try:
        if db.enabled():
            rows = await db.select("system_settings", f"select=value_json&key=eq.{_SB_KEY}&limit=1")
            if rows:
                return (rows[0].get("value_json") or {}).get("v")
    except Exception:
        pass
    return None


async def build_digest(now_ts: float | None = None):
    """Build twins for every monitored entity from stored data, rank them into a
    digest, and cache it. now_ts is passed in (callers stamp the time)."""
    monitors = await db.get_monitors(30)
    prev = await get_digest()
    prev_by_id = {e["id"]: e for e in (prev or {}).get("entities", [])}

    from collections import defaultdict
    entities = []
    nar_agg = defaultdict(lambda: {"posts": 0, "entities": set(), "prob": 0.0, "neg": 0.0})
    heatmap = []
    for m in monitors:
        kws = m.get("keywords") or ([m["name"]] if m.get("name") else [])
        if not kws:
            continue
        eid = store.resolve_entity_id(kws[0])
        try:
            twin = await digital_twin.build(eid)
        except Exception:
            continue
        if not twin.get("data_points"):
            continue
        name = m.get("name") or kws[0]
        rep = twin["reputation"]["score"]
        risk = twin["risk"]["score"]
        infl = twin["influence"]["score"]
        prob = twin["prediction"].get("national_trend_probability") or 0.0
        p = prev_by_id.get(eid, {})
        emo = twin.get("emotion_profile", {})
        entities.append({
            "id": eid, "name": name,
            "reputation": rep, "risk": risk, "influence": infl,
            "crisis": twin["crisis"]["score"], "crisis_stage": twin["crisis"].get("stage"),
            "public_trust": twin["scores"]["public_trust"]["score"],
            "campaign_threat": twin["scores"].get("campaign_threat", {}).get("score", 0),
            "top_narrative": (twin["narratives"][0]["narrative"] if twin.get("narratives") else None),
            "trajectory": twin["prediction"].get("trajectory"),
            "national_trend_probability": prob,
            "emotions": emo,
            "data_points": twin.get("data_points", 0),
            "data_points_capped": twin.get("data_points_capped", False),
            "rep_delta": rep - p.get("reputation", rep),
            "risk_delta": risk - p.get("risk", risk),
        })
        if emo:
            heatmap.append({"entity": name, "emotions": emo})
        for n in twin.get("narratives", [])[:4]:        # aggregate narratives nationally
            a = nar_agg[n["narrative"]]
            a["posts"] += n.get("posts", 0)
            a["entities"].add(name)
            a["prob"] = max(a["prob"], prob)
            a["neg"] = max(a["neg"], n.get("neg_ratio", 0))

    top_risk = sorted(entities, key=lambda e: -e["risk"])[:6]
    movers = sorted(entities, key=lambda e: -abs(e.get("risk_delta", 0)))[:6]
    rising = sorted(entities, key=lambda e: -(e.get("national_trend_probability") or 0))[:6]
    rising_narratives = sorted(
        ({"narrative": k, "posts": v["posts"], "entities": sorted(v["entities"])[:4],
          "national_trend_probability": round(v["prob"], 2), "neg_ratio": round(v["neg"], 2)}
         for k, v in nar_agg.items()),
        key=lambda r: -(r["posts"] * (1 + r["national_trend_probability"])))[:8]
    heatmap = sorted(heatmap, key=lambda h: -sum(h["emotions"].values()))[:8]

    # trending / campaigns / geo / sentiment from the overview's STABLE extract.
    # (The overview cache key depends on coverage, which the digest can't know, so
    # the overview publishes this decoupled `intel:overview_extract` for us.)
    trending, campaigns, geo, national_sentiment = [], [], None, {}
    raw_ov = await redis_client.get("intel:overview_extract")
    if raw_ov:
        try:
            ov = json.loads(raw_ov)
            trending = (ov.get("trending") or [])[:8]
            campaigns = (ov.get("campaigns") or [])[:5]
            geo = ov.get("geo")
            national_sentiment = ov.get("sentiment") or {}
        except Exception:
            pass

    # composite risk summary (averages across monitored entities)
    def _avg(vals):
        return round(sum(vals) / len(vals)) if vals else 0
    risk_summary = {
        "political": _avg([e["risk"] for e in entities]),
        "reputation": _avg([100 - e["reputation"] for e in entities]),
        "crisis": _avg([e["crisis"] for e in entities]),
        "campaign": _avg([e.get("campaign_threat", 0) for e in entities]),
    } if entities else {}

    # platform activity (share of stored mentions by platform) + coverage.
    # Coverage answers the first question a client asks of any number on the
    # dashboard: "based on what?" Without it, every score is an unbacked claim.
    platform_activity, coverage = [], {}
    try:
        from collections import Counter
        rows = await db.select(
            "mentions", "select=platform,source,engagement,created_at&order=created_at.desc&limit=3000")
        pc = Counter((r.get("platform") or "x") for r in rows)
        tot = sum(pc.values()) or 1
        platform_activity = [{"platform": p, "count": c, "pct": round(c / tot * 100)}
                             for p, c in pc.most_common()]
        # `rows` is a capped sample — the honest total needs an exact count.
        total_signals = await db.count("mentions")
        sample = len(rows)
        coverage = {
            "signals": total_signals,               # None if the count is unavailable
            "sample": sample,                       # rows the sums below are computed over
            "platforms": len(pc),
            "sources": len({r.get("source") for r in rows if r.get("source")}),
            "engagement": sum(int(r.get("engagement") or 0) for r in rows),
            "latest": max((r.get("created_at") for r in rows if r.get("created_at")), default=None),
            # comments live in facebook_comments, which migration 011 creates. Until
            # it is applied the table does not exist, so the figure is omitted rather
            # than shown as 0.
            "comments": None,
        }
    except Exception:
        pass

    # executive AI brief (one Sonnet call per 3h build — cheap, cached)
    from app.services import ai
    facts = (
        f"أبرز الكيانات خطراً: {'، '.join(e['name'] + ' (خطر ' + str(e['risk']) + ')' for e in top_risk[:3]) or 'لا يوجد'}. "
        f"أكبر تغيّرات السمعة: {'، '.join(e['name'] + ' ' + ('+' if e['rep_delta'] >= 0 else '') + str(e['rep_delta']) for e in movers[:3]) or 'مستقرة'}. "
        f"حملات مشتبهة نشطة: {len(campaigns)} ({'، '.join('#' + (c.get('hashtag') or '') for c in campaigns[:3]) or '—'}). "
        f"سرديات صاعدة: {'، '.join(n['narrative'] for n in rising_narratives[:3]) or '—'}. "
        f"مؤشرات الخطر العامة: سياسي {risk_summary.get('political', 0)}، سمعة {risk_summary.get('reputation', 0)}، أزمة {risk_summary.get('crisis', 0)}. "
        f"عدد الكيانات المرصودة: {len(entities)}."
    )
    executive = await ai.command_brief(facts)

    digest = {
        "generated_at": now_ts or time.time(),
        "entities": sorted(entities, key=lambda e: -e["influence"]),
        "top_risk": top_risk, "movers": movers, "rising": rising,
        "rising_narratives": rising_narratives, "emotion_heatmap": heatmap,
        "trending": trending, "active_campaigns": campaigns, "geo": geo,
        "national_sentiment": national_sentiment,
        "executive": executive, "risk_summary": risk_summary,
        "platform_activity": platform_activity,
        "coverage": coverage,
        "count": len(entities),
    }
    await redis_client.set(DIGEST_KEY, json.dumps(digest, ensure_ascii=False), ex=_TTL)
    # durable copy → national picture survives Redis outages/limits (reuses system_settings)
    try:
        if db.enabled():
            await db.insert("system_settings",
                            {"key": _SB_KEY, "value_json": {"v": digest}, "category": "internal"},
                            upsert=True, on_conflict="key")
    except Exception:
        pass
    return digest
