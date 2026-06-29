"""Facebook reception API — per-page approval/rejection (reactions + comment
sentiment) and a national pulse across an editable seed list. Apify is billed
separately + slow, so results are SWR-cached."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.services import cache
from app.services import facebook as fb
from app.services.facebook import collector, summary

router = APIRouter(prefix="/api/facebook", tags=["facebook"])


class PagesReq(BaseModel):
    pages: list[str] = []


@router.get("/dashboard")
async def dashboard(demo: int = 0):
    """Facebook Intelligence Dashboard — what's happening on Facebook right now."""
    if demo:
        return await cache.swr("fb:dashboard:demo", 86400, lambda: summary.dashboard(demo=True))
    return await cache.swr("fb:dashboard", 3600, lambda: summary.dashboard())


@router.post("/collect")
async def collect(limit: int = 12):
    """Trigger a collection run (scrape monitored pages → persist). Admin/cron use."""
    return await collector.collect_all(limit)


@router.get("/page")
async def page(target: str, limit: int = 20, comments: int = 1, demo: int = 0):
    return await cache.swr(f"fb:page:{limit}:{comments}:{demo}:{target}", 3600,
                           lambda: fb.analyze_page(target, limit, comments=bool(comments), demo=bool(demo)))


@router.get("/national")
async def national(demo: int = 0):
    if demo:
        return await cache.swr("fb:national:demo", 86400, lambda: fb.national(demo=True))
    return await cache.swr("fb:national", 21600, lambda: fb.national())


@router.get("/pages")
async def get_pages():
    return {"pages": await fb.get_pages()}


@router.post("/pages")
async def set_pages(req: PagesReq):
    return {"pages": await fb.set_pages(req.pages)}
