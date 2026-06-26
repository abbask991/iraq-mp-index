"""Social Opinion Survey API. Heavy (live fetch + classification) → cached (SWR)."""
from fastapi import APIRouter

from app.services import cache
from app.services import polling

router = APIRouter(prefix="/api/polling", tags=["polling"])


@router.get("/survey")
async def survey(subject: str, range: str = "week"):
    s = (subject or "").strip()
    if not s:
        return {"error": "missing subject"}
    rng = range if range in ("day", "week") else "week"
    return await cache.swr(f"poll:{rng}:{s}", 1800, lambda: polling.run_survey(s, rng=rng))
