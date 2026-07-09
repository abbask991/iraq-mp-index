"""Angry narratives (§3.3) — recurring anger-laden storylines.

v1 groups items by shared salient terms (bigram/keyword clustering) and scores
each cluster's anger intensity, volume and velocity. Titles can be upgraded to
AI-generated ones in explanation.py; here they are rule-based and safe.
"""
from collections import Counter, defaultdict

from app.services.indices.public_anger import lexicons as lx
from app.services.indices.public_anger import component_scores as cs

_STOP = lx._nw({"في", "من", "على", "الى", "عن", "مع", "هذا", "هذه", "الي", "اللي", "كل",
                "يا", "او", "ان", "انه", "لا", "ما", "هو", "هي", "بس", "شنو", "ليش", "بعد"})


def _key_terms(items: list, k: int = 6) -> list:
    c = Counter()
    for it in items:
        for t in set(lx.tokens(it.get("text", ""))):
            if len(t) >= 3 and t not in _STOP:
                c[t] += 1
    return [w for w, _ in c.most_common(k)]


def extract(items: list, limit: int = 5) -> list:
    terms = _key_terms(items, 8)
    buckets = defaultdict(list)
    for it in items:
        toks = set(lx.tokens(it.get("text", "")))
        for term in terms:
            if term in toks:
                buckets[term].append(it)
                break
    out = []
    for term, its in buckets.items():
        if len(its) < 2:
            continue
        plats = Counter((i.get("platform") or "news").lower() for i in its)
        ents = Counter(e for i in its for e in (i.get("entities") or []))
        intensity = cs.anger_emotion(its)
        out.append({
            "narrative_id": term,
            "narrative_title": f"جدل حول «{term}»",
            "narrative_summary": f"تكرار مكثّف لمنشورات/تعليقات مرتبطة بـ«{term}» بنبرة سلبية.",
            "anger_intensity_score": intensity,
            "volume": len(its),
            "velocity": min(100, len(its) * 6),
            "confidence_score": min(90, 40 + len(its) * 4),
            "top_entities": [e for e, _ in ents.most_common(3)],
            "top_platforms": [{"platform": p, "count": c} for p, c in plats.most_common(3)],
            "evidence": [{"text": i.get("text", "")[:200], "platform": i.get("platform"),
                          "source": i.get("source"), "url": i.get("url")} for i in its[:3]],
        })
    out.sort(key=lambda n: -(n["anger_intensity_score"] * n["volume"]))
    return out[:limit]
