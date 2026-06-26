"""Cross-border influence API (Iraq ↔ Syria). Heavy dual fetch + analysis is
SWR-cached: first call computes, repeats are instant, refresh in the background."""
from fastapi import APIRouter

from app.services import cache
from app.services.cross_influence import builder

router = APIRouter(prefix="/api/cross-influence", tags=["cross-influence"])


@router.get("")
async def cross_influence(range: str = "week"):
    return await cache.swr(f"crossinf:{range}", 3600, lambda: builder.build(range))
