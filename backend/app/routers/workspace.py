"""Workspace API — each TENANT manages its OWN watchlist (org-scoped, isolated)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.common_auth import current_org
from app.services import workspace, org_feed

router = APIRouter(prefix="/api/workspace", tags=["workspace"])


class WatchlistReq(BaseModel):
    entities: list[str] = []
    fb_pages: list[str] = []
    brands: list[str] = []
    keywords: list[str] = []


@router.get("/watchlist")
async def get_watchlist(ctx: dict = Depends(current_org)):
    wl = await workspace.get_watchlist(ctx["org_id"], legacy_uid=ctx["user"]["id"])
    return {"workspace": ctx["org_id"], "org": ctx["org"]["name"],
            "email": ctx["user"]["email"], "role": ctx["role"], "watchlist": wl}


@router.post("/watchlist")
async def set_watchlist(req: WatchlistReq, ctx: dict = Depends(current_org)):
    return await workspace.set_watchlist(ctx["org_id"], req.dict())


@router.get("/feed")
async def feed(range: str = "week", ctx: dict = Depends(current_org)):
    """Live news feed for THIS tenant's watchlist targets (real, free RSS)."""
    wl = await workspace.get_watchlist(ctx["org_id"], legacy_uid=ctx["user"]["id"])
    data = await org_feed.build_feed(ctx["org_id"], wl, range=range)
    data["org"] = ctx["org"]["name"]
    return data
