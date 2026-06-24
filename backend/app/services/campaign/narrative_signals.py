"""Narrative consistency + cross-platform presence + influencer trigger."""
from collections import Counter

from app.services import trends


def narrative_consistency(tweets):
    """Returns (score 0-100, dominant_narrative_label)."""
    types = Counter(t.get("type", "عام") for t in tweets if t.get("type"))
    if not types:
        return 0, "نقاش عام"
    top, c = types.most_common(1)[0]
    share = c / sum(types.values())
    return min(100, round(share * 100)), trends.NARRATIVE_MAP.get(top, "نقاش عام")


def cross_platform(news_count, total_platforms=2):
    """Returns (score 0-100, platforms_present)."""
    present = 1 + (1 if news_count else 0)
    return round(present / total_platforms * 100), present


def influencer_trigger(users, spread):
    """Returns score 0-100 — was the campaign seeded by an influential account?"""
    infl = [trends.influence_score(u) for u in users.values()] or [1]
    has_early_influential = 1 if (spread or {}).get("first_influential") else 0
    return min(100, round(max(infl) * 8 + has_early_influential * 20))
