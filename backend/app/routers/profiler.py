"""Deep account profiler API. Heavy fetch + AI is SWR-cached."""
from fastapi import APIRouter

from app.services import cache
from app.services import profiler as prof

router = APIRouter(prefix="/api/profiler", tags=["profiler"])


@router.get("/{handle}")
async def analyze(handle: str, range: str = "month"):
    h = prof.clean_handle(handle)
    return await cache.swr(f"profiler:{range}:{h}", 3600, lambda: prof.analyze(handle, range))
