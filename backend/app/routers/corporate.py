"""Corporate Intelligence API. Heavy (live fetch + AI), so cached (Redis SWR)."""
from fastapi import APIRouter

from app.services import cache
from app.services import corporate

router = APIRouter(prefix="/api/corporate", tags=["corporate"])


@router.get("/intelligence")
async def intelligence(company: str, range: str = "week", sector: str = ""):
    c = (company or "").strip()
    if not c:
        return {"error": "missing company"}
    rng = range if range in ("day", "week") else "week"
    return await cache.swr(f"corp:{rng}:{c}", 1800,
                           lambda: corporate.build_corporate(c, rng=rng, sector=sector))
