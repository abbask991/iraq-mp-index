"""Facebook reception API — approval/rejection from reaction breakdown. Apify is
billed separately + slow, so results are SWR-cached for an hour."""
from fastapi import APIRouter

from app.services import cache
from app.services import facebook as fb

router = APIRouter(prefix="/api/facebook", tags=["facebook"])


@router.get("/page")
async def page(target: str, limit: int = 20):
    return await cache.swr(f"fb:page:{limit}:{target}", 3600, lambda: fb.analyze_page(target, limit))
