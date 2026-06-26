"""Evidence API — the posts behind a score. Cached (SWR)."""
from fastapi import APIRouter

from app.services import cache, evidence

router = APIRouter(prefix="/api/evidence", tags=["evidence"])


@router.get("")
async def get_evidence(target: str, filter: str = "oppose", range: str = "week"):
    t = (target or "").strip()
    if not t:
        return {"error": "missing target"}
    rng = range if range in ("day", "week") else "week"
    return await cache.swr(f"evidence:{rng}:{filter}:{t}", 1800,
                           lambda: evidence.get_evidence(t, filter=filter, rng=rng))
