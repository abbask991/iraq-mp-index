"""Studies & Research + Opinion Polls API."""
from fastapi import APIRouter

from app.services import cache, research

router = APIRouter(prefix="/api/research", tags=["research"])


@router.get("/studies")
async def studies(demo: int = 0):
    return await cache.swr(f"research:studies:{demo}", 3600, lambda: research.studies(demo=bool(demo)))


@router.get("/study")
async def study(topic: str = "", demo: int = 0):
    return await cache.swr(f"research:study:{demo}:{topic}", 3600, lambda: research.study(topic, demo=bool(demo)))


@router.get("/polls")
async def polls(demo: int = 0):
    return await cache.swr(f"research:polls:{demo}", 3600, lambda: research.polls(demo=bool(demo)))


@router.get("/poll")
async def poll(question: str = "", demo: int = 0):
    return await cache.swr(f"research:poll:{demo}:{question}", 3600, lambda: research.poll(question, demo=bool(demo)))
