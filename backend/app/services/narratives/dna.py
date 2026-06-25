"""Narrative DNA — a fingerprint per narrative so a new narrative can be compared
against past ones ("84% similar to Narrative #41"). Mirrors campaign_dna but on
the narrative dimensions: keywords, entities, hashtags, emotions, platforms, geo.
"""
from collections import Counter


def fingerprint(*, keywords=None, entities=None, hashtags=None, campaigns=None,
                emotions=None, platforms=None, media=None, geo=None,
                influencers=None, style=None):
    return {
        "keywords": list(keywords or [])[:20],
        "entities": list(entities or [])[:15],
        "hashtags": list(hashtags or [])[:15],
        "campaigns": list(campaigns or [])[:10],
        "emotions": dict(emotions or {}),
        "platforms": list(platforms or []),
        "media": list(media or [])[:10],
        "geo": list(geo or [])[:10],
        "influencers": list(influencers or [])[:10],
        "style": dict(style or {}),
    }


def _jaccard(a, b):
    sa, sb = set(a or []), set(b or [])
    if not sa and not sb:
        return 0.0
    return len(sa & sb) / max(1, len(sa | sb))


def _emotion_cos(a, b):
    keys = set(a or {}) | set(b or {})
    if not keys:
        return 0.0
    import math
    va = [float(a.get(k, 0)) for k in keys]
    vb = [float(b.get(k, 0)) for k in keys]
    na = math.sqrt(sum(x * x for x in va)) or 1
    nb = math.sqrt(sum(x * x for x in vb)) or 1
    return sum(x * y for x, y in zip(va, vb)) / (na * nb)


_SW = dict(keywords=0.30, entities=0.25, hashtags=0.15, campaigns=0.10,
           emotions=0.10, platforms=0.05, geo=0.05)


def similarity(a: dict, b: dict) -> float:
    """0..1 weighted similarity between two narrative fingerprints."""
    if not a or not b:
        return 0.0
    s = (_SW["keywords"] * _jaccard(a.get("keywords"), b.get("keywords"))
         + _SW["entities"] * _jaccard(a.get("entities"), b.get("entities"))
         + _SW["hashtags"] * _jaccard(a.get("hashtags"), b.get("hashtags"))
         + _SW["campaigns"] * _jaccard(a.get("campaigns"), b.get("campaigns"))
         + _SW["emotions"] * _emotion_cos(a.get("emotions"), b.get("emotions"))
         + _SW["platforms"] * _jaccard(a.get("platforms"), b.get("platforms"))
         + _SW["geo"] * _jaccard(a.get("geo"), b.get("geo")))
    return round(s, 3)


async def compare_with_known(dna: dict, *, top=3):
    """Compare a narrative fingerprint with stored narrative DNA in the DB.
    Returns the closest matches as probabilistic similarity signals."""
    try:
        from app.services import db
        if not db.enabled():
            return []
        rows = await db.select("narrative_dna", "select=narrative_id,label,dna&limit=200")
    except Exception:
        return []
    scored = []
    for r in rows or []:
        sim = similarity(dna, r.get("dna") or {})
        if sim > 0:
            scored.append({"narrative_id": r.get("narrative_id"),
                           "label": r.get("label"), "similarity": round(sim * 100)})
    scored.sort(key=lambda x: -x["similarity"])
    return scored[:top]
