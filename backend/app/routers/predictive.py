"""Predictive / early-warning API — 24–72h forecasts. SWR-cached."""
from fastapi import APIRouter

from app.services import cache, predictive

router = APIRouter(prefix="/api/predictive", tags=["predictive"])


@router.get("")
async def outlook():
    return await cache.swr("predictive:outlook", 1800, predictive.outlook)
