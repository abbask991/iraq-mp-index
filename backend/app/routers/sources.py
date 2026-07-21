"""Source access + usage API (spec §7,8,12,19). The frontend/collectors ask
these endpoints what a tenant may collect and how much it has used."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.common_auth import current_org, require_admin
from app.services import audit, permissions, source_access, usage_limits

router = APIRouter(prefix="/api/sources", tags=["sources"])


def _period() -> str:
    n = datetime.now(timezone.utc)
    return f"{n.year:04d}-{n.month:02d}"


@router.get("/catalog")
async def catalog():
    return {"sources": [{"source_key": k, **v} for k, v in source_access.SOURCE_CATALOG.items()]}


@router.get("/resolved")
async def resolved(ctx: dict = Depends(current_org)):
    """The org's usable sources with enabled flags, modes and refresh intervals."""
    plan = (ctx.get("org") or {}).get("plan")
    return {"sources": await source_access.resolve_sources(ctx["org_id"], plan)}


@router.get("/can")
async def can(source_key: str, operation: str = "collect_posts", ctx: dict = Depends(current_org)):
    plan = (ctx.get("org") or {}).get("plan")
    return await source_access.can_use_source(ctx["org_id"], plan, source_key, operation, _period())


@router.get("/limits")
async def limits(ctx: dict = Depends(current_org)):
    """Usage vs package caps this period (spec §19)."""
    plan = (ctx.get("org") or {}).get("plan")
    return await usage_limits.summary(ctx["org_id"], plan, _period())


# ── analytical weights (spec §8) ─────────────────────────────────────────────
class WeightReq(BaseModel):
    source_key: str
    use_case: str = "general"
    weight: float = 1.0
    rationale: str = ""


@router.get("/weights")
async def get_weights(ctx: dict = Depends(current_org)):
    return {"weights": await source_access.get_weights(ctx["org_id"])}


@router.post("/weights")
async def set_weight(req: WeightReq, ctx: dict = Depends(permissions.require_org_permission("sources.manage"))):
    ok = await source_access.set_weight(ctx["org_id"], req.source_key, req.use_case, req.weight, req.rationale)
    return {"saved": ok}


# ── platform-admin: assign / configure an org's sources (spec §7) ────────────
class AssignReq(BaseModel):
    organization_id: str
    source_key: str
    enabled: bool = True
    collection_mode: str = "scheduled"
    refresh_interval_minutes: int = 60
    daily_record_limit: int | None = None
    monthly_record_limit: int | None = None
    comments_enabled: bool = False
    historical_days: int = 0


@router.post("/assign")
async def assign(req: AssignReq, admin: dict = Depends(require_admin)):
    from app.services import db
    row = req.dict()
    row["source_key"] = req.source_key
    ok = False
    try:
        if db.enabled():
            ok = bool(await db.insert("organization_sources", row, upsert=True,
                                      on_conflict="organization_id,source_key"))
    except Exception:
        ok = False
    if ok:
        await audit.log(req.organization_id, "source.assign", actor_email=admin.get("email"),
                        target=req.source_key, new={"enabled": req.enabled, "mode": req.collection_mode})
    return {"saved": ok}
