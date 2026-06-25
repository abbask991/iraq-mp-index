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


async def get_digest():
    """Return the cached digest (or None). Instant — no compute."""
    raw = await redis_client.get(DIGEST_KEY)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
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
            "top_narrative": (twin["narratives"][0]["narrative"] if twin.get("narratives") else None),
            "trajectory": twin["prediction"].get("trajectory"),
            "national_trend_probability": prob,
            "emotions": emo,
            "data_points": twin.get("data_points", 0),
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

    # trending hashtags / active campaigns from the already-cached overview (no new X cost)
    trending, campaigns = [], []
    raw_ov = await redis_client.get("swr:overview:day")
    if raw_ov:
        try:
            ov = json.loads(raw_ov)["v"]
            trending = (ov.get("trending") or [])[:8]
            campaigns = (ov.get("campaigns") or [])[:5]
        except Exception:
            pass

    digest = {
        "generated_at": now_ts or time.time(),
        "entities": sorted(entities, key=lambda e: -e["influence"]),
        "top_risk": top_risk, "movers": movers, "rising": rising,
        "rising_narratives": rising_narratives, "emotion_heatmap": heatmap,
        "trending": trending, "active_campaigns": campaigns,
        "count": len(entities),
    }
    await redis_client.set(DIGEST_KEY, json.dumps(digest, ensure_ascii=False), ex=_TTL)
    return digest
