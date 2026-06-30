"""What Changed? API (Phase 7)."""
from fastapi import APIRouter

from app.services import cache, what_changed

router = APIRouter(prefix="/api/what-changed", tags=["what-changed"])


@router.get("")
async def what_changed_ep(period: str = "last_24h", demo: int = 0):
    return await cache.swr(f"wc:{demo}:{period}", 1800,
                           lambda: what_changed.build(period, demo=bool(demo)))
