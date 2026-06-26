"""Influence score + confidence. Adapted from the requested weighting to the
signals we can actually measure (no embeddings / no stored history): lead-lag,
lexical narrative similarity, cross-border engagement, account overlap, media
amplification, hashtag similarity. All inputs 0..1 unless noted."""


def _time_lead(lag_hours: int) -> float:
    if 2 <= lag_hours <= 48:
        return 1.0
    if lag_hours == 1:
        return 0.6
    if 48 < lag_hours <= 72:
        return 0.5
    return 0.15            # 0h (concurrent) or stale (>72h)


def influence(*, lag_hours, correlation, shared_vol, hashtag_overlap, media_ratio) -> int:
    # accounts are now country-exclusive (located), so cross-account overlap is
    # meaningless; weight goes to lead-lag, narrative similarity and reach.
    narrative_sim = 0.5 * max(0.0, correlation) + 0.5 * hashtag_overlap
    cross_eng = min(1.0, shared_vol / 50.0)
    s = (0.35 * _time_lead(lag_hours)
         + 0.30 * narrative_sim
         + 0.20 * cross_eng
         + 0.15 * media_ratio)
    return max(0, min(100, round(s * 100)))


def confidence(*, src_vol, tgt_vol, correlation, lag_hours, located_ok=True) -> int:
    """Stricter: small located samples → low confidence; concurrency (lag 0) caps it."""
    vol_conf = min(1.0, min(src_vol, tgt_vol) / 20.0)
    corr_conf = max(0.0, correlation)
    lag_conf = 1.0 if 2 <= lag_hours <= 72 else (0.5 if lag_hours == 1 else 0.2)
    c = 100 * (0.45 * vol_conf + 0.30 * corr_conf + 0.25 * lag_conf)
    if not located_ok:
        c *= 0.6
    return max(0, min(100, round(c)))
