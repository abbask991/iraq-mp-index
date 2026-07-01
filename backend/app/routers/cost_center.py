"""Cost Control Center API (Phase 9) — usage observability + caps/controls."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.common_auth import require_admin
from app.services import cache, cost_center

router = APIRouter(prefix="/api/cost-center", tags=["cost-center"])


class ControlsReq(BaseModel):
    changes: dict = {}


@router.get("")
async def dashboard_ep(demo: int = 0):
    if demo:
        return await cache.swr("cost:demo", 86400, lambda: cost_center.dashboard(demo=True))
    return await cost_center.dashboard()      # live (small, no SWR so controls reflect instantly)


@router.get("/controls")
async def controls_ep():
    return {"controls": await cost_center.get_controls(), "meta": cost_center.control_meta()}


@router.post("/controls")
async def set_controls_ep(req: ControlsReq, _: dict = Depends(require_admin)):
    return await cost_center.set_controls(req.changes)
