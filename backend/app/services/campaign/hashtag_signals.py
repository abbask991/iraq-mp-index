"""Hashtag-engineering detection: stuffing + repeated combos."""
from collections import Counter


def hashtag_pattern(tweets, users=None):
    """Returns (score 0-100, top_hashtags)."""
    n = len(tweets)
    all_tags = [h for t in tweets for h in t.get("hashtags", [])]
    avg_tags = len(all_tags) / n if n else 0
    combos = Counter(tuple(sorted(set(t.get("hashtags", [])))) for t in tweets if len(t.get("hashtags", [])) >= 2)
    top_combo = combos.most_common(1)
    combo_share = (top_combo[0][1] / n) if (top_combo and n) else 0
    stuffing = max(0, avg_tags - 1) * 14
    score = min(100, round(stuffing + combo_share * 70))
    top_tags = [{"hashtag": h, "count": c} for h, c in Counter(all_tags).most_common(8)]
    return score, top_tags
