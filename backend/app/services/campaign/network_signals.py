"""Amplification-graph signals: repetitive posters + mutual-mention density."""
from collections import Counter


def network_amplification(tweets, users):
    """Returns score 0-100."""
    n = len(tweets)
    if not n:
        return 0
    posts_by = Counter(t["author_id"] for t in tweets)
    repeat_share = sum(c for c in posts_by.values() if c >= 3) / n
    handles = {u.get("username", "").lower() for u in users.values() if u.get("username")}
    mention_edges = sum(1 for t in tweets for mn in t.get("mentions", []) if mn.lower() in handles)
    mention_density = min(1.0, mention_edges / n)
    return min(100, round(repeat_share * 70 + mention_density * 60))
