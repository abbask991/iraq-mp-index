"""What Changed? API (Phase 7)."""
from fastapi import APIRouter, Depends

from app.common_auth import current_org

from app.services import cache, what_changed

router = APIRouter(prefix="/api/what-changed", tags=["what-changed"])


@router.get("")
async def what_changed_ep(period: str = "last_24h", demo: int = 0,
                          ctx: dict = Depends(current_org)):
    # demo is shared fixture data; real data is per-org and keyed by org id.
    if demo:
        return await cache.swr(f"wc:demo:{period}", 1800, lambda: what_changed.build(period, demo=True))
    owner = ctx["org_id"]
    return await cache.swr(f"wc:{owner}:{period}", 1800,
                           lambda: what_changed.build(period, owner=owner))
