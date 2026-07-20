"""Predictive / early-warning API — 24–72h forecasts. SWR-cached."""
from fastapi import APIRouter, Depends

from app.common_auth import current_org

from app.services import cache, predictive

router = APIRouter(prefix="/api/predictive", tags=["predictive"])


@router.get("")
async def outlook(ctx: dict = Depends(current_org)):
    # Tenant-scoped: the digest beneath this is per-org, so identity comes from
    # the session and the cache key carries the org id.
    owner = ctx["org_id"]
    return await cache.swr(f"predictive:outlook:{owner}", 1800, lambda: predictive.outlook(owner=owner))
