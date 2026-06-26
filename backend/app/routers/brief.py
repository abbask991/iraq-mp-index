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
