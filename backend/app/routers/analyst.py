"""Conversational intelligence analyst API — ask any question, get a data-grounded
answer synthesized across the platform's modules."""
from fastapi import APIRouter, Depends

from app.common_auth import current_org
from pydantic import BaseModel

from app.services import analyst

router = APIRouter(prefix="/api/analyst", tags=["analyst"])


class Ask(BaseModel):
    question: str = ""


@router.get("/suggested")
async def suggested():
    return {"suggested": analyst._SUGGESTED}


@router.post("/ask")
async def ask(req: Ask, ctx: dict = Depends(current_org)):
    # answers are grounded in the digest — which is the org's, not everyone's
    return await analyst.ask(req.question, owner=ctx["org_id"])
