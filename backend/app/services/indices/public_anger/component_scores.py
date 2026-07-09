"""The 7 weighted components of PAI (§5–§6) — computed locally (no paid AI).

Each item is a dict: { text, platform, engagement (int), emotion? , sentiment? }.
`prev` / `baseline` are optional dicts of prior component values for trend/velocity.
"""
from app.services.indices.public_anger import lexicons as lx

WEIGHTS = {
    "negative_sentiment": 0.30,
    "anger_emotion": 0.25,
    "complaint_volume": 0.15,
    "narrative_velocity": 0.10,
    "engagement_intensity": 0.10,
    "protest_language": 0.05,
    "cross_platform": 0.05,
}

# Facebook anger signals carry extra weight in the Iraqi/Arabic environment (§4).
_PLATFORM_WEIGHT = {"facebook": 1.35, "telegram": 1.1, "x": 1.0, "news": 0.8, "google_news": 0.8}


def _weighted_items(items: list) -> list:
    """Duplicate-weight items by platform so Facebook anger counts more."""
    out = []
    for it in items:
        w = _PLATFORM_WEIGHT.get((it.get("platform") or "").lower(), 1.0)
        out.append(it)
        if w >= 1.3:
            out.append(it)   # a second vote for high-signal platforms
    return out


def negative_sentiment(items: list) -> int:
    pre = [i for i in items if i.get("sentiment") == "negative"]
    ratio = lx._hit_ratio(items, lx.NEGATIVE)
    # if upstream sentiment exists, blend it in
    if items:
        pre_share = len(pre) / len(items)
        ratio = max(ratio, pre_share)
    return lx.scale(ratio, ceiling=0.55)


def anger_emotion(items: list) -> int:
    if not items:
        return 0
    total = 0.0
    for it in items:
        toks = set(lx.tokens(it.get("text", "")))
        hit = 1.0 if (toks & lx.ANGER) else 0.0
        if it.get("emotion") in ("anger", "rage", "frustration"):
            hit = 1.0
        if lx.has_sarcasm(it.get("text", "")):
            hit = max(hit, 0.7)   # sarcasm = veiled anger
        total += hit
    return lx.scale(total / len(items), ceiling=0.5)


def complaint_volume(items: list, baseline: float | None = None) -> int:
    ratio = lx._hit_ratio(items, lx.COMPLAINT)
    if baseline:                              # normalise vs baseline complaint rate
        ratio = ratio / max(baseline, 0.05) * 0.4
    return lx.scale(ratio, ceiling=0.5)


def narrative_velocity(cur_volume: int, prev_volume: int | None) -> int:
    if not prev_volume:
        return 45                              # unknown baseline → moderate, lowers confidence
    growth = (cur_volume - prev_volume) / max(prev_volume, 1)
    return max(0, min(100, round(50 + growth * 80)))


def engagement_intensity(items: list) -> int:
    ang = [i for i in items if (set(lx.tokens(i.get("text", ""))) & lx.ANGER)
           or i.get("emotion") in ("anger", "rage", "frustration")]
    if not ang:
        return 0
    eng = sum(int(i.get("engagement") or 0) for i in ang) / len(ang)
    # log-ish scaling: 0→0, ~50→60, ~200+→~100
    import math
    return max(0, min(100, round(math.log10(eng + 1) * 42)))


def protest_language(items: list) -> int:
    return lx.scale(lx._hit_ratio(items, lx.PROTEST), ceiling=0.25)


def cross_platform(items: list) -> int:
    plats = {(i.get("platform") or "").lower() for i in items if i.get("platform")}
    plats.discard("")
    n = len(plats)
    return {0: 0, 1: 25, 2: 55, 3: 75, 4: 88}.get(n, 100 if n >= 5 else 0)


def compute_all(items: list, prev: dict | None = None, baseline: dict | None = None) -> dict:
    wi = _weighted_items(items)
    prev = prev or {}
    baseline = baseline or {}
    comps = {
        "negative_sentiment": negative_sentiment(wi),
        "anger_emotion": anger_emotion(wi),
        "complaint_volume": complaint_volume(wi, baseline.get("complaint_rate")),
        "narrative_velocity": narrative_velocity(len(items), prev.get("volume")),
        "engagement_intensity": engagement_intensity(wi),
        "protest_language": protest_language(wi),
        "cross_platform": cross_platform(items),
    }
    score = round(sum(comps[k] * WEIGHTS[k] for k in WEIGHTS))
    return {"components": comps, "score": max(0, min(100, score))}
