"""PAI orchestrator (§11) — load → clean → score → confidence → drivers →
narratives → evidence → explanation → persist. Never raises; returns demo when
there's no usable data so the module always presents."""
import time
from collections import Counter, defaultdict

from app.services import db
from app.services.indices.public_anger import (
    collector, preprocess, component_scores as cs, confidence as conf,
    drivers as drv, narratives as narr, explanation as expl, demo as demo_mod, lexicons as lx,
)

WEIGHTS = cs.WEIGHTS
RISK_BANDS = [(25, "Low", "منخفض"), (50, "Moderate", "متوسط"), (75, "High", "مرتفع"), (100, "Critical", "حرج")]


def risk_level(s: float):
    for hi, en, ar in RISK_BANDS:
        if s <= hi:
            return en, ar
    return "Critical", "حرج"


def _trend(change):
    if change is None:
        return "stable", "مستقر"
    if change >= 12:
        return "accelerating", "متسارع"
    if change >= 4:
        return "rising", "متصاعد"
    if change <= -8:
        return "cooling_down", "يهدأ"
    if change <= -3:
        return "declining", "متراجع"
    return "stable", "مستقر"


def _platform_breakdown(items: list) -> list:
    by = defaultdict(list)
    for it in items:
        by[(it.get("platform") or "news").lower()].append(it)
    out = []
    for p, its in by.items():
        neg = lx._hit_ratio(its, lx.NEGATIVE)
        ang = lx._hit_ratio(its, lx.ANGER)
        eng = sum(int(i.get("engagement") or 0) for i in its) / max(len(its), 1)
        out.append({"platform": p, "anger_score": cs.anger_emotion(its), "volume": len(its),
                    "negative_share": round(neg, 2), "anger_share": round(ang, 2),
                    "engagement": round(eng, 1)})
    out.sort(key=lambda x: -x["anger_score"])
    return out


def _entity_breakdown(scope_name: str, score: int, items: list, drivers: list, trend: str) -> list:
    return [{"entity_name": scope_name or "النطاق", "anger_score": score, "anger_volume": len(items),
             "drivers": [d["driver_name"] for d in drivers[:3]],
             "narratives": [], "trend": trend}]


def _timeline(items: list) -> dict:
    by_day = defaultdict(list)
    for it in items:
        d = (it.get("timestamp") or "")[:10]
        if d:
            by_day[d].append(it)
    daily = [{"t": d, "score": cs.compute_all(its)["score"]}
             for d, its in sorted(by_day.items())][-14:]
    return {"daily": daily}


async def _prev_score(scope_type: str, scope_id: str):
    try:
        if db.enabled():
            rows = await db.select(
                "public_anger_index_runs",
                f"select=score,created_at&scope_type=eq.{scope_type}&scope_id=eq.{scope_id}"
                f"&order=created_at.desc&limit=1")
            if rows:
                return float(rows[0].get("score"))
    except Exception:
        pass
    return None


async def _persist(result: dict, org_id: str | None):
    try:
        if not db.enabled():
            return None
        run = await db.insert("public_anger_index_runs", {
            "org_id": org_id, "scope_type": result["scope_type"], "scope_id": result["scope_id"],
            "scope_name": result["scope_name"], "score": result["score"], "risk_level": result["risk_level"],
            "trend": result["trend"], "confidence_score": result["confidence_score"],
            "negative_sentiment_score": result["components"]["negative_sentiment"],
            "anger_emotion_score": result["components"]["anger_emotion"],
            "complaint_volume_score": result["components"]["complaint_volume"],
            "narrative_velocity_score": result["components"]["narrative_velocity"],
            "engagement_intensity_score": result["components"]["engagement_intensity"],
            "protest_language_score": result["components"]["protest_language"],
            "cross_platform_score": result["components"]["cross_platform"],
            "summary": result["explanation"]["summary"], "explanation": result["explanation"],
            "completed_at": "now()",
        }, returning=True)
        return run.get("id") if run else None
    except Exception:
        return None


async def build(scope_type: str = "country", scope_id: str = "iraq", scope_name: str = "العراق",
                period: str = "week", demo: bool = False, allow_ai: bool = True,
                org_id: str | None = None, persist: bool = False) -> dict:
    if demo:
        return demo_mod.payload(scope_name if scope_type != "country" else "وزارة الكهرباء", scope_type)

    started = time.time()
    raw = await collector.load(scope_type, scope_id, scope_name, period)
    items, dup_ratio = preprocess.clean(raw)
    if len(items) < 5:                      # not enough real signal → present demo
        d = demo_mod.payload(scope_name, scope_type)
        d["note"] = "لا توجد بيانات كافية لهذا النطاق حالياً — تُعرض بيانات تجريبية. أضف مصادر/كلمات أو فعّل المزوّدات."
        return d

    scored = cs.compute_all(items)
    score = scored["score"]
    comps = scored["components"]

    platforms = {(i.get("platform") or "").lower() for i in items if i.get("platform")}
    confidence = conf.compute(items, platforms, has_baseline=False, dup_ratio=dup_ratio)
    needs_review = conf.needs_review(score, confidence)

    prev = await _prev_score(scope_type, scope_id)
    change_24h = round(score - prev) if prev is not None else None
    trend_en, trend_ar = _trend(change_24h)
    en, ar = risk_level(score)

    drivers = drv.extract(items)
    narratives = narr.extract(items)
    platform_breakdown = _platform_breakdown(items)
    entity_breakdown = _entity_breakdown(scope_name, score, items, drivers, trend_en)
    evidence = [{"evidence_type": "article" if i.get("platform") == "news" else "post",
                 "platform": i.get("platform"), "source_name": i.get("source"),
                 "source_url": i.get("url"), "content_text": (i.get("text") or "")[:240],
                 "anger_score": cs.anger_emotion([i]), "sentiment": "negative" if (set(lx.tokens(i.get("text", ""))) & lx.NEGATIVE) else "neutral",
                 "emotion": "anger" if (set(lx.tokens(i.get("text", ""))) & lx.ANGER) else None,
                 "engagement": {"raw": int(i.get("engagement") or 0)}, "timestamp": i.get("timestamp")}
                for i in items if (set(lx.tokens(i.get("text", ""))) & lx.NEGATIVE)][:40]

    result = {
        "demo": False, "scope_type": scope_type, "scope_id": scope_id, "scope_name": scope_name,
        "score": score, "risk_level": en, "risk_level_ar": ar,
        "trend": trend_en, "trend_ar": trend_ar,
        "change_24h": change_24h, "change_7d": None,
        "confidence_score": confidence, "confidence_label": conf.label(confidence),
        "confidence_label_ar": conf.label_ar(confidence), "needs_review": needs_review,
        "updated_at": started, "components": comps, "drivers": drivers, "narratives": narratives,
        "platform_breakdown": platform_breakdown, "entity_breakdown": entity_breakdown,
        "evidence": evidence, "timeline": _timeline(items),
        "data_points": len(items),
        "disclaimer": "يقيس الغضب الرقمي المرصود، وليس استطلاعاً سكانياً. مؤشّرات احتمالية تتطلّب مراجعة بشرية.",
    }
    result["explanation"] = await expl.generate(result, allow_ai=allow_ai)
    if persist:
        result["run_id"] = await _persist(result, org_id)
    return result
