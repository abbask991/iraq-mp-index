"""Facebook Reaction Intelligence (spec §4).

Facebook's 7 reactions carry mood that a raw count hides:
  High Angry → public anger     High Sad → sympathy / crisis pain
  High Haha  → ridicule/sarcasm High Love → support     High Wow → shock

Polarity (from REACTIONS): Like/Love/Care = positive, Angry/Sad = negative,
Haha/Wow = ambiguous (stored separately, NOT folded into the score).

Reaction Mood Score = positives vs negatives, normalized to 0..100
  (50 = neutral balance, >50 = net positive, <50 = net negative).
"""
from app.services.facebook import REACTIONS

_POS = [k for k, _e, _a, p, _f in REACTIONS if p == "pos"]
_NEG = [k for k, _e, _a, p, _f in REACTIONS if p == "neg"]
_AMB = [k for k, _e, _a, p, _f in REACTIONS if p == "amb"]
_META = {k: {"emoji": e, "label": a, "polarity": p} for k, e, a, p, _f in REACTIONS}

# what a dominant reaction signals (for the UI interpretation line)
_SIGNAL = {
    "angry": ("غضب شعبي", "anger"),
    "sad": ("تعاطف / ألم أزمة", "sadness"),
    "haha": ("سخرية / استهزاء", "ridicule"),
    "love": ("تأييد قوي", "love"),
    "wow": ("صدمة / مفاجأة", "shock"),
    "care": ("تعاطف داعم", "care"),
    "like": ("قبول عام", "approval"),
}


def _counts(row: dict) -> dict:
    """Pull the 7 reaction counts off a normalized post row OR a raw counts dict."""
    if "reactions_like" in row:                       # facebook_posts row
        return {k: int(row.get(f"reactions_{k}") or 0) for k in _META}
    if "reactions" in row and isinstance(row["reactions"], dict):  # _metrics() shape
        return {k: int(row["reactions"].get(k) or 0) for k in _META}
    return {k: int(row.get(k) or 0) for k in _META}


def mood_score(counts: dict) -> int | None:
    """0..100. Ambiguous reactions are excluded from the score (stored separately)."""
    pos = sum(counts.get(k, 0) for k in _POS)
    neg = sum(counts.get(k, 0) for k in _NEG)
    denom = pos + neg
    if denom == 0:
        return None
    return round(pos / denom * 100)


def breakdown(rows) -> dict:
    """Aggregate a reaction breakdown over one or many posts/rows.
    `rows` may be a single row dict or an iterable of rows."""
    if isinstance(rows, dict):
        rows = [rows]
    agg = {k: 0 for k in _META}
    for r in rows:
        c = _counts(r)
        for k in _META:
            agg[k] += c[k]
    total = sum(agg.values()) or 1
    pos = sum(agg[k] for k in _POS)
    neg = sum(agg[k] for k in _NEG)
    amb = sum(agg[k] for k in _AMB)
    mix = [{"key": k, "emoji": _META[k]["emoji"], "label": _META[k]["label"],
            "polarity": _META[k]["polarity"], "count": agg[k],
            "pct": round(agg[k] / total * 100)} for k in _META]
    dominant = max(_META, key=lambda k: agg[k]) if total > 1 else None
    return {
        "mix": mix,
        "total": sum(agg.values()),
        "positive": pos, "negative": neg, "ambiguous": amb,
        "mood_score": mood_score(agg),
        "dominant": dominant,
        "dominant_signal": (_SIGNAL.get(dominant, ("—", "—"))[0] if dominant else None),
        "dominant_emotion": (_SIGNAL.get(dominant, ("—", "—"))[1] if dominant else None),
    }


def annotate_post(post_row: dict) -> dict:
    """Fill reaction_mood + dominant_emotion on a normalized post row (in place)."""
    c = _counts(post_row)
    post_row["reaction_mood"] = mood_score(c)
    dom = max(_META, key=lambda k: c[k]) if sum(c.values()) else None
    post_row["dominant_emotion"] = _SIGNAL.get(dom, (None, None))[1] if dom else None
    return post_row
