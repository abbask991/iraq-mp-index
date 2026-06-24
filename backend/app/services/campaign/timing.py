"""Burst / posting-synchronization detection (15-minute sliding window)."""
from app.services.campaign._util import epoch_min


def timing_sync(tweets):
    """Returns (score 0-100, peak_15min_post_ratio)."""
    mins = sorted(m for m in (epoch_min(t["created_at"]) for t in tweets) if m is not None)
    n = len(mins)
    if n < 3:
        return 0, 0.0
    best = 0
    j = 0
    for i in range(n):
        while mins[i] - mins[j] > 15:
            j += 1
        best = max(best, i - j + 1)
    peak_ratio = best / n
    return min(100, round(peak_ratio * 130)), round(peak_ratio, 2)
