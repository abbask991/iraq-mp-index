"""Command Center API — the 60-second decision-support view (Phase 1).
Pure assembly over the precomputed digest; cached; supports ?demo=1."""
from fastapi import APIRouter

from app.services import cache, command_center

router = APIRouter(prefix="/api/command-center", tags=["command-center"])


@router.get("")
async def command_center_ep(demo: int = 0):
    if demo:
        return await cache.swr("cc:demo", 86400, lambda: command_center.build(demo=True))
    return await cache.swr("cc:main", 1800, lambda: command_center.build())
