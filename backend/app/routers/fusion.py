"""Unified Intelligence Fusion API. The picture fuses live X + stored
cross-platform data + AI synthesis — heavy, so cached (Redis SWR)."""
from fastapi import APIRouter

from app.services import cache
from app.services.fusion import picture

router = APIRouter(prefix="/api/fusion", tags=["fusion"])


@router.get("/picture")
async def unified_picture(entity: str, range: str = "week"):
    e = (entity or "").strip()
    if not e:
        return {"error": "missing entity"}
    rng = range if range in ("day", "week") else "week"
    return await cache.swr(f"fusion:picture:{rng}:{e}", 1800,
                           lambda: picture.build_picture(e, rng=rng))
