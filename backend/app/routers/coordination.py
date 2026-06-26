"""Coordinated-network detection API — "who is behind the campaign". Heavy build
(fetch + cluster + network + AI) is SWR-cached: first call computes, repeats are
instant, refresh happens in the background."""
from fastapi import APIRouter

from app.services import cache
from app.services.coordination import builder

router = APIRouter(prefix="/api/coordination", tags=["coordination"])


@router.get("/{target}")
async def coordination(target: str, range: str = "week"):
    return await cache.swr(f"coord:{range}:{target}", 900, lambda: builder.build(target, range))
