"""Visual verification orchestrator (Phase-1 MVP).

fetch → metadata + perceptual hash → reverse-search adapter → scores → status →
evidence report → best-effort store. Probabilistic only; confidence reflects how
much real evidence was available (low when no reverse-search provider is set).
"""
import hashlib
import time

import httpx

from app.services.visual_verification import fingerprints, metadata, reverse_search

_MAX_BYTES = 8 * 1024 * 1024


def _level(s: int) -> str:
    return "حرج" if s >= 76 else "مرتفع" if s >= 51 else "متوسط" if s >= 26 else "منخفض"


def _vid(seed: str) -> str:
    return "vv_" + hashlib.sha1((seed + str(int(time.time()))).encode("utf-8")).hexdigest()[:16]


async def _fetch(url: str) -> bytes | None:
    try:
        async with httpx.AsyncClient(follow_redirects=True) as c:
            r = await c.get(url, timeout=30)
            if r.status_code != 200:
                return None
            ct = r.headers.get("content-type", "")
            if "image" not in ct and not url.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                return None
            data = r.content
            return data if data and len(data) <= _MAX_BYTES else None
    except Exception:
        return None


def _score(meta: dict, rev: dict, claim: str | None) -> dict:
    matches = rev.get("results") or []
    has_provider = rev.get("configured")
    older = [m for m in matches if m.get("first_seen_date")]

    # reverse-search reuse risk
    if not has_provider:
        rev_risk = None
    else:
        rev_risk = min(100, len(matches) * 12 + (25 if older else 0))

    # manipulation (MVP: metadata editing-software heuristic only)
    sw = (meta.get("software") or "").lower()
    manip = 35 if any(s in sw for s in ("photoshop", "gimp", "snapseed", "pixlr")) else 8
    # ai-generation not run in MVP (Phase 3) — explicit unknown
    ai_gen = None
    # context: needs claim + dated matches (Phase 2) — partial only
    if claim and older:
        ctx_risk = 60
    elif claim and matches:
        ctx_risk = 35
    else:
        ctx_risk = None
    # originality
    if not has_provider:
        orig = None
    else:
        orig = max(0, 100 - len(matches) * 15 - (20 if older else 0)) if matches else (75 if meta.get("camera") else 55)

    # overall (treat unknowns as 0 contribution, but lower confidence)
    def z(v):
        return v or 0
    src_cred_risk = 0
    overall = round(0.30 * z(ctx_risk) + 0.25 * manip + 0.20 * z(ai_gen)
                    + 0.15 * z(rev_risk) + 0.10 * src_cred_risk)

    # confidence reflects evidence availability
    conf = 30
    if has_provider:
        conf += 30
    if meta.get("exif"):
        conf += 15
    if claim:
        conf += 10
    conf = min(conf, 90)

    return {"originality": orig, "context_risk": ctx_risk, "manipulation": manip,
            "ai_generation": ai_gen, "reverse_search_risk": rev_risk,
            "overall_risk": overall, "confidence": conf}


def _status(sc: dict, rev: dict) -> tuple[str, str]:
    if not rev.get("configured"):
        return "needs_review", "تقييم محدود — لا بحث عكسي مهيّأ بعد؛ يُنصح بمراجعة بشرية."
    if (sc.get("context_risk") or 0) >= 50:
        return "old_image", "يُرجّح أن الصورة قديمة/خارج السياق مقارنةً بالمطابقات الأقدم."
    if (sc.get("manipulation") or 0) >= 50:
        return "manipulated", "إشارات تحرير محتملة — تتطلّب فحصاً جنائياً أعمق."
    if rev.get("results"):
        return "uncertain", "وُجدت مطابقات سابقة — راجع التواريخ والمصادر للتأكّد من السياق."
    return "uncertain", "لا أدلّة قوية على تلاعب ولا مطابقات قديمة — الثقة غير كافية لتأكيد نهائي."


async def analyze(image_url: str | None = None, image_bytes: bytes | None = None,
                  claim: str | None = None, demo: bool = False) -> dict:
    if demo:
        return _demo(claim)
    if image_bytes is None and image_url:
        image_bytes = await _fetch(image_url)
    if not image_bytes:
        return {"error": "FETCH_FAILED", "message": "تعذّر جلب الصورة — تأكّد من الرابط/الصيغة (jpg/png/webp)."}

    meta = metadata.extract(image_bytes)
    fp = fingerprints.compute(image_bytes)
    rev = await reverse_search.search(image_url=image_url, image_bytes=image_bytes)
    sc = _score(meta, rev, claim)
    status, summary = _status(sc, rev)

    evidence = []
    for s in meta.get("signals", []):
        evidence.append({"evidence_type": "metadata", "description": s, "confidence": "متوسط"})
    if not rev.get("configured"):
        evidence.append({"evidence_type": "reverse_search", "description": rev.get("note"), "confidence": "—"})
    for m in (rev.get("results") or [])[:8]:
        evidence.append({"evidence_type": "reverse_match", "description": m.get("title") or m.get("source"),
                         "source_url": m.get("matched_page_url"), "confidence": "متوسط"})

    rec = ("أرسلها لمحلّل بشري للمراجعة." if status in ("needs_review", "manipulated")
           else "تعامل معها بحذر حتى تأكيد السياق." if status == "old_image"
           else "استمر بالمراقبة؛ الثقة غير كافية لتقييم نهائي.")

    report = {
        "verification_id": _vid((fp.get("phash") or "") + (image_url or "")),
        "status": status, "status_label": _STATUS_AR.get(status, status),
        "overall_risk_score": sc["overall_risk"], "risk_level": _level(sc["overall_risk"]),
        "confidence_score": sc["confidence"], "summary": summary,
        "first_seen_date": (rev.get("results") or [{}])[0].get("first_seen_date") if rev.get("results") else "unknown",
        "first_seen_source": (rev.get("results") or [{}])[0].get("source") if rev.get("results") else "unknown",
        "scores": sc, "fingerprints": fp, "metadata_analysis": meta,
        "reverse_search_results": rev.get("results") or [], "reverse_search": rev,
        "similar_images": (rev.get("results") or [])[:8],
        "ai_generation_analysis": {"ai_generated_probability": None, "confidence": None,
                                   "note": "كشف الصور المولّدة بالذكاء الاصطناعي ضمن مرحلة لاحقة (Phase 3)."},
        "forensics_analysis": {"note": "الفحص الجنائي المتقدّم ضمن مرحلة لاحقة (Phase 3)."},
        "context_analysis": {"claim": claim, "context_risk_score": sc.get("context_risk"),
                             "status": "unknown" if sc.get("context_risk") is None else
                             ("likely_misleading" if sc["context_risk"] >= 50 else "uncertain")},
        "evidence": evidence, "recommended_action": rec,
        "claim": claim, "image_url": image_url, "created_at": time.time(),
        "limitations": ["نتائج البحث العكسي أدلّة لا إثبات نهائي.", "غياب الـEXIF لا يُثبت تلاعباً.",
                        "كشف الذكاء الاصطناعي احتمالي وقد يخطئ.", "الحالات السياسية/السمعة تتطلّب مراجعة بشرية."],
        "disclaimer": "تقرير تحقّق احتمالي آلي — يتطلّب مراجعة بشرية قبل أي حكم قاطع.",
    }
    await _store(report)
    return report


_STATUS_AR = {"original": "أصلية / لا إشارات تلاعب قوية", "old_image": "صورة قديمة مُعاد استخدامها",
              "misleading": "سياق مُضلّل", "manipulated": "تلاعب بصري محتمل",
              "ai_generated": "يُحتمل توليدها بالذكاء الاصطناعي", "uncertain": "غير مؤكّدة",
              "needs_review": "تتطلّب مراجعة بشرية"}


async def _store(report: dict) -> None:
    try:
        from app.services import db
        if not db.enabled():
            return
        await db.insert("visual_verifications", {
            "id": report["verification_id"], "image_url": report.get("image_url"),
            "image_hash": (report.get("fingerprints") or {}).get("ahash"),
            "perceptual_hash": (report.get("fingerprints") or {}).get("phash"),
            "status": report["status"], "overall_risk_score": report["overall_risk_score"],
            "confidence_score": report["confidence_score"], "summary": report["summary"],
            "first_seen_date": None if report["first_seen_date"] == "unknown" else report["first_seen_date"],
            "first_seen_source": None if report["first_seen_source"] == "unknown" else report["first_seen_source"],
            "metadata_json": report.get("metadata_analysis"), "forensics_json": report.get("forensics_analysis"),
            "ai_detection_json": report.get("ai_generation_analysis"), "context_json": report.get("context_analysis"),
            "reverse_search_json": report.get("reverse_search"), "evidence_json": report.get("evidence"),
        }, upsert=True, on_conflict="id")
    except Exception:
        pass


async def get(vid: str) -> dict | None:
    try:
        from app.services import db
        rows = await db.select("visual_verifications", f"select=*&id=eq.{vid}&limit=1")
        return rows[0] if rows else None
    except Exception:
        return None


def _demo(claim: str | None = None) -> dict:
    return {
        "verification_id": "vv_demo_electricity", "status": "old_image",
        "status_label": _STATUS_AR["old_image"],
        "overall_risk_score": 78, "risk_level": "حرج", "confidence_score": 86,
        "summary": "تُظهر الأدلّة أن الصورة نُشرت أول مرة عام 2020 وتُستخدم الآن مرتبطة بحدث 2026 — سياق مُضلّل على الأرجح.",
        "first_seen_date": "2020-07-14", "first_seen_source": "وكالة أنباء (أرشيف)",
        "scores": {"originality": 22, "context_risk": 72, "manipulation": 18, "ai_generation": 9,
                   "reverse_search_risk": 64, "overall_risk": 78, "confidence": 86},
        "fingerprints": {"ahash": "f0e0c0c1c3c7cfff", "dhash": "a1b2c3d4e5f60718", "phash": "a1b2c3d4e5f60718",
                         "dominant_colors": ["#3b3b3b", "#a89070", "#d8d2c4"]},
        "metadata_analysis": {"format": "JPEG", "width": 1280, "height": 720, "camera": None,
                              "software": None, "has_gps": False,
                              "signals": ["لا توجد بيانات EXIF — أُعيد ضغطها عبر السوشال (لا يُثبت تلاعباً).",
                                          "أبعاد ونسبة ضغط تطابق صور 2020 المؤرشفة."]},
        "reverse_search_results": [
            {"matched_page_url": "https://example-archive.org/2020/flood", "title": "أرشيف 2020 — فيضان",
             "source": "archive.org", "first_seen_date": "2020-07-14", "similarity_score": 96, "provider": "demo"},
            {"matched_page_url": "https://news.example/2021/report", "title": "تقرير 2021",
             "source": "news.example", "first_seen_date": "2021-03-02", "similarity_score": 91, "provider": "demo"},
        ],
        "similar_images": [{"title": "أرشيف 2020", "source": "archive.org", "similarity_score": 96}],
        "ai_generation_analysis": {"ai_generated_probability": 9, "confidence": 40, "signals": ["لا أنماط توليد واضحة"]},
        "forensics_analysis": {"note": "لا إشارات تلاعب قوية؛ المشكلة في السياق لا الصورة نفسها."},
        "context_analysis": {"claim": claim or "صورة من أحداث اليوم", "context_risk_score": 72,
                             "status": "likely_misleading",
                             "explanation": "الصورة أقدم بـ6 سنوات من الحدث المزعوم — تُستخدم خارج سياقها."},
        "timeline": [{"platform": "facebook", "date": "2026-06-29", "detail": "نُشرت مرتبطة بحدث اليوم"},
                     {"platform": "x", "date": "2026-06-29", "detail": "أُعيد تداولها بنفس الادعاء"}],
        "evidence": [
            {"evidence_type": "reverse_match", "description": "أقدم ظهور 2020 على أرشيف موثوق", "confidence": "مرتفع",
             "source_url": "https://example-archive.org/2020/flood"},
            {"evidence_type": "context", "description": "فارق 6 سنوات بين الصورة والحدث المزعوم", "confidence": "مرتفع"},
            {"evidence_type": "metadata", "description": "أبعاد تطابق نسخة 2020", "confidence": "متوسط"},
        ],
        "recommended_action": "تعامل معها كمضلّلة ما لم تُثبت أدلّة جديدة الادعاء.",
        "claim": claim, "image_url": None, "demo": True,
        "limitations": ["نتائج البحث العكسي أدلّة لا إثبات نهائي.", "كشف الذكاء الاصطناعي احتمالي."],
        "disclaimer": "🧪 وضع العرض — تقرير تجريبي يوضّح المخرجات.",
    }
