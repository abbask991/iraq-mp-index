"""Reputation & Public-Trust scoring.

Explainable by design: every score returns its component contributions and the
top drivers, so an analyst can defend the number. Pure functions over simple
aggregates → unit-testable and reusable from live or stored data.
"""


def _grade(s):
    return ("A+" if s >= 85 else "A" if s >= 75 else "B" if s >= 60
            else "C" if s >= 45 else "D" if s >= 30 else "E")


def reputation_score(pos, neg, neu, *, reach=0, source_credibility=0.5,
                     bot_ratio=0.0, prev=None):
    """0-100 reputation from sentiment balance, audience quality, source trust.
    `prev` (previous score) yields a delta + direction for the historical trend."""
    total = pos + neg + neu
    if total == 0:
        return {"score": 50, "grade": "C", "components": {}, "drivers": ["لا بيانات كافية"], "delta": None}

    sentiment = (pos - neg) / total                       # -1..1
    sentiment_c = (sentiment + 1) / 2 * 100               # 0..100
    import math
    visibility_c = min(100, math.log10(total + 1) * 33)
    reach_c = min(100, math.log10(reach + 1) * 14) if reach else 40
    integrity_c = (1 - bot_ratio) * 100                  # manipulated buzz hurts
    credibility_c = source_credibility * 100

    components = {
        "sentiment": round(sentiment_c), "visibility": round(visibility_c),
        "reach": round(reach_c), "integrity": round(integrity_c),
        "source_credibility": round(credibility_c),
    }
    weights = {"sentiment": 0.40, "visibility": 0.15, "reach": 0.15,
               "integrity": 0.15, "source_credibility": 0.15}
    score = round(sum(components[k] * w for k, w in weights.items()))
    drivers = sorted(components.items(), key=lambda kv: -kv[1])
    return {
        "score": score, "grade": _grade(score), "components": components,
        "drivers": [k for k, _ in drivers[:2]],
        "delta": (score - prev) if prev is not None else None,
        "explain": "السمعة = توازن النبرة (40%) + الظهور + الوصول + النزاهة (ضد التلاعب) + مصداقية المصادر.",
    }


def public_trust_score(pos, neg, neu, *, trust_emotion_share=0.0, anger_share=0.0,
                       bot_ratio=0.0):
    """0-100 public trust: trust/positive emotion minus anger and manufactured buzz."""
    total = pos + neg + neu
    if total == 0:
        return {"score": 50, "components": {}, "drivers": []}
    positive_c = pos / total * 100
    trust_c = trust_emotion_share * 100
    anger_penalty = anger_share * 100
    integrity_c = (1 - bot_ratio) * 100
    score = round(max(0, min(100, 0.35 * positive_c + 0.30 * trust_c
                             + 0.20 * integrity_c - 0.15 * anger_penalty + 15)))
    return {
        "score": score, "grade": _grade(score),
        "components": {"positive": round(positive_c), "trust_emotion": round(trust_c),
                       "anger_penalty": round(anger_penalty), "integrity": round(integrity_c)},
        "drivers": ["ثقة" if trust_c >= anger_penalty else "غضب جماهيري"],
        "explain": "ثقة الجمهور = إيجابية + مشاعر الثقة + النزاهة − الغضب.",
    }
