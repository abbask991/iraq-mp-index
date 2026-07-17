"""Predictive / early-warning API — 24–72h forecasts. SWR-cached."""
from fastapi import APIRouter, Depends

from app.common_auth import current_user

from app.services import cache, predictive

router = APIRouter(prefix="/api/predictive", tags=["predictive"])


@router.get("")
async def outlook(user: dict = Depends(current_user)):
    # Tenant-scoped: the digest beneath this is per-owner, so identity comes
    # from the session and the cache key carries the owner. A global key here
    # would serve one tenant's picture to another.
    owner = user["id"]
    return await cache.swr(f"predictive:outlook:{owner}", 1800, lambda: predictive.outlook(owner=owner))
