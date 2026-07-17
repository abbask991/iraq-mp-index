"""What Changed? API (Phase 7)."""
from fastapi import APIRouter, Depends

from app.common_auth import current_user

from app.services import cache, what_changed

router = APIRouter(prefix="/api/what-changed", tags=["what-changed"])


@router.get("")
async def what_changed_ep(period: str = "last_24h", demo: int = 0,
                          user: dict = Depends(current_user)):
    # demo is shared fixture data; real data is per-tenant and keyed by owner.
    if demo:
        return await cache.swr(f"wc:demo:{period}", 1800, lambda: what_changed.build(period, demo=True))
    owner = user["id"]
    return await cache.swr(f"wc:{owner}:{period}", 1800,
                           lambda: what_changed.build(period, owner=owner))
