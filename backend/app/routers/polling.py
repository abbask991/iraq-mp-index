"""Social Opinion Survey API — configurable sampling. Heavy → cached (SWR), keyed
by the full survey design so different configs cache separately."""
from fastapi import APIRouter

from app.services import cache
from app.services import polling

router = APIRouter(prefix="/api/polling", tags=["polling"])


@router.get("/survey")
async def survey(subject: str, range: str = "week", sample_size: int = 500,
                 account_types: str = "", exclude_bots: bool = True,
                 platforms: str = "", weighting: str = "population"):
    s = (subject or "").strip()
    if not s:
        return {"error": "missing subject"}
    rng = range if range in ("day", "week") else "week"
    size = min(max(sample_size, 100), 3000)
    types = [t for t in account_types.split(",") if t.strip()] or None
    plats = [p for p in platforms.split(",") if p.strip()] or None
    wm = weighting if weighting in ("population", "equal", "raw") else "population"
    key = f"poll:{rng}:{size}:{account_types}:{exclude_bots}:{platforms}:{wm}:{s}"
    return await cache.swr(key, 1800, lambda: polling.run_survey(
        s, rng=rng, sample_size=size, account_types=types, exclude_bots=exclude_bots,
        platforms=plats, weighting_method=wm))
