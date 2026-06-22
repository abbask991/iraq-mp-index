"""Per-indicator normalization to a comparable 0-100 scale.

Every raw indicator is normalized ACROSS ALL MPs before it is weighted, so that
a count (e.g. bills passed) and a percentage (e.g. attendance) become comparable.
"""

from __future__ import annotations

import pandas as pd


def normalize_series(series: pd.Series, method: str, direction: str = "up") -> pd.Series:
    """Return `series` rescaled to 0-100 using `method`.

    method: "percentile" | "minmax" | "absolute"
    direction: "up" (higher is better) | "down" (lower is better)
    """
    s = pd.to_numeric(series, errors="coerce").astype(float)

    if method == "percentile":
        # Average rank as a percentile; all-equal inputs collapse to ~50.
        out = s.rank(method="average", pct=True) * 100.0
    elif method == "minmax":
        lo, hi = s.min(), s.max()
        out = pd.Series(50.0, index=s.index) if hi == lo else (s - lo) / (hi - lo) * 100.0
    elif method == "absolute":
        # Value is already a 0-100 figure (e.g. attendance %); just clip.
        out = s.clip(lower=0.0, upper=100.0)
    elif method == "top100":
        # Shanghai/ARWU style: best performer = 100, others = value/best * 100.
        hi = s.max()
        out = (s / hi * 100.0) if hi and hi > 0 else pd.Series(0.0, index=s.index)
    else:
        raise ValueError(f"unknown normalization method: {method!r}")

    if direction == "down":
        out = 100.0 - out

    return out.fillna(0.0)
