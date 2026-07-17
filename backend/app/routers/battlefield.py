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


@router.get("/entity/{entity_id}")
async def entity(entity_id: str, range: str = "week"):
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
