"""Intelligence Memory Recall — "has this happened before?".

Cases are RECORDED by analysts: a real past situation plus its dated outcome and
the lesson learned. They are stored per-tenant in system_settings (no schema
migration needed). Recall similarity-matches the current issue against RECORDED
cases only — it never invents a past outcome or lesson. An empty store yields no
recall, which is the honest state until real case history accumulates.

Similarity is deterministic and explainable: entity match + issue/tag overlap +
platform-journey overlap + anger-level proximity, each contributing a stated share.
"""
import re
from datetime import datetime, timezone

from app.services import db

CAP = 200  # keep the per-tenant case log bounded


def _key(owner: str) -> str:
    return f"intel_cases:{owner or 'global'}"


def _words(s) -> set:
    return {w for w in re.split(r"[\s،,.:؛\-_/]+", (s or "").lower()) if len(w) > 2}


def _jaccard(a, b) -> float:
    a, b = set(a or []), set(b or [])
    if not a and not b:
        return 0.0
    return len(a & b) / (len(a | b) or 1)


def similarity(query: dict, case: dict):
    """Return (score 0..1, reasons[]). Weights: entity .35, topic .30, journey .20, anger .15."""
    score = 0.0
    reasons = []
    qe = (query.get("entity") or "").strip().lower()
    ce = (case.get("entity") or "").strip().lower()
    if qe and ce:
        if qe == ce:
            score += 0.35
            reasons.append("الكيان نفسه")
        elif qe in ce or ce in qe:
            score += 0.20
            reasons.append("كيان متقارب")
    j = _jaccard(_words(query.get("issue")) | set(query.get("tags") or []),
                 _words(case.get("issue")) | set(case.get("tags") or []))
    if j:
        score += 0.30 * j
        reasons.append("تشابه الموضوع")
    pj = _jaccard(query.get("platforms"), case.get("platforms"))
    if pj:
        score += 0.20 * pj
        reasons.append("مسار منصّات متشابه")
    qa, ca = query.get("anger_score"), case.get("anger_score")
    if qa is not None and ca is not None:
        prox = 1 - abs(float(qa) - float(ca)) / 100
        if prox > 0:
            score += 0.15 * prox
            if prox > 0.7:
                reasons.append("مستوى غضب متقارب")
    return round(min(1.0, score), 3), reasons


def _difference(query: dict, case: dict) -> str:
    diffs = []
    qp, cp = set(query.get("platforms") or []), set(case.get("platforms") or [])
    only_now = qp - cp
    only_then = cp - qp
    if only_now:
        diffs.append("الآن يظهر أيضاً على: " + "، ".join(sorted(only_now)))
    if only_then:
        diffs.append("سابقاً كان على: " + "، ".join(sorted(only_then)))
    qa, ca = query.get("anger_score"), case.get("anger_score")
    if qa is not None and ca is not None:
        d = int(float(qa) - float(ca))
        if abs(d) >= 8:
            diffs.append(f"مستوى الغضب {'أعلى' if d > 0 else 'أدنى'} بـ{abs(d)} نقطة")
    return " · ".join(diffs) or "لا فروق جوهرية مرصودة."


async def load(owner: str) -> list:
    if not db.enabled():
        return []
    try:
        rows = await db.select("system_settings", f"select=value_json&key=eq.{_key(owner)}&limit=1")
        if rows and isinstance(rows[0].get("value_json"), dict):
            return rows[0]["value_json"].get("cases", []) or []
    except Exception:
        pass
    return []


async def record(owner: str, case: dict) -> dict:
    if not db.enabled():
        return {"saved": False, "note": "قاعدة البيانات غير مهيّأة"}
    cases = await load(owner)
    now = datetime.now(timezone.utc).isoformat()
    case = {
        "id": f"c{len(cases) + 1}",
        "title": (case.get("title") or "").strip(),
        "entity": (case.get("entity") or "").strip(),
        "issue": (case.get("issue") or "").strip(),
        "tags": case.get("tags") or [],
        "anger_score": case.get("anger_score"),
        "risk_level": case.get("risk_level"),
        "platforms": case.get("platforms") or [],
        "started_at": case.get("started_at"),
        "resolved_at": case.get("resolved_at"),
        "outcome": (case.get("outcome") or "").strip(),
        "lesson": (case.get("lesson") or "").strip(),
        "recorded_at": now,
    }
    if not case["title"]:
        return {"saved": False, "note": "العنوان مطلوب"}
    cases = ([case] + cases)[:CAP]
    ok = await db.insert("system_settings",
                         {"key": _key(owner), "value_json": {"cases": cases}, "category": "internal"},
                         upsert=True, on_conflict="key")
    return {"saved": bool(ok), "count": len(cases), "case": case}


async def recall(owner: str, query: dict, top: int = 3, threshold: float = 0.15) -> dict:
    cases = await load(owner)
    scored = []
    for c in cases:
        s, reasons = similarity(query, c)
        if s >= threshold:
            scored.append({**c, "similarity": round(s * 100), "match_reasons": reasons,
                           "current_difference": _difference(query, c)})
    scored.sort(key=lambda x: -x["similarity"])
    return {"available": True, "total_cases": len(cases), "matches": scored[:top]}
