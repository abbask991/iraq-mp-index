"""Organizations API — the tenant layer.

  GET  /api/orgs/me            → caller's org + role (auto-provisions on first login)
  GET  /api/orgs/me/usage      → caller's data-source cost this month (billing)
  GET  /api/orgs               → list all tenants           (admin)
  POST /api/orgs               → create a tenant             (admin)
  POST /api/orgs/{id}/members  → attach a user to a tenant   (admin)
  PATCH /api/orgs/{id}         → plan / branding / budget / byok (admin)
  GET  /api/orgs/{id}/usage    → a tenant's data cost        (admin)
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.common_auth import current_org, require_admin
from app.services import orgs, metering

router = APIRouter(prefix="/api/orgs", tags=["orgs"])


def _month_start() -> str:
    # first day of the current month, UTC — no Date.now() gymnastics needed server-side
    from datetime import datetime, timezone
    n = datetime.now(timezone.utc)
    return n.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()


@router.get("/me")
async def me(ctx: dict = Depends(current_org)):
    return {"org": ctx["org"], "role": ctx["role"], "email": ctx["user"]["email"]}


@router.get("/me/usage")
async def my_usage(ctx: dict = Depends(current_org)):
    return await metering.summary(ctx["org_id"], since_iso=_month_start())


@router.get("")
async def all_orgs(_: dict = Depends(require_admin)):
    return {"orgs": await orgs.list_orgs()}


class CreateReq(BaseModel):
    name: str
    plan: str = "trial"


@router.post("")
async def create(req: CreateReq, _: dict = Depends(require_admin)):
    org = await orgs.create_org(req.name, req.plan)
    return {"created": bool(org), "org": org}


class MemberReq(BaseModel):
    user_id: str
    email: str | None = None
    role: str = "member"


@router.post("/{org_id}/members")
async def add_member(org_id: str, req: MemberReq, _: dict = Depends(require_admin)):
    ok = await orgs.add_member(org_id, req.user_id, req.email, req.role)
    return {"added": ok}


class UpdateReq(BaseModel):
    name: str | None = None
    plan: str | None = None
    branding: dict | None = None
    api_budget_usd: float | None = None
    byok: dict | None = None
    status: str | None = None


@router.patch("/{org_id}")
async def update(org_id: str, req: UpdateReq, _: dict = Depends(require_admin)):
    patch = {k: v for k, v in req.dict().items() if v is not None}
    return {"updated": await orgs.update_org(org_id, patch)}


@router.get("/{org_id}/usage")
async def org_usage(org_id: str, _: dict = Depends(require_admin)):
    return await metering.summary(org_id, since_iso=_month_start())
