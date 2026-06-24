"""Trend forecasting — first version, deliberately simple (rolling averages,
z-scores, linear regression, moving-window acceleration). No ML yet.

Input is a time-bucketed volume series (oldest→newest), e.g. per-hour mention
counts. Everything is pure and unit-testable. Companion to trends.py.
"""
import math


def _linreg(ys):
    """Least-squares slope+intercept over x = 0..n-1. Returns (slope, intercept)."""
    n = len(ys)
    if n < 2:
        return 0.0, (ys[0] if ys else 0.0)
    xs = list(range(n))
    mx = sum(xs) / n
    my = sum(ys) / n
    den = sum((x - mx) ** 2 for x in xs) or 1e-9
    slope = sum((xs[i] - mx) * (ys[i] - my) for i in range(n)) / den
    return slope, my - slope * mx


def _zscores(series):
    n = len(series)
    if n < 2:
        return [0.0] * n
    mean = sum(series) / n
    sd = math.sqrt(sum((v - mean) ** 2 for v in series) / n) or 1e-9
    return [(v - mean) / sd for v in series]


def velocity(series, window=6):
    """Recent growth rate: slope of the last `window` buckets (posts/bucket)."""
    if len(series) < 2:
        return 0.0
    seg = series[-window:]
    slope, _ = _linreg(seg)
    return round(slope, 3)


def acceleration(series, window=6):
    """Change in velocity: slope of the first-differences over the last window."""
    if len(series) < 3:
        return 0.0
    diffs = [series[i + 1] - series[i] for i in range(len(series) - 1)]
    slope, _ = _linreg(diffs[-window:])
    return round(slope, 3)


def momentum(series, window=6):
    """Recent volume scaled by growth direction → 0..100."""
    if not series:
        return 0
    recent = sum(series[-window:])
    base = (sum(series) / len(series)) * window or 1
    v = velocity(series, window)
    raw = (recent / base) * (1 + max(-0.9, min(2.0, v / (base / window + 1e-9))))
    return round(min(100, max(0, raw * 33)))


def persistence(series):
    """How many trailing buckets stay above the rolling mean (sustained, not a blip)."""
    if not series:
        return 0
    mean = sum(series) / len(series)
    count = 0
    for v in reversed(series):
        if v >= mean:
            count += 1
        else:
            break
    return count


def predicted_peak(series, bucket_minutes=60):
    """Rough peak ETA. If decelerating while still rising, extrapolate where
    velocity hits zero; else flag already-peaked / still-climbing."""
    v = velocity(series)
    a = acceleration(series)
    if v <= 0:
        return {"status": "peaked_or_declining", "eta_minutes": None}
    if a >= -1e-6:
        return {"status": "still_climbing", "eta_minutes": None}
    buckets_ahead = max(0.0, -v / a)
    return {"status": "approaching_peak",
            "eta_minutes": round(buckets_ahead * bucket_minutes),
            "buckets_ahead": round(buckets_ahead, 1)}


def major_trend_probability(series):
    """0..1 likelihood of becoming a major trend, from latest z-score + growth
    + persistence via a logistic squash."""
    if len(series) < 3:
        return 0.0
    z = _zscores(series)[-1]
    v = velocity(series)
    p = persistence(series) / max(1, len(series))
    score = 0.9 * z + 0.6 * (1 if v > 0 else -0.5) * min(3, abs(v)) + 1.4 * p - 1.0
    return round(1 / (1 + math.exp(-score)), 3)


def estimated_reach(series, avg_followers=0, dedup=0.45):
    """Crude reach estimate: total volume × average audience × overlap discount."""
    total = sum(series)
    if avg_followers <= 0:
        avg_followers = 1500          # conservative default for IQ accounts
    return int(total * avg_followers * (1 - dedup))


def forecast(series, bucket_minutes=60, avg_followers=0):
    """Bundle every metric for a volume series."""
    series = [float(x) for x in (series or [])]
    return {
        "buckets": len(series),
        "velocity": velocity(series),
        "acceleration": acceleration(series),
        "momentum": momentum(series),
        "persistence": persistence(series),
        "latest_zscore": round(_zscores(series)[-1], 2) if len(series) >= 2 else 0.0,
        "predicted_peak": predicted_peak(series, bucket_minutes),
        "major_trend_probability": major_trend_probability(series),
        "estimated_reach": estimated_reach(series, avg_followers),
    }
