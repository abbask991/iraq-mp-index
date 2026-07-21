"""Feature access API (spec §11). /resolved is the single call the frontend nav
makes to know what this tenant+role may see — all logic stays server-side."""
from fastapi import APIRouter, Depends

from app.common_auth import current_org
from app.services import feature_access

router = APIRouter(prefix="/api/features", tags=["features"])


@router.get("/resolved")
async def resolved(ctx: dict = Depends(current_org)):
    """The effective feature visibility for the signed-in user's org + role:
    { hidden: [feature_key…], locked: [{feature, reason, min_package?}…] }."""
    org = ctx.get("org") or {}
    r = await feature_access.resolve_for_user(
        org_id=ctx.get("org_id"),
        role=ctx.get("role"),
        plan=org.get("plan"),
        org_type=org.get("org_type"),
        uid=(ctx.get("user") or {}).get("id"),
    )
    return {"org_id": ctx.get("org_id"), "role": ctx.get("role"),
            "plan": org.get("plan"), **r}


@router.get("/can")
async def can(feature_key: str, ctx: dict = Depends(current_org)):
    org = ctx.get("org") or {}
    return await feature_access.can_access_feature(
        org_id=ctx.get("org_id"), role=ctx.get("role"), plan=org.get("plan"),
        org_type=org.get("org_type"), uid=(ctx.get("user") or {}).get("id"),
        feature_key=feature_key)


@router.get("/catalog")
async def catalog():
    """The feature catalog (code defaults; Platform-Admin will persist/edit)."""
    return {"features": [{"feature_key": k, **v} for k, v in feature_access.FEATURE_CATALOG.items()]}
