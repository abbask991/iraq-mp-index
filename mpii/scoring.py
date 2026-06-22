"""The MPII scoring engine: raw indicators -> normalized dimension scores ->
weighted final index -> grades and rankings."""

from __future__ import annotations

import pandas as pd

from .config import Config
from .normalize import normalize_series


def _tenure_factor(members: pd.DataFrame, cfg: Config) -> pd.Series:
    """Fraction of a full term each MP served, clamped to (0, 1].

    Count indicators are divided by this so a partial-term MP is compared on a
    full-term-equivalent basis instead of being penalized for serving less time.
    """
    if not cfg.tenure_normalization or "served_months" not in members.columns:
        return pd.Series(1.0, index=members.index)
    factor = pd.to_numeric(members["served_months"], errors="coerce").astype(float)
    factor = (factor / cfg.full_term_months).clip(lower=0.05, upper=1.0)
    return factor.fillna(1.0)


def _column(df: pd.DataFrame, name: str) -> pd.Series:
    if name in df.columns:
        return pd.to_numeric(df[name], errors="coerce").astype(float).fillna(0.0)
    return pd.Series(0.0, index=df.index)


def _integrity_score(df: pd.DataFrame, cfg: Config) -> pd.Series:
    icfg = cfg.integrity
    score = pd.Series(float(icfg.get("base", 100)), index=df.index)
    for col, pts in (icfg.get("penalties") or {}).items():
        score = score + _column(df, col) * float(pts)
    for col, pts in (icfg.get("bonuses") or {}).items():
        score = score + (_column(df, col) > 0).astype(float) * float(pts)
    return score.clip(lower=0.0, upper=100.0)


def compute_scores(cfg: Config, members: pd.DataFrame, raw: pd.DataFrame) -> pd.DataFrame:
    """Return a results DataFrame indexed by member_id, sorted by MPII desc."""
    members = members.set_index("member_id")
    raw = raw.set_index("member_id")
    df = members.join(raw, how="left")

    factor = _tenure_factor(members, cfg)

    out = pd.DataFrame(index=df.index)
    out["name"] = df.get("name")
    out["governorate"] = df.get("governorate")
    out["bloc"] = df.get("bloc")
    out["committee"] = df.get("committee")

    final = pd.Series(0.0, index=df.index)

    # ---- normalized "up" dimensions -------------------------------------
    for dim_key, dim in cfg.dimensions.items():
        dim_score = pd.Series(0.0, index=df.index)
        total_w = 0.0
        for ind_key, ind in dim["indicators"].items():
            values = _column(df, ind_key)
            if ind.get("rate"):
                values = values / factor
            if ind.get("sqrt"):
                # ARWU-style transform: tame skewed count data before scaling.
                values = values.clip(lower=0.0) ** 0.5
            method = ind.get("normalization", cfg.normalization_default)
            score = normalize_series(values, method, ind.get("direction", "up"))
            w = float(ind["weight"])
            dim_score += score * w
            total_w += w
        dim_score = dim_score / total_w if total_w else dim_score
        out[f"dim_{dim_key}"] = dim_score.round(2)
        final += dim_score * float(dim["weight"])

    # ---- integrity (penalty-based) --------------------------------------
    if cfg.integrity_weight > 0:
        integ = _integrity_score(df, cfg)
        out["dim_integrity"] = integ.round(2)
        final += integ * cfg.integrity_weight

    # ---- final index, grade ---------------------------------------------
    if cfg.rescale_final_to_top:
        top = final.max()
        if top and top > 0:
            final = final / top * 100.0
    out["mpii"] = final.round(2)
    out["grade"] = out["mpii"].map(cfg.grade_for)

    # ---- activity gate: rank only members above the activity threshold --
    if cfg.activity:
        parts = []
        for ind in cfg.activity.get("indicators", []):
            method = "absolute" if ind.endswith("_pct") else "percentile"
            parts.append(normalize_series(_column(df, ind), method))
        activity = sum(parts) / len(parts) if parts else pd.Series(100.0, index=df.index)
        out["activity_score"] = activity.round(1)
        out["eligible"] = activity >= float(cfg.activity.get("min_score", 0))
    else:
        out["activity_score"] = pd.Series(100.0, index=df.index)
        out["eligible"] = pd.Series(True, index=df.index)

    # ranks are computed ONLY among eligible MPs; the rest get no rank (NaN)
    masked = out["mpii"].where(out["eligible"])
    out["rank_overall"] = masked.rank(ascending=False, method="min")
    out["rank_in_governorate"] = masked.groupby(out["governorate"]).rank(ascending=False, method="min")
    out["rank_in_bloc"] = masked.groupby(out["bloc"]).rank(ascending=False, method="min")

    return out.sort_values("mpii", ascending=False)
