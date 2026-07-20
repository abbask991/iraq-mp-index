"""Intelligence Memory Recall API — record real past cases, recall similar ones.

Tenant-scoped: cases belong to the signed-in owner, and recall only searches that
owner's recorded history. Nothing is invented — an empty log returns no matches.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.common_auth import current_user
from app.services import intel_cases

router = APIRouter(prefix="/api/intel-cases", tags=["intel-cases"])


class CaseReq(BaseModel):
    title: str = ""
    entity: str = ""
    issue: str = ""
    tags: list[str] = []
    anger_score: int | None = None
    risk_level: str | None = None
    platforms: list[str] = []
    started_at: str | None = None
    resolved_at: str | None = None
    outcome: str = ""
    lesson: str = ""


@router.post("/record")
async def record_case(req: CaseReq, user: dict = Depends(current_user)):
    return await intel_cases.record(user["id"], req.model_dump())


@router.get("/recall")
async def recall_cases(entity: str = "", issue: str = "", anger_score: int | None = None,
                       platforms: str = "", tags: str = "", user: dict = Depends(current_user)):
    query = {
        "entity": entity, "issue": issue, "anger_score": anger_score,
        "platforms": [p for p in platforms.split(",") if p.strip()],
        "tags": [t for t in tags.split(",") if t.strip()],
    }
    return await intel_cases.recall(user["id"], query)


@router.get("/list")
async def list_cases(user: dict = Depends(current_user)):
    return {"cases": await intel_cases.load(user["id"])}
