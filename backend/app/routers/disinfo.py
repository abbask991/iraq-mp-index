"""Disinformation assessment API."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.services import disinfo as disinfo_svc

router = APIRouter(prefix="/api/disinfo", tags=["disinfo"])


class AssessReq(BaseModel):
    text: str = ""
    range: str = "week"


@router.post("/assess")
async def assess(req: AssessReq):
    return await disinfo_svc.assess(req.text, req.range)
