"""Lead–lag influence math for a shared issue across the two timelines.

Builds an aligned hourly volume curve for each country, finds which country's
activity ONSETS first (the influencer) and by how many hours the other follows,
and scores the influence magnitude from lagged correlation + shared volume + a
plausible lag window. Pure CPU.
"""
import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone


def _dt(p):
    raw = p.get("created_at") or p.get("date") or ""
    try:
        if len(raw) == 10:
            return datetime.fromisoformat(raw).replace(tzinfo=timezone.utc)
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None


def _hourly(posts):
    b = defaultdict(int)
    for p in posts:
        d = _dt(p)
        if d:
            b[d.replace(minute=0, second=0, microsecond=0)] += 1
    return b


def _corr(a, b):
    n = len(a)
    if n < 3:
        return 0.0
    ma, mb = sum(a) / n, sum(b) / n
    va = sum((x - ma) ** 2 for x in a)
    vb = sum((x - mb) ** 2 for x in b)
    if va <= 0 or vb <= 0:
        return 0.0
    cov = sum((a[i] - ma) * (b[i] - mb) for i in range(n))
    return cov / math.sqrt(va * vb)


def _best_lag(lead, follow, max_lag):
    """Best correlation when `follow` is shifted to trail `lead` by `lag` hours."""
    best = (0, 0.0)
    n = len(lead)
    for lag in range(0, min(max_lag, n - 2) + 1):
        c = _corr(lead[:n - lag] if lag else lead, follow[lag:])
        if c > best[1]:
            best = (lag, c)
    return best


def _onset(series):
    if not any(series):
        return None
    pk = max(series)
    thr = max(1, 0.2 * pk)
    for i, v in enumerate(series):
        if v >= thr:
            return i
    return None


def analyze_pair(iq_posts, sy_posts):
    """Return the influence relationship for one shared issue, or None."""
    bi, bs = _hourly(iq_posts), _hourly(sy_posts)
    if not bi or not bs:
        return None
    lo = min(min(bi), min(bs))
    hi = max(max(bi), max(bs))
    grid, t = [], lo
    while t <= hi:
        grid.append(t)
        t += timedelta(hours=1)
    if len(grid) < 3:
        return None
    si = [bi.get(h, 0) for h in grid]
    ss = [bs.get(h, 0) for h in grid]
    oi, os_ = _onset(si), _onset(ss)
    if oi is None or os_ is None:
        return None
    pi = si.index(max(si)) if any(si) else oi
    ps = ss.index(max(ss)) if any(ss) else os_

    # leader = earlier ONSET; tie-break by earlier PEAK; if both tie → concurrent
    if oi != os_:
        iq_leads = oi < os_
        concurrent = False
    elif pi != ps:
        iq_leads = pi < ps
        concurrent = False
    else:
        iq_leads = True
        concurrent = True

    if iq_leads:
        leader, follower, lead_on, fol_on, lser, fser = "IQ", "SY", oi, os_, si, ss
    else:
        leader, follower, lead_on, fol_on, lser, fser = "SY", "IQ", os_, oi, ss, si
    lag_hours = abs(os_ - oi)
    _, corr = _best_lag(lser, fser, max_lag=min(48, len(grid) - 2))
    iq_vol, sy_vol = sum(si), sum(ss)
    shared_vol = min(iq_vol, sy_vol)
    # reward a CLEAR lead-lag (real spillover) over mere concurrency
    lag_clarity = 1.0 if 2 <= lag_hours <= 72 else (0.55 if lag_hours == 1 else 0.15)
    magnitude = round(100 * (0.35 * max(0.0, corr)
                             + 0.30 * min(1.0, shared_vol / 50.0)
                             + 0.35 * lag_clarity))
    return {
        "leader": leader, "follower": follower, "concurrent": concurrent,
        "lag_hours": lag_hours, "correlation": round(corr, 2),
        "magnitude": max(0, min(100, magnitude)),
        "iq_volume": iq_vol, "sy_volume": sy_vol,
        "start": grid[0].isoformat(), "lead_onset": grid[lead_on].isoformat(),
        "follow_onset": grid[fol_on].isoformat(),
        "series": [{"t": grid[i].isoformat(), "iq": si[i], "sy": ss[i]} for i in range(len(grid))],
    }
