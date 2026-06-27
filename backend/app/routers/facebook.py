"""Facebook reception API — per-page approval/rejection (reactions + comment
sentiment) and a national pulse across an editable seed list. Apify is billed
separately + slow, so results are SWR-cached."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.services import cache
from app.services import facebook as fb

router = APIRouter(prefix="/api/facebook", tags=["facebook"])


class PagesReq(BaseModel):
    pages: list[str] = []


@router.get("/page")
async def page(target: str, limit: int = 20, comments: int = 1):
    return await cache.swr(f"fb:page:{limit}:{comments}:{target}", 3600,
                           lambda: fb.analyze_page(target, limit, comments=bool(comments)))


@router.get("/national")
async def national():
    return await cache.swr("fb:national", 21600, lambda: fb.national())


@router.get("/pages")
async def get_pages():
    return {"pages": await fb.get_pages()}


@router.post("/pages")
async def set_pages(req: PagesReq):
    return {"pages": await fb.set_pages(req.pages)}
