"""Entity Workspace (Phase 6) — the unified per-entity page; "the main sales page".

Everything about one monitored entity in one place: header scores, AI/rule summary,
reputation & risk, campaigns, narratives, Facebook intelligence (top posts + comment
intelligence + reaction-comment gap + audience mood), X signals, timeline,
recommendations. Evidence Explorer drills into any of it.

Real mode reuses digital_twin + the Facebook engine. Demo mode computes the Facebook
section LIVE from the demo fixtures (genuine gap/mood) and curates the rest, so it's
a complete, coherent sales demo with no Apify/Anthropic.
"""

# demo entities → the demo FB page that carries their public signal + a journey keyword
_DEMO_ENTITIES = {
    "وزارة الكهرباء": {"type": "مؤسسة حكومية", "fb_page": "SetAshwaqDemo", "journey": "كهرباء",
                       "aliases": ["الكهرباء", "وزارة الكهرباء العراقية"],
                       "scores": {"reputation": 38, "risk": 74, "influence": 66, "public_opinion": 34}},
    "هيئة النزاهة": {"type": "جهة رقابية", "fb_page": "BrothersIraqDemo", "journey": "نزاهة",
                     "aliases": ["النزاهة", "هيئة النزاهة الاتحادية"],
                     "scores": {"reputation": 57, "risk": 38, "influence": 61, "public_opinion": 52}},
    "ملف المنافذ الحدودية": {"type": "قضية", "fb_page": "RuslDemo", "journey": "منافذ",
                             "aliases": ["المنافذ الحدودية", "التهريب"],
                             "scores": {"reputation": 41, "risk": 61, "influence": 49, "public_opinion": 39}},
}


def _rec(risk: int) -> list:
    if risk >= 70:
        return ["تصعيد للقيادة فوراً", "تحضير بيان توضيحي خلال ساعات", "رصد تعليقات فيسبوك عن كثب", "إعداد تقرير موجز للعميل"]
    if risk >= 50:
        return ["مراقبة مكثّفة (6 ساعات)", "تحضير ردّ احترازي", "رصد التعليقات", "إعداد تقرير عند التصاعد"]
    if risk >= 30:
        return ["مراقبة", "إعداد تقرير دوري"]
    return ["لا ردّ موصى به الآن", "مراقبة روتينية"]


def _level(s: int) -> str:
    return "حرج" if s >= 70 else "مرتفع" if s >= 50 else "متوسط" if s >= 30 else "منخفض"


async def _demo(eid: str) -> dict:
    from app.services import facebook as fb
    from app.services.facebook import cross_platform_journey as cpj
    name = eid if eid in _DEMO_ENTITIES else "وزارة الكهرباء"
    meta = _DEMO_ENTITIES[name]
    sc = meta["scores"]

    # Facebook intelligence — computed LIVE from the demo fixtures (real engine)
    fbp = await fb.analyze_page(meta["fb_page"], limit=6, comments=True, demo=True)
    jr = await cpj.journeys(demo=True)
    journey = next((j for j in jr.get("journeys", []) if meta["journey"] in j.get("title", "")
                    or any(meta["journey"] in (h.get("detail") or "") for h in j.get("hops", []))), None)

    risk = sc["risk"]
    summary = (f"{name} تحت ضغط متصاعد: الخطر {risk}/100 ({_level(risk)})، والرأي العام {sc['public_opinion']}/100. "
               f"تكشف تعليقات فيسبوك فجوة واضحة بين التفاعلات الظاهرية والمزاج الحقيقي. "
               + (f"رُصد انتقال السردية عبر {len(journey['hops'])} منصّات بدءاً من فيسبوك. " if journey else "")
               + "يُوصى بالمراقبة المكثّفة وتحضير ردّ احترازي. (وضع العرض — بيانات تجريبية).")

    return {
        "demo": True, "id": name, "name": name, "type": meta["type"], "aliases": meta["aliases"],
        "scores": sc, "score_levels": {k: _level(v) for k, v in sc.items()},
        "latest_change": {"reputation": -18, "risk": +12, "reason": "تعليقات فيسبوك أصبحت أكثر سلبية"},
        "executive_summary": summary,
        "reputation_risk": {
            "rep_series": [62, 60, 58, 55, 49, 44, 38], "risk_series": [40, 45, 52, 58, 64, 70, 74],
            "drivers": ["تصاعد الشكاوى حول الخدمات", "فجوة تفاعل/تعليق مرتفعة", "حملة مشتبهة نشطة"],
            "sentiment_change": "-22% خلال 7 أيام",
        },
        "campaigns": {
            "targeting": [{"hashtag": "فشل_الخدمات", "coordination": 71, "level": "مرتفع", "evidence": 230}],
            "supporting": [],
        },
        "narratives": {
            "dominant": ["فشل الخدمات وغياب الحلول"],
            "growing": ["مقارنة بالدول المجاورة"],
            "harmful": ["اتهامات بالفساد وهدر المال"],
            "supportive": ["دعوات لإمهال الحكومة"],
        },
        "facebook": {
            "approval": fbp.get("approval"), "reaction_approval": fbp.get("reaction_approval"),
            "comment_reaction_gap": fbp.get("comment_reaction_gap"),
            "comment_intel": fbp.get("comment_intel"),
            "audience_mood": (fbp.get("insights") or {}).get("audience_mood"),
            "mood_index": (fbp.get("insights") or {}).get("mood_index"),
            "top_posts": fbp.get("posts", [])[:4],
            "accusations": (fbp.get("insights") or {}).get("accusations", []),
            "demands": (fbp.get("insights") or {}).get("demands", []),
        },
        "x": {"available": False, "note": "رصد X يتطلّب رصيد TwitterAPI.io (تجريبي: غير مفعّل)."},
        "other_platforms": {"tiktok": None, "instagram": None,
                            "news": {"mentions": 3, "note": "تغطية إخبارية محدودة (تجريبي)"}},
        "timeline": ([{"time": h["time"], "platform": h["platform"], "event": h["detail"],
                       "lag_minutes": h.get("lag_minutes")} for h in journey["hops"]] if journey else []),
        "journey": journey,
        "recommendations": _rec(risk),
        "disclaimer": "مؤشرات احتمالية آلية — تتطلّب مراجعة بشرية. لا تُثبت تنسيقاً أو انتماءً كحقيقة.",
    }


async def build(entity_id: str, demo: bool = False) -> dict:
    if demo:
        return await _demo(entity_id)
    # real mode — reuse the digital twin + Facebook snapshot
    from app.services import digital_twin, store
    try:
        eid = store.resolve_entity_id(entity_id)
        twin = await digital_twin.build(eid)
    except Exception:
        twin = {}
    if not twin.get("data_points"):
        return {"demo": False, "id": entity_id, "name": entity_id, "empty": True,
                "note": "لا بيانات مرصودة لهذا الكيان بعد.",
                "scores": {}, "recommendations": []}
    sc = {"reputation": twin["reputation"]["score"], "risk": twin["risk"]["score"],
          "influence": twin["influence"]["score"],
          "public_opinion": twin.get("scores", {}).get("public_trust", {}).get("score")}
    narrs = twin.get("narratives", [])
    return {
        "demo": False, "id": entity_id, "name": twin.get("name", entity_id),
        "type": twin.get("type", "كيان"), "aliases": twin.get("aliases", []),
        "scores": sc, "score_levels": {k: _level(v or 0) for k, v in sc.items()},
        "executive_summary": twin.get("summary", "") or "ملخّص آلي — يتوفّر الموجز الكامل عند توفّر رصيد الذكاء الاصطناعي.",
        "reputation_risk": {"rep_series": twin.get("series", {}).get("reputation", []),
                            "risk_series": twin.get("series", {}).get("risk", []),
                            "drivers": [n.get("narrative") for n in narrs[:3]]},
        "campaigns": {"targeting": twin.get("campaigns", []), "supporting": []},
        "narratives": {"dominant": [n.get("narrative") for n in narrs[:3]],
                       "harmful": [n.get("narrative") for n in narrs if n.get("neg_ratio", 0) > 0.5][:3],
                       "growing": [], "supportive": []},
        "facebook": {"note": "افتح تبويب استخبارات فيسبوك للكيان (قيد الربط الكامل)."},
        "x": {"available": False},
        "timeline": [], "recommendations": _rec(sc["risk"] or 0),
        "disclaimer": "مؤشرات احتمالية آلية — تتطلّب مراجعة بشرية.",
    }


def demo_entities() -> list:
    return list(_DEMO_ENTITIES.keys())
