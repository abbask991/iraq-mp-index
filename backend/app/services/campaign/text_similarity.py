"""Duplicate + near-duplicate (copy-paste) text detection."""
from collections import Counter

from app.services.campaign._util import TOK, norm


def text_similarity(tweets):
    """Returns (score 0-100, duplicate_ratio, top_repeated_phrases)."""
    n = len(tweets)
    normed = [norm(t["text"]) for t in tweets]
    counts = Counter(x for x in normed if len(x) > 12)
    dup_posts = sum(c for c in counts.values() if c >= 2)
    dup_ratio = dup_posts / n if n else 0

    toks = [set(TOK.findall(t["text"].lower())) for t in tweets]
    near = 0
    for i in range(n):
        for j in range(i + 1, n):
            a, b = toks[i], toks[j]
            if a and b and len(a & b) / len(a | b) >= 0.6:   # Jaccard near-dup
                near += 1
                break
    near_ratio = near / n if n else 0
    top_phrases = [{"text": t[:120], "count": c} for t, c in counts.most_common(5) if c >= 2]
    score = min(100, round(dup_ratio * 100 + near_ratio * 55))
    return score, dup_ratio, top_phrases
