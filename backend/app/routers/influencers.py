"""Influencer Intelligence API. Radar (national, heavy) + per-influencer profile
are cached (Redis SWR): instant serve, background refresh. One profile fetch
powers a handle's whole view."""
from fastapi import APIRouter

from app.services import cache
from app.services import influencers as inf

router = APIRouter(prefix="/api/influencers", tags=["influencers"])


@router.get("")
async def radar(range: str = "day", min_followers: int = 5000):
    rng = range if range in ("day", "week") else "day"
    return await cache.swr(f"inf:radar:{rng}:{min_followers}", 3600,
                           lambda: inf.scan(rng=rng, min_followers=min_followers))


@router.get("/profile")
async def profile(handle: str, range: str = "week"):
    h = (handle or "").lstrip("@").strip()
    if not h:
        return {"error": "missing handle"}
    rng = range if range in ("day", "week") else "week"
    return await cache.swr(f"inf:profile:{rng}:{h}", 1800,
                           lambda: inf.build_profile(h, rng=rng))
