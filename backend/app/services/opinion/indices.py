"""PPOI weighting + headline indices.

  opinion_weight   per-item importance (0-100): not every opinion counts equally
  PLATFORM_WEIGHTS each platform's signal weight (configurable)
  public_opinion_index   0-100 (very negative … very positive)
  public_pressure_index  0-100 (how much heat is on the target)
  confidence_score 0-100 (how trustworthy the reading is — honest)
"""
import math

PLATFORM_WEIGHTS = {"x": 0.90, "telegram": 0.90, "news": 0.85, "facebook": 0.80,
                    "tiktok": 0.75, "youtube": 0.70, "instagram": 0.60}


def _logn(v, k=20):
    return min(100, math.log10((v or 0) + 1) * k)


def opinion_weight(*, author_influence=0, engagement_quality=0, source_credibility=50,
                   opinion_confidence=0.5, cross_platform=0, originality=70, freshness=70) -> int:
    s = (0.25 * author_influence + 0.20 * engagement_quality + 0.15 * source_credibility
         + 0.15 * opinion_confidence * 100 + 0.10 * cross_platform + 0.10 * originality
         + 0.05 * freshness)
    return round(max(0, min(100, s)))


def public_opinion_score(support_w: float, oppose_w: float) -> float:
    """-100..+100 from weighted support/oppose sums."""
    tot = support_w + oppose_w
    if tot <= 0:
        return 0.0
    return round((support_w - oppose_w) / tot * 100, 1)


def public_opinion_index(*, support, oppose, anger=0, frustration=0, trust=0, satisfaction=0) -> int:
    """0-100. Inputs are fractions 0..1 (support/oppose of opinionated set; emotions as shares)."""
    idx = (50 + support * 50 - oppose * 50 - anger * 15 - frustration * 10
           + trust * 15 + satisfaction * 10)
    return round(max(0, min(100, idx)))


def opinion_label(idx: int) -> str:
    return ("سلبي جداً" if idx <= 29 else "سلبي" if idx <= 44 else "متباين/محايد"
            if idx <= 55 else "إيجابي" if idx <= 70 else "إيجابي جداً")


def public_pressure_index(*, neg_volume=0, anger=0, velocity=0, cross_platform=0,
                          influencer_amplification=0, complaint_ratio=0, coordination=0) -> int:
    s = (0.25 * neg_volume + 0.20 * anger + 0.15 * velocity + 0.15 * cross_platform
         + 0.10 * influencer_amplification + 0.10 * complaint_ratio + 0.05 * coordination)
    return round(max(0, min(100, s)))


def confidence_score(*, n=0, platforms=1, sources=1, bot_cleanliness=80,
                     classification_conf=60, time_stability=60, geo_coverage=0) -> dict:
    size_c = min(100, n / 20)                          # 2000 items → 100
    plat_c = min(100, platforms / 6 * 100)
    src_c = min(100, _logn(sources, 30))
    s = (0.20 * size_c + 0.20 * plat_c + 0.15 * src_c + 0.15 * bot_cleanliness
         + 0.10 * classification_conf + 0.10 * time_stability + 0.10 * geo_coverage)
    score = round(max(0, min(100, s)))
    label = ("منخفضة" if score < 40 else "متوسطة" if score < 60 else "عالية" if score < 80 else "عالية جداً")
    return {"score": score, "label": label,
            "directional": score < 50}                 # below 50 → directional, not conclusive
