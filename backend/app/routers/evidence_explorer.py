"""Evidence Explorer API (Phase 2) — "why did the system say this?" for any insight."""
from fastapi import APIRouter

from app.services import cache, evidence_explorer

router = APIRouter(prefix="/api/evidence-explorer", tags=["evidence-explorer"])


@router.get("")
async def evidence_ep(subject: str, type: str = "insight", score: int | None = None, demo: int = 0):
    key = f"ee:{demo}:{type}:{score}:{subject}"
    return await cache.swr(key, 1800,
                           lambda: evidence_explorer.build(subject, subject_type=type, score=score, demo=bool(demo)))
