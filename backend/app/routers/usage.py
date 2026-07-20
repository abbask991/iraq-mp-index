"""Usage-event API — log a client action, read the per-tenant summary.

Tenant-scoped to the signed-in owner, so a client only ever sees its own usage.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.common_auth import current_user
from app.services import usage_log

router = APIRouter(prefix="/api/usage", tags=["usage"])


class EventReq(BaseModel):
    type: str
    meta: dict = {}


@router.post("/log")
async def log_event(req: EventReq, user: dict = Depends(current_user)):
    ok = await usage_log.log(user["id"], req.type, req.meta)
    return {"logged": bool(ok)}


@router.get("/summary")
async def get_summary(since_days: int = 30, user: dict = Depends(current_user)):
    return await usage_log.summary(user["id"], since_days)
