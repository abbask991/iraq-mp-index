"""Narrative Dominance + Threat scoring.

Dominance = how much a narrative owns the public conversation right now.
Threat    = how dangerous that narrative is (sentiment, coordination, reach…).
Both return 0-100; threat also bands into low|medium|high|critical.
"""

_W = dict(mention_share=0.25, velocity=0.20, cross_platform=0.15,
          influencer=0.15, media=0.10, engagement=0.10, persistence=0.05)


def _clamp(v):
    return max(0.0, min(100.0, float(v or 0)))


def dominance(*, mention_share=0, velocity=0, cross_platform=0, influencer=0,
              media=0, engagement=0, persistence=0):
    s = (_W["mention_share"] * _clamp(mention_share)
         + _W["velocity"] * _clamp(velocity)
         + _W["cross_platform"] * _clamp(cross_platform)
         + _W["influencer"] * _clamp(influencer)
         + _W["media"] * _clamp(media)
         + _W["engagement"] * _clamp(engagement)
         + _W["persistence"] * _clamp(persistence))
    return round(s)


_LABELS = {"critical": "حرج", "high": "مرتفع", "medium": "متوسط", "low": "منخفض"}


def threat(*, sentiment_neg=0, coordination=0, attack_pressure=0, reach=0,
           velocity=0, media=0, political=0):
    raw = (0.20 * _clamp(sentiment_neg) + 0.20 * _clamp(coordination)
           + 0.20 * _clamp(attack_pressure) + 0.10 * _clamp(reach)
           + 0.10 * _clamp(velocity) + 0.10 * _clamp(media)
           + 0.10 * _clamp(political))
    score = round(raw)
    level = ("critical" if score >= 75 else "high" if score >= 55
             else "medium" if score >= 35 else "low")
    return {"score": score, "level": level, "label": _LABELS[level]}
