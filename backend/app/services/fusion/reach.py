"""Cross-platform engagement normalization.

A like on X, a view on TikTok, and a share on Facebook are NOT comparable as-is.
This module converts each platform's engagement into a single comparable unit —
estimated REACH (impressions) — so signals from all platforms can be aggregated
and ranked on one scale.

Rule: if real views/impressions exist (TikTok/YouTube/X), use them. Otherwise
estimate reach from interactions (≈4% engagement rate) and audience size.
"""

# multiplier on interactions → estimated reach when no view count is available
_ENGAGEMENT_TO_REACH = 25            # ~4% engagement rate
_AUDIENCE_SEEN = 0.10                # fraction of followers that typically see a post

# how much each interaction type signals impact (for the impact score, not reach)
_IMPACT_W = {"likes": 1.0, "shares": 3.0, "comments": 2.0, "views": 0.02}


# a news article ≈ this many impressions (media authority proxy; no engagement data)
_NEWS_BASE_REACH = 8000


def estimated_reach(platform: str, eng: dict, followers: int = 0) -> int:
    eng = eng or {}
    if platform == "news":
        return _NEWS_BASE_REACH                        # media reach proxy per article
    views = int(eng.get("views", 0) or 0)
    if views > 0:
        return views                                   # real impressions
    interactions = (int(eng.get("likes", 0) or 0)
                    + int(eng.get("shares", 0) or 0) * 2
                    + int(eng.get("comments", 0) or 0) * 1.5)
    est = interactions * _ENGAGEMENT_TO_REACH
    return int(max(est, (followers or 0) * _AUDIENCE_SEEN))


def impact(platform: str, eng: dict) -> float:
    eng = eng or {}
    return round(sum(_IMPACT_W[k] * float(eng.get(k, 0) or 0) for k in _IMPACT_W), 1)


def aggregate(posts: list[dict]) -> dict:
    """Sum normalized reach across a mixed-platform post list + per-platform
    breakdown. Each post: {platform, engagement:{...}, author:{followers}}."""
    by_platform: dict = {}
    total_reach = 0
    for p in posts:
        plat = p.get("platform", "x")
        eng = p.get("engagement", {})
        fol = (p.get("author") or {}).get("followers", 0)
        r = estimated_reach(plat, eng, fol)
        total_reach += r
        b = by_platform.setdefault(plat, {"posts": 0, "reach": 0, "interactions": 0})
        b["posts"] += 1
        b["reach"] += r
        b["interactions"] += impact(plat, eng)
    breakdown = [{"platform": k, **v, "reach_share": round(v["reach"] / total_reach * 100) if total_reach else 0}
                 for k, v in by_platform.items()]
    breakdown.sort(key=lambda x: -x["reach"])
    return {"total_reach": int(total_reach), "platforms": breakdown,
            "platform_count": len(by_platform)}
