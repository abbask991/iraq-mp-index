"""Usage-event API — log a client action, read the per-tenant summary.

Tenant-scoped to the signed-in user's org, so a client only ever sees its org's
usage (one bill per organization, shared across its members).
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.common_auth import current_org
from app.services import usage_log

router = APIRouter(prefix="/api/usage", tags=["usage"])


class EventReq(BaseModel):
    type: str
    meta: dict = {}


@router.post("/log")
async def log_event(req: EventReq, ctx: dict = Depends(current_org)):
    ok = await usage_log.log(ctx["org_id"], req.type, req.meta)
    return {"logged": bool(ok)}


@router.get("/summary")
async def get_summary(since_days: int = 30, ctx: dict = Depends(current_org)):
    return await usage_log.summary(ctx["org_id"], since_days)
