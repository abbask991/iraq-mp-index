"""Media Battlefield API — war-room views. Heavy builds are cached (SWR): first
call computes, repeats are instant, refresh happens in the background.

The {entity_id}/{campaign_id}/{narrative_id} path params are the name / hashtag /
narrative term to centre the battlefield on.
"""
from fastapi import APIRouter, Depends

from app.common_auth import current_user

from app.services import cache
from app.services import media_battlefield as bf

router = APIRouter(prefix="/api/battlefield", tags=["battlefield"])


@router.get("/national")
async def national(user: dict = Depends(current_user)):
    # Tenant-scoped: the digest beneath this is per-owner, so identity comes
    # from the session and the cache key carries the owner. A global key here
    # would serve one tenant's picture to another.
    owner = user["id"]
    return await cache.swr(f"bf:national:{owner}", 1800, lambda: bf.build_national(owner=owner))


async def _entity_demo(name: str) -> dict:
    """Curated demo for the media-battlefield entity view — matches build_entity's
    shape (the keys BattlefieldView + BattlefieldGraph + EvolutionChart read).
    Async so it drops straight into cache.swr, which awaits its factory."""
    nodes = [
        {"id": "ent:0", "name": name, "type": "entity", "x": 0.50, "y": 0.50, "is_center": True, "influence_score": 100},
        {"id": "acc:a1", "name": "@critic_iq", "type": "account", "x": 0.24, "y": 0.30, "influence_score": 70, "risk_score": 62},
        {"id": "acc:a2", "name": "@opp_voice", "type": "account", "x": 0.19, "y": 0.55, "influence_score": 55, "risk_score": 48},
        {"id": "acc:a3", "name": "@haqiqa22", "type": "account", "x": 0.30, "y": 0.73, "influence_score": 48, "risk_score": 71},
        {"id": "acc:s1", "name": "@watan_pro", "type": "account", "x": 0.76, "y": 0.32, "influence_score": 60},
        {"id": "acc:s2", "name": "@iraq_unity", "type": "account", "x": 0.81, "y": 0.58, "influence_score": 44},
        {"id": "nar:1", "name": "فشل الخدمات", "type": "narrative", "x": 0.42, "y": 0.18, "influence_score": 65},
        {"id": "nar:2", "name": "إنجازات موثّقة", "type": "narrative", "x": 0.63, "y": 0.17, "influence_score": 40},
        {"id": "camp:1", "name": "#وسم_ضغط", "type": "campaign", "x": 0.34, "y": 0.86, "influence_score": 58},
        {"id": "media:1", "name": "قناة إخبارية", "type": "media", "x": 0.72, "y": 0.82, "influence_score": 50},
    ]
    edges = [
        {"source_id": "acc:a1", "target_id": "ent:0", "relationship_type": "attacks", "weight": 6},
        {"source_id": "acc:a2", "target_id": "ent:0", "relationship_type": "attacks", "weight": 4},
        {"source_id": "acc:a3", "target_id": "ent:0", "relationship_type": "attacks", "weight": 3},
        {"source_id": "acc:s1", "target_id": "ent:0", "relationship_type": "supports", "weight": 5},
        {"source_id": "acc:s2", "target_id": "ent:0", "relationship_type": "supports", "weight": 3},
        {"source_id": "nar:1", "target_id": "ent:0", "relationship_type": "narrative_targets", "weight": 5},
        {"source_id": "nar:2", "target_id": "ent:0", "relationship_type": "narrative_supports", "weight": 3},
        {"source_id": "acc:a1", "target_id": "camp:1", "relationship_type": "coordinates_with", "weight": 4},
        {"source_id": "acc:a3", "target_id": "camp:1", "relationship_type": "coordinates_with", "weight": 3},
        {"source_id": "media:1", "target_id": "ent:0", "relationship_type": "media_covers", "weight": 3},
    ]
    days = ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17", "2026-07-18", "2026-07-19"]
    counts = [(120, 40), (180, 78), (150, 66), (320, 210), (260, 150), (190, 96), (140, 70)]
    series = [{"t": f"{d}T12:00:00", "count": c, "neg": ng} for d, (c, ng) in zip(days, counts)]
    tp = [
        {"at": series[1]["t"], "type": "velocity_spike", "volume": 180},
        {"at": series[3]["t"], "type": "first_influencer_amplification", "volume": 320},
        {"at": series[3]["t"], "type": "sentiment_shift", "volume": 320},
    ]
    return {
        "demo": True,
        "entity": {"name": name, "type": "entity"},
        "period": "آخر 7 أيام",
        "risk_level": "مرتفع",
        "verdict": {"state": "تحت ضغط هجومي"},
        "scores": {"attack_pressure": 64, "support_strength": 38, "advantage": 37},
        "summary": (
            f"يتعرّض «{name}» لضغط هجومي منظّم تقوده ثلاثة حسابات عالية النشاط تدفع سردية «فشل الخدمات» "
            "(٥٢٪ من الحديث، نبرة سلبية ٧٨٪)، مع حساب جسر يربطها بوسم ضغط منسّق. الدعم حاضر لكنه مجزّأ "
            "(٣٨ مقابل ٦٤). نقطة التحوّل الأبرز كانت تضخيماً من مؤثّر رفع الحجم ٢٫٥ ضعفاً وقلب النبرة."
        ),
        "totals": {"attackers": 3, "supporters": 2, "posts": 1420, "news": 46},
        "nodes": nodes, "edges": edges, "edge_types": ["attacks", "supports", "narrative_targets", "coordinates_with", "media_covers"],
        "top_attackers": [
            {"username": "critic_iq", "posts": 38, "bot": 62, "evidence": ["فشل واضح في ملف الكهرباء والوعود بلا تنفيذ"]},
            {"username": "opp_voice", "posts": 29, "bot": 48, "evidence": ["أرقام المشاريع لا تطابق الواقع"]},
            {"username": "haqiqa22", "posts": 21, "bot": 71, "evidence": []},
        ],
        "top_supporters": [
            {"username": "watan_pro", "posts": 24, "followers": 38000},
            {"username": "iraq_unity", "posts": 15, "followers": 12500},
        ],
        "top_narratives": [
            {"narrative": "فشل الخدمات", "keywords": ["كهرباء", "خدمات", "فساد"], "share": 52, "neg_ratio": 0.78},
            {"narrative": "إنجازات موثّقة", "keywords": ["مشاريع", "إنجاز"], "share": 23, "neg_ratio": 0.20},
            {"narrative": "تشكيك بالنوايا", "keywords": ["أجندة", "خارجي"], "share": 15, "neg_ratio": 0.61},
        ],
        "top_campaigns": [{"hashtag": "وسم_ضغط", "coordination_score": 68, "level": "قوي"}],
        "recommended_actions": [
            "إصدار توضيح موثّق حول ملف الخدمات خلال ٢٤ ساعة مع أرقام قابلة للتحقّق",
            "رصد حسابات التضخيم الثلاثة الأعلى نشاطاً ومتابعة نمط التنسيق",
            "تفعيل داعمين موثوقين لموازنة السردية السلبية قبل أن تترسّخ",
        ],
        "timeline": {"series": series, "turning_points": tp},
        "disclaimer": "مؤشّر احتمالي — يُستأنس به ولا يُعتمد كحقيقة قاطعة. (بيانات توضيحية)",
    }


@router.get("/entity/{entity_id}")
async def entity(entity_id: str, range: str = "week", demo: int = 0):
    if demo:
        return await cache.swr(f"bf:entity:demo:{entity_id}", 86400, lambda: _entity_demo(entity_id))
    return await cache.swr(f"bf:entity:{range}:{entity_id}", 1800,
                           lambda: bf.build_entity(entity_id, range))


@router.get("/campaign/{campaign_id}")
async def campaign_view(campaign_id: str, range: str = "week"):
    # centre the battlefield on the campaign hashtag/term
    return await cache.swr(f"bf:campaign:{range}:{campaign_id}", 1800,
                           lambda: bf.build_entity(campaign_id, range))


@router.get("/narrative/{narrative_id}")
async def narrative_view(narrative_id: str, range: str = "week"):
    return await cache.swr(f"bf:narrative:{range}:{narrative_id}", 1800,
                           lambda: bf.build_entity(narrative_id, range))


@router.get("/timeline/{target_type}/{target_id}")
async def timeline(target_type: str, target_id: str, range: str = "week"):
    d = await cache.swr(f"bf:entity:{range}:{target_id}", 1800,
                        lambda: bf.build_entity(target_id, range))
    return {"target_type": target_type, "target_id": target_id, "timeline": d.get("timeline", {})}


@router.get("/edge/{edge_id}")
async def edge(edge_id: str, entity_id: str = "", range: str = "week"):
    """Edge detail — looked up inside the (cached) entity snapshot it belongs to."""
    if not entity_id:
        return {"id": edge_id, "note": "مرّر entity_id لاسترجاع تفاصيل العلاقة من خريطة ذلك الكيان."}
    d = await cache.swr(f"bf:entity:{range}:{entity_id}", 1800, lambda: bf.build_entity(entity_id, range))
    for e in d.get("edges", []):
        if e.get("id") == edge_id:
            return e
    return {"id": edge_id, "note": "العلاقة غير موجودة في اللقطة الحالية."}
