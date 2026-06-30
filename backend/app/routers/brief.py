"""Daily intelligence brief API — the morning command briefing. The build is
SWR-cached (one AI summary per window); a separate cron sends it to Telegram."""
from fastapi import APIRouter

from app.services import brief as brief_service
from app.services import cache

router = APIRouter(prefix="/api/brief", tags=["brief"])


@router.get("")
async def get_brief():
    return await cache.swr("brief:daily", 900, brief_service.build_brief)


@router.get("/recent")
async def get_recent():
    return {"briefs": await brief_service.recent()}


@router.get("/executive")
async def get_executive(demo: int = 0):
    """Phase 8 — the 10-section executive morning brief (≤3-minute read)."""
    if demo:
        return await cache.swr("brief:exec:demo", 86400, lambda: brief_service.executive_brief(demo=True))
    return await cache.swr("brief:exec", 900, lambda: brief_service.executive_brief())
