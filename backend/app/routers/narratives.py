"""Narrative War Room API. The dashboard + per-narrative detail are heavy (live X
fetch + AI), so both are cached (Redis SWR): instant serve, background refresh.
One fetch powers a narrative's whole 8-section view; the slice endpoints read the
same cached detail."""
from fastapi import APIRouter

from app.services import cache
from app.services import narratives as nar
from app.services.narratives import memory

router = APIRouter(prefix="/api/narratives", tags=["narratives"])


@router.get("")
async def dashboard(range: str = "day"):
    rng = range if range in ("day", "week") else "day"
    return await cache.swr(f"nar:dash:{rng}", 3600, lambda: nar.build_dashboard(rng=rng))


async def _detail(term: str, rng: str = "week"):
    term = (term or "").strip()
    if not term:
        return {"error": "missing term"}
    key = f"nar:detail:{rng}:{term}"
    return await cache.swr(key, 1800, lambda: nar.build_detail(term, rng=rng))


@router.get("/detail")
async def detail(term: str, range: str = "week"):
    return await _detail(term, range)


@router.get("/timeline")
async def timeline(term: str, range: str = "week"):
    d = await _detail(term, range)
    return {"narrative": d.get("narrative"), "timeline": d.get("timeline"),
            "evolution": d.get("evolution"), "generated_at": d.get("generated_at")}


@router.get("/battlefield")
async def battlefield(term: str, range: str = "week"):
    d = await _detail(term, range)
    return {"narrative": d.get("narrative"), "battlefield": d.get("battlefield"),
            "network": d.get("network"), "generated_at": d.get("generated_at")}


@router.get("/forecast")
async def forecast(term: str, range: str = "week"):
    d = await _detail(term, range)
    return {"narrative": d.get("narrative"), "forecast": d.get("forecast"),
            "threat": d.get("threat"), "generated_at": d.get("generated_at")}


@router.get("/dna")
async def dna(term: str, range: str = "week"):
    d = await _detail(term, range)
    return {"narrative": d.get("narrative"), "dna": d.get("dna"),
            "generated_at": d.get("generated_at")}


@router.get("/memory")
async def narrative_memory(entity: str = "", since: str = "", limit: int = 50):
    return await memory.recall(entity=entity or None, since=since or None, limit=limit)
