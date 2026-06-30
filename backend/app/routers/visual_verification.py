"""Visual Verification API (كشف الصور والتزييف) — Phase-1 MVP."""
from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from app.services import cache
from app.services.visual_verification import analyzer

router = APIRouter(prefix="/api/visual-verification", tags=["visual-verification"])


class UrlReq(BaseModel):
    image_url: str
    claim: str | None = None


@router.get("")
async def demo_or_info(demo: int = 0, claim: str | None = None):
    """Demo report (?demo=1) — powers the offline presentation."""
    if demo:
        return await cache.swr("vv:demo", 86400, lambda: analyzer.analyze(demo=True, claim=claim))
    return {"ok": True, "hint": "POST /from-url or /upload, or GET ?demo=1 for a sample report."}


@router.post("/from-url")
async def from_url(req: UrlReq):
    return await analyzer.analyze(image_url=req.image_url, claim=req.claim)


@router.post("/upload")
async def upload(file: UploadFile = File(...), claim: str = Form(None)):
    data = await file.read()
    return await analyzer.analyze(image_bytes=data, claim=claim)


@router.get("/{vid}")
async def get_report(vid: str):
    r = await analyzer.get(vid)
    return r or {"error": "NOT_FOUND", "message": "لا يوجد تقرير بهذا المعرّف (قد لا يكون التخزين مفعّلاً)."}


@router.get("/{vid}/report")
async def report_alias(vid: str):
    return await get_report(vid)
