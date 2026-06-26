"""Regional influence API. Country pools + comparisons are SWR-cached; first call
computes, repeats are instant, refresh in the background."""
from fastapi import APIRouter

from app.services import cache
from app.services.regional_influence import builder, countries

router = APIRouter(prefix="/api/regional-influence", tags=["regional-influence"])


@router.get("/countries")
async def list_countries():
    return {"countries": [{"code": k, "name": v["ar"], "flag": v["flag"]} for k, v in countries.COUNTRIES.items()],
            "neighbors": countries.NEIGHBORS}


@router.get("/overview")
async def overview(range: str = "week"):
    return await cache.swr(f"reginf:overview:{range}", 5400, lambda: builder.overview(range))


@router.get("")
async def compare(source: str = "IQ", target: str = "SY", range: str = "week"):
    return await cache.swr(f"reginf:{source}:{target}:{range}", 3600,
                           lambda: builder.compare(source, target, range))
