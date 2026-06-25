"""AI Chief Intelligence Officer API. The heavy dashboard is cached (SWR) so it
serves instantly and refreshes in the background (~every 30 min)."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.services import cache
from app.services import chief_ai
from app.services.chief_ai import conversation_engine, daily_brief

router = APIRouter(prefix="/api/chief-ai", tags=["chief-ai"])


class AskReq(BaseModel):
    question: str
    entity_id: str | None = None


class ReportReq(BaseModel):
    kind: str = "executive"
    target: str = ""
    format: str = "pdf"


@router.get("/dashboard")
async def dashboard():
    return await cache.swr("chief:dashboard", 1800, lambda: chief_ai.build_dashboard())


@router.post("/ask")
async def ask(req: AskReq):
    return await conversation_engine.answer(req.question, req.entity_id)


@router.get("/daily-brief")
async def daily():
    return await cache.swr("chief:daily", 3600, lambda: daily_brief.daily())


@router.get("/weekly-brief")
async def weekly():
    return await cache.swr("chief:weekly", 21600, lambda: daily_brief.weekly())


@router.get("/monthly-report")
async def monthly():
    return await cache.swr("chief:monthly", 86400, lambda: daily_brief.monthly())


@router.post("/generate-report")
async def generate_report(req: ReportReq):
    from app import jobq
    from app.services import redis_client
    job = jobq.enqueue("app.tasks.generate_report", req.kind, req.target or "الوضع العام",
                       "week", req.format, job_timeout=900)
    if job is not None:
        await redis_client.set_job(job.id, {"id": job.id, "status": "queued"})
        return {"job_id": job.id, "status": "queued"}
    from app.services import reports
    out = await reports.build(req.kind, req.target or "الوضع العام", "week", req.format)
    return {"job_id": None, "status": "done", **out}
