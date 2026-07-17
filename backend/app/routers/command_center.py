"""Command Center API — the 60-second decision-support view (Phase 1).
Pure assembly over the precomputed digest; cached per tenant; supports ?demo=1."""
from fastapi import APIRouter, Depends

from app.common_auth import current_user
from app.services import cache, command_center

router = APIRouter(prefix="/api/command-center", tags=["command-center"])


@router.get("")
async def command_center_ep(demo: int = 0, user: dict = Depends(current_user)):
    """Tenant-scoped.

    This route had no auth and cached under one global key ("cc:main"), while the
    digest beneath it read every tenant's watchlist. The result was a dashboard
    that showed one account the entities another account monitors. Both halves are
    fixed: identity comes from the session, and the cache key carries the owner.
    """
    if demo:
        # demo is fabricated fixture data — identical for everyone, safe to share
        return await cache.swr("cc:demo", 86400, lambda: command_center.build(demo=True))
    owner = user["id"]
    return await cache.swr(f"cc:{owner}", 1800, lambda: command_center.build(owner=owner))
