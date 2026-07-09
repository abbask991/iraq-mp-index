"""Strategic Indices Lab API — Public Anger Index (PAI).

  GET  /api/indices/public-anger            → latest PAI for a scope
  GET  /api/indices/public-anger/timeline   → historical timeline
  GET  /api/indices/public-anger/drivers    → anger drivers
  GET  /api/indices/public-anger/narratives → angry narratives
  GET  /api/indices/public-anger/evidence   → evidence list
  POST /api/indices/public-anger/run        → compute + persist (org-attributed)
"""
import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.common_auth import current_org
from app.services import redis_client
from app.services.indices import public_anger as pai

router = APIRouter(prefix="/api/indices/public-anger", tags=["indices"])


def _key(st: str, si: str, period: str) -> str:
    return f"pai:{st}:{si}:{period}"


async def _get(scope_type: str, scope_id: str, scope_name: str, period: str, demo: bool) -> dict:
    if demo:
        return await pai.build(scope_type, scope_id, scope_name, period, demo=True)
    key = _key(scope_type, scope_id, period)
    try:
        raw = await redis_client.get(key)
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    res = await pai.build(scope_type, scope_id, scope_name, period)
    try:
        await redis_client.set(key, json.dumps(res, ensure_ascii=False), ex=900)
    except Exception:
        pass
    return res


@router.get("")
async def get_pai(scope_type: str = "country", scope_id: str = "iraq",
                  scope_name: str = "العراق", period: str = "week", demo: bool = False):
    return await _get(scope_type, scope_id, scope_name, period, demo)


@router.get("/timeline")
async def timeline(scope_type: str = "country", scope_id: str = "iraq",
                   scope_name: str = "العراق", period: str = "week", demo: bool = False):
    d = await _get(scope_type, scope_id, scope_name, period, demo)
    return {"scope_name": d.get("scope_name"), "timeline": d.get("timeline", {}),
            "score": d.get("score"), "trend": d.get("trend")}


@router.get("/drivers")
async def drivers(scope_type: str = "country", scope_id: str = "iraq",
                  scope_name: str = "العراق", period: str = "week", demo: bool = False):
    d = await _get(scope_type, scope_id, scope_name, period, demo)
    return {"scope_name": d.get("scope_name"), "drivers": d.get("drivers", [])}


@router.get("/narratives")
async def narratives(scope_type: str = "country", scope_id: str = "iraq",
                     scope_name: str = "العراق", period: str = "week", demo: bool = False):
    d = await _get(scope_type, scope_id, scope_name, period, demo)
    return {"scope_name": d.get("scope_name"), "narratives": d.get("narratives", [])}


@router.get("/evidence")
async def evidence(scope_type: str = "country", scope_id: str = "iraq",
                   scope_name: str = "العراق", period: str = "week", demo: bool = False):
    d = await _get(scope_type, scope_id, scope_name, period, demo)
    return {"scope_name": d.get("scope_name"), "evidence": d.get("evidence", [])}


class RunReq(BaseModel):
    scope_type: str = "country"
    scope_id: str = "iraq"
    scope_name: str = "العراق"
    period: str = "week"


@router.post("/run")
async def run(req: RunReq, ctx: dict = Depends(current_org)):
    """Force a fresh calculation, attribute it to the tenant, and persist it."""
    res = await pai.build(req.scope_type, req.scope_id, req.scope_name, req.period,
                          org_id=ctx["org_id"], persist=True)
    try:
        await redis_client.set(_key(req.scope_type, req.scope_id, req.period),
                               json.dumps(res, ensure_ascii=False), ex=900)
    except Exception:
        pass
    return res
