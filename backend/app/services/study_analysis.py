"""Digital-opinion analysis (Sprint 3, spec §15,19). Aggregates the collected
study_signals into a real, evidence-linked opinion reading — dominant position,
opinion split, emotions, complaints/demands, and per-platform contribution.
Computed entirely from stored signals; empty until a collection runs.
"""
from app.services import db


async def _signals(org_id: str, study_id: str) -> list[dict]:
    try:
        if db.enabled():
            rows = await db.select("study_signals",
                                   f"select=*&study_id=eq.{study_id}&organization_id=eq.{org_id}&order=created_at.desc&limit=5000")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


def _dist(rows, key):
    d: dict[str, int] = {}
    for r in rows:
        v = r.get(key) or "unclear"
        d[v] = d.get(v, 0) + 1
    return d


def _pct(d: dict, total: int) -> dict:
    return {k: round(v / total * 100) for k, v in d.items()} if total else {}


async def analyze(org_id: str, study_id: str) -> dict:
    rows = await _signals(org_id, study_id)
    n = len(rows)
    if n == 0:
        return {"total": 0, "note": "لا إشارات بعد — شغّل الجمع أولاً."}

    opinion = _dist(rows, "opinion_class")
    emotion = _dist(rows, "emotion")
    ctype = _dist(rows, "content_type")
    platform = _dist(rows, "platform")

    op_pct = _pct(opinion, n)
    support = op_pct.get("support", 0)
    oppose = op_pct.get("oppose", 0)
    dominant = ("سلبي/معارض" if oppose > support and oppose >= 30 else
                "إيجابي/مؤيد" if support > oppose and support >= 30 else "منقسم/محايد")

    # evidence samples: complaints + demands (real, with link)
    complaints = [{"text": (r.get("content_text") or "")[:200], "url": r.get("content_url"),
                   "platform": r.get("platform"), "emotion": r.get("emotion")}
                  for r in rows if r.get("content_type") in ("complaint", "demand")][:15]
    top = [{"text": (r.get("content_text") or "")[:200], "url": r.get("content_url"),
            "platform": r.get("platform"), "opinion": r.get("opinion_class")}
           for r in rows][:20]

    # platform contribution (spec §15)
    by_plat = {}
    for p, c in platform.items():
        pr = [r for r in rows if r.get("platform") == p]
        neg = sum(1 for r in pr if r.get("opinion_class") == "oppose")
        by_plat[p] = {"signals": c, "share": round(c / n * 100),
                      "negative_pct": round(neg / len(pr) * 100) if pr else 0}

    return {
        "total": n,
        "dominant_position": dominant,
        "opinion": {"counts": opinion, "pct": op_pct},
        "emotion": {"counts": emotion, "pct": _pct(emotion, n)},
        "content_type": {"counts": ctype, "pct": _pct(ctype, n)},
        "platform_contribution": by_plat,
        "complaints_demands": complaints,
        "samples": top,
        "disclaimer": "رأي رقمي مرصود من محتوى عام — ليس عيّنة تمثيلية للسكان، ولا يُخلط بإجابات استبيان مباشر.",
    }
