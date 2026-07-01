"""Facebook reception API — per-page approval/rejection (reactions + comment
sentiment) and a national pulse across an editable seed list. Apify is billed
separately + slow, so results are SWR-cached."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.common_auth import require_admin
from app.services import cache
from app.services import facebook as fb
from app.services.facebook import (collector, community_detector, cross_platform_journey,
                                   page_dna, summary, viral)

router = APIRouter(prefix="/api/facebook", tags=["facebook"])


@router.get("/page-dna")
async def page_dna_ep(target: str, demo: int = 0):
    return await cache.swr(f"fb:dna:{demo}:{target}", 3600,
                           lambda: page_dna.build(target, demo=bool(demo)))


@router.get("/page-clusters")
async def page_clusters_ep(demo: int = 0):
    async def _build():
        if demo:
            from app.services.facebook import demo as _demo
            slugs = _demo.pages()
        else:
            slugs = await fb.get_pages()
        dnas = await page_dna.build_all(slugs, demo=bool(demo))
        return community_detector.detect(dnas)
    return await cache.swr(f"fb:clusters:{demo}", 21600, _build)


@router.get("/viral-posts")
async def viral_posts_ep(demo: int = 0):
    return await cache.swr(f"fb:viral:{demo}", 7200, lambda: viral.top_viral(demo=bool(demo)))


@router.get("/journey")
async def journey_ep(demo: int = 0):
    return await cache.swr(f"fb:journey:{demo}", 21600,
                           lambda: cross_platform_journey.journeys(demo=bool(demo)))


class PagesReq(BaseModel):
    pages: list[str] = []


@router.get("/commenters")
async def commenters(target: str = "", demo: int = 0):
    from app.services.facebook import advanced
    return await cache.swr(f"fb:commenters:{demo}:{target}", 3600, lambda: advanced.top_commenters(target, demo=bool(demo)))


@router.get("/content-performance")
async def content_performance(target: str = "", demo: int = 0):
    from app.services.facebook import advanced
    return await cache.swr(f"fb:content:{demo}:{target}", 3600, lambda: advanced.content_performance(target, demo=bool(demo)))


@router.get("/alerts")
async def fb_alerts(target: str = "", demo: int = 0):
    from app.services.facebook import advanced
    return await cache.swr(f"fb:alerts:{demo}:{target}", 1800, lambda: advanced.alerts(target, demo=bool(demo)))


@router.get("/compare")
async def compare(pages: str = "", demo: int = 0):
    from app.services.facebook import advanced
    plist = [x.strip() for x in pages.split(",") if x.strip()] or None
    return await cache.swr(f"fb:compare:{demo}:{pages}", 3600, lambda: advanced.compare(plist, demo=bool(demo)))


@router.get("/posting-analysis")
async def posting_analysis(target: str = "", demo: int = 0):
    from app.services.facebook import advanced
    return await cache.swr(f"fb:posting:{demo}:{target}", 3600, lambda: advanced.posting_analysis(target, demo=bool(demo)))


@router.get("/dashboard")
async def dashboard(demo: int = 0):
    """Facebook Intelligence Dashboard — what's happening on Facebook right now."""
    if demo:
        return await cache.swr("fb:dashboard:demo", 86400, lambda: summary.dashboard(demo=True))
    return await cache.swr("fb:dashboard", 3600, lambda: summary.dashboard())


@router.post("/collect")
async def collect(limit: int = 12, _: dict = Depends(require_admin)):
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
async def set_pages(req: PagesReq, _: dict = Depends(require_admin)):
    return {"pages": await fb.set_pages(req.pages)}
