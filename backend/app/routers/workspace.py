"""Workspace API — each account manages its OWN watchlist (auth-scoped, isolated)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.common_auth import current_user
from app.services import workspace

router = APIRouter(prefix="/api/workspace", tags=["workspace"])


class WatchlistReq(BaseModel):
    entities: list[str] = []
    fb_pages: list[str] = []
    brands: list[str] = []
    keywords: list[str] = []


@router.get("/watchlist")
async def get_watchlist(user: dict = Depends(current_user)):
    return {"workspace": user["id"], "email": user["email"],
            "watchlist": await workspace.get_watchlist(user["id"])}


@router.post("/watchlist")
async def set_watchlist(req: WatchlistReq, user: dict = Depends(current_user)):
    return await workspace.set_watchlist(user["id"], req.dict())
