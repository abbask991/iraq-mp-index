"""Conversational intelligence analyst API — ask any question, get a data-grounded
answer synthesized across the platform's modules."""
from fastapi import APIRouter, Depends

from app.common_auth import current_user
from pydantic import BaseModel

from app.services import analyst

router = APIRouter(prefix="/api/analyst", tags=["analyst"])


class Ask(BaseModel):
    question: str = ""


@router.get("/suggested")
async def suggested():
    return {"suggested": analyst._SUGGESTED}


@router.post("/ask")
async def ask(req: Ask, user: dict = Depends(current_user)):
    # answers are grounded in the digest — which is the caller's, not everyone's
    return await analyst.ask(req.question, owner=user["id"])
