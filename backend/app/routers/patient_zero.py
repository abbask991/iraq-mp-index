"""Patient Zero (origin tracing) API. Heavy fetch is SWR-cached."""
from fastapi import APIRouter

from app.services import cache
from app.services import patient_zero as pz

router = APIRouter(prefix="/api/patient-zero", tags=["patient-zero"])


@router.get("/{topic}")
async def trace(topic: str, range: str = "month"):
    return await cache.swr(f"pz:{range}:{topic}", 3600, lambda: pz.trace(topic, range))
