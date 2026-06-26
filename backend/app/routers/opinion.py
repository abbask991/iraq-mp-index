"""PPOI API — observed digital public opinion. Heavy → cached (SWR)."""
from fastapi import APIRouter

from app.services import cache
from app.services import opinion

router = APIRouter(prefix="/api/opinion", tags=["opinion"])


@router.get("")
async def opinion_for(target: str, range: str = "day"):
    t = (target or "").strip()
    if not t:
        return {"error": "missing target"}
    rng = range if range in ("day", "week") else "day"
    return await cache.swr(f"ppoi:{rng}:{t}", 1800, lambda: opinion.build_opinion(t, rng=rng))
