"""Cross-Platform Monitor API. Collection is async (provider trigger→poll→
download, ~20-60s), so results are cached (Redis SWR) per source: first hit
collects, repeats are instant until refresh."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.services import cache
from app.services.social import cross_platform

router = APIRouter(prefix="/api/social", tags=["social"])


class CollectReq(BaseModel):
    platform: str
    url: str
    limit: int = 15
    mode: str = "auto"           # auto (posts) | profile


@router.get("/platforms")
async def platforms():
    return cross_platform.status()


@router.post("/collect")
async def collect(req: CollectReq):
    """Start an async collection job; returns a job_id to poll. Cached so the same
    source within the hour reuses the job instead of re-spending."""
    key = f"social:job:{req.platform}:{req.mode}:{req.url}:{req.limit}"
    return await cache.swr(key, 3600, lambda: cross_platform.start_source(
        req.platform, req.url, limit=req.limit, mode=req.mode))


@router.get("/result")
async def result(job: str, platform: str, mode: str = "auto"):
    """Poll a collection job. status: collecting | ready | failed. Ready results
    are cached so repeat polls are instant."""
    return await cross_platform.poll_source(job, platform, mode)
