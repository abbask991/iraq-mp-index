"""Intelligence timeline — the chronological "story" of a campaign, hashtag,
entity, or narrative: when it first surfaced, where, who amplified it, when it
spiked, when sentiment flipped, when it peaked.

`detect_timeline_milestones` derives events from raw posts + metrics (pure);
`build_timeline` / `add_timeline_event` persist & read them from timeline_events.
"""
from collections import defaultdict
from datetime import datetime, timezone

from app.services import forecast

EVENT_TYPES = [
    "first_seen", "first_telegram_mention", "first_x_mention", "first_news_article",
    "first_influencer_amplification", "velocity_spike", "sentiment_shift",
    "campaign_alert", "official_response", "peak_detected",
]


def _dt(post):
    raw = post.get("created_at") or post.get("date") or ""
    try:
        if len(raw) == 10:                       # date-only (news)
            return datetime.fromisoformat(raw).replace(tzinfo=timezone.utc)
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None


def _platform(post):
    return post.get("platform") or ("x" if post.get("src_type") == "X" else
                                    "telegram" if post.get("src_type") == "Telegram" else
                                    "news" if post.get("src_type") else "x")


def detect_timeline_milestones(posts, metrics=None) -> list[dict]:
    """Derive milestone events from a set of posts (+ optional metrics)."""
    dated = sorted(((p, _dt(p)) for p in posts if _dt(p)), key=lambda x: x[1])
    if not dated:
        return []
    events: list[dict] = []

    def add(etype, when, **meta):
        events.append({"type": etype, "at": when.isoformat(), **meta})

    add("first_seen", dated[0][1], platform=_platform(dated[0][0]))

    seen_platform = set()
    for p, when in dated:
        plat = _platform(p)
        if plat not in seen_platform:
            seen_platform.add(plat)
            etype = {"x": "first_x_mention", "telegram": "first_telegram_mention",
                     "news": "first_news_article"}.get(plat)
            if etype:
                add(etype, when, source=p.get("source"))

    # first influential amplification
    for p, when in dated:
        if (p.get("engagement", 0) or 0) >= 500 or (p.get("influence", 0) or 0) >= 6:
            add("first_influencer_amplification", when, source=p.get("source"),
                engagement=p.get("engagement", 0))
            break

    # hourly volume → velocity spike + peak
    buckets = defaultdict(int)
    neg_buckets = defaultdict(int)
    for p, when in dated:
        key = when.replace(minute=0, second=0, microsecond=0)
        buckets[key] += 1
        if p.get("sentiment") == "سلبي":
            neg_buckets[key] += 1
    ordered = sorted(buckets)
    series = [buckets[k] for k in ordered]
    if len(series) >= 3:
        fc = forecast.forecast(series, bucket_minutes=60)
        # spike = the bucket with the highest z-score above 2
        from app.services.forecast import _zscores
        zs = _zscores(series)
        for i, z in enumerate(zs):
            if z >= 2:
                add("velocity_spike", ordered[i], volume=series[i], zscore=round(z, 2))
                break
        peak_i = max(range(len(series)), key=lambda i: series[i])
        add("peak_detected", ordered[peak_i], volume=series[peak_i],
            major_trend_probability=fc["major_trend_probability"])

    # sentiment shift: first hour where negativity flips majority
    prev_neg_major = None
    for k in ordered:
        total = buckets[k]
        neg_major = (neg_buckets[k] / total) > 0.5 if total else False
        if prev_neg_major is not None and neg_major != prev_neg_major:
            add("sentiment_shift", k, to=("negative" if neg_major else "non_negative"))
            break
        prev_neg_major = neg_major

    if metrics and metrics.get("campaign_score", 0) >= 50:
        add("campaign_alert", dated[-1][1], score=metrics["campaign_score"])

    events.sort(key=lambda e: e["at"])
    return events


# ---- persistence ----
async def add_timeline_event(target_type, target_id, event_type, at=None, **meta):
    from app.services import db
    row = {"target_type": target_type, "target_id": str(target_id),
           "event_type": event_type, "at": at, "meta": meta}
    await db.insert("timeline_events", row)
    return row


async def build_timeline(target_type, target_id, start_date=None, end_date=None):
    """Read stored timeline events for a target within an optional window."""
    from app.services import db
    q = (f"select=event_type,at,meta&target_type=eq.{target_type}"
         f"&target_id=eq.{target_id}&order=at.asc&limit=500")
    if start_date:
        q += f"&at=gte.{start_date}"
    if end_date:
        q += f"&at=lte.{end_date}"
    return await db.select("timeline_events", q)
