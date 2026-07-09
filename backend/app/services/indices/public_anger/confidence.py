"""Confidence score (§7) — how much to trust a PAI reading.

Depends on data volume, source + platform diversity, evidence quality, and
whether a historical baseline was available. A HIGH anger score with LOW
confidence is flagged for human review.
"""


def label(c: int) -> str:
    return "Very High" if c >= 86 else "High" if c >= 66 else "Medium" if c >= 41 else "Low"


def label_ar(c: int) -> str:
    return {"Very High": "عالية جداً", "High": "عالية", "Medium": "متوسطة", "Low": "منخفضة"}[label(c)]


def compute(items: list, platforms: set, has_baseline: bool, dup_ratio: float = 0.0) -> int:
    n = len(items)
    # volume: 0 items→0, ~40→~70, 150+→~100
    import math
    vol = min(100, math.log10(n + 1) * 46) if n else 0

    plat = {0: 0, 1: 35, 2: 60, 3: 80}.get(len(platforms), 95 if len(platforms) >= 4 else 0)
    base = 100 if has_baseline else 45
    clean = max(0, 100 - dup_ratio * 100)     # heavy duplication → lower confidence

    c = round(0.4 * vol + 0.25 * plat + 0.2 * base + 0.15 * clean)
    return max(0, min(100, c))


def needs_review(score: int, confidence: int) -> bool:
    return score >= 51 and confidence < 55
