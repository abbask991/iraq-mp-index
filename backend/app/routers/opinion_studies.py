"""Survey & Opinion Intelligence — Facebook page catalog/panels + cross-platform
study source selection (spec §4–6,10,11). Feature-gated (survey_studio),
permission-gated (survey.*), source-gated (SourceAccessService), org-scoped,
audit-logged.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.common_auth import current_org
from app.services import audit, facebook_pages, feature_access, permissions, source_access, studies, surveys
from app.services import study_collection as collection

router = APIRouter(prefix="/api/opinion", tags=["opinion-studies"])


async def _gate(ctx: dict, perm: str | None) -> dict:
    org = ctx.get("org") or {}
    v = await feature_access.can_access_feature(
        ctx["org_id"], ctx.get("role"), org.get("plan"), org.get("org_type"),
        (ctx.get("user") or {}).get("id"), feature_access.SURVEY_FEATURE_KEY)
    if not v["allowed"]:
        raise HTTPException(403, "وحدة الاستطلاعات غير مفعّلة لباقتك")
    if perm and not permissions.has_permission(ctx.get("role"), perm):
        raise HTTPException(403, f"لا تملك صلاحية {perm}")
    return ctx


def gate(perm: str | None = None):
    async def dep(ctx: dict = Depends(current_org)) -> dict:
        return await _gate(ctx, perm)
    return dep


def _actor(ctx):
    return {"actor_user_id": (ctx.get("user") or {}).get("id"), "actor_email": (ctx.get("user") or {}).get("email")}


# ── Facebook page catalog (spec §4,5) ────────────────────────────────────────
class PageReq(BaseModel):
    page_name: str
    page_fb_id: str | None = None
    page_url: str | None = None
    category: str = "other"
    country: str | None = None
    governorate: str | None = None
    city: str | None = None
    language: str = "ar"
    affiliation: str | None = None
    affiliation_confidence: str | None = None
    affiliation_evidence: str | None = None
    audience_type: str | None = None
    page_size: int | None = None
    avg_engagement: float | None = None
    credibility_score: float | None = None
    comments_available: bool = True
    reactions_available: bool = True
    est_cost_usd: float | None = None
    notes: str | None = None
    tags: list | None = None


@router.get("/facebook/pages")
async def list_pages(q: str = "", category: str = "", country: str = "", governorate: str = "",
                     comments_available: bool = False, ctx: dict = Depends(gate())):
    filters = {"q": q, "category": category or None, "country": country or None,
               "governorate": governorate or None,
               "comments_available": True if comments_available else None}
    return {"pages": await facebook_pages.list_pages(ctx["org_id"], filters),
            "categories": list(facebook_pages.PAGE_CATEGORIES)}


@router.post("/facebook/pages")
async def create_page(req: PageReq, ctx: dict = Depends(gate("survey.manage_distribution"))):
    p = await facebook_pages.create_page(ctx["org_id"], req.dict(), created_by=(ctx.get("user") or {}).get("id"))
    if p:
        await audit.log(ctx["org_id"], "fb_page.add", target=p.get("id"), new={"name": req.page_name}, **_actor(ctx))
    return {"created": bool(p), "page": p}


@router.patch("/facebook/pages/{page_id}")
async def update_page(page_id: str, patch: dict, ctx: dict = Depends(gate("survey.manage_distribution"))):
    return {"updated": await facebook_pages.update_page(ctx["org_id"], page_id, patch)}


@router.delete("/facebook/pages/{page_id}")
async def delete_page(page_id: str, ctx: dict = Depends(gate("survey.manage_distribution"))):
    return {"deleted": await facebook_pages.delete_page(ctx["org_id"], page_id)}


# ── saved panels (spec §6) ───────────────────────────────────────────────────
class PanelReq(BaseModel):
    name: str
    description: str | None = None
    methodology_note: str | None = None
    workspace_id: str | None = None
    page_ids: list[str] = []


@router.get("/facebook/panels")
async def list_panels(ctx: dict = Depends(gate())):
    return {"panels": await facebook_pages.list_panels(ctx["org_id"])}


@router.post("/facebook/panels")
async def create_panel(req: PanelReq, ctx: dict = Depends(gate("survey.manage_distribution"))):
    p = await facebook_pages.create_panel(ctx["org_id"], req.dict(), req.page_ids,
                                          created_by=(ctx.get("user") or {}).get("id"))
    if p:
        await audit.log(ctx["org_id"], "fb_panel.create", target=p.get("id"),
                        new={"name": req.name, "pages": len(req.page_ids)}, **_actor(ctx))
    return {"created": bool(p), "panel": p}


@router.get("/facebook/panels/{panel_id}")
async def get_panel(panel_id: str, ctx: dict = Depends(gate())):
    members = await facebook_pages.panel_members(ctx["org_id"], panel_id)
    ids = [m["facebook_page_id"] for m in members]
    pages = await facebook_pages.get_pages_by_ids(ctx["org_id"], ids)
    return {"members": members, "pages": pages,
            "balance": facebook_pages.balance_score([p for p in pages])}


@router.get("/facebook/panels/{panel_id}/balance")
async def panel_balance(panel_id: str, ctx: dict = Depends(gate())):
    return await facebook_pages.panel_balance(ctx["org_id"], panel_id)


@router.delete("/facebook/panels/{panel_id}")
async def delete_panel(panel_id: str, ctx: dict = Depends(gate("survey.manage_distribution"))):
    return {"deleted": await facebook_pages.delete_panel(ctx["org_id"], panel_id)}


# ── study source selection (spec §10,11) ─────────────────────────────────────
class SourceReq(BaseModel):
    platform: str
    enabled: bool = True
    priority: int = 0
    analytical_weight: float = 1.0
    collection_mode: str = "standard"
    historical_days: int = 0
    comments_enabled: bool = False
    reactions_enabled: bool = False
    record_limit: int | None = None


class AttachReq(BaseModel):
    # attach concrete targets: either explicit facebook page_ids, a saved panel, or a raw target
    facebook_page_ids: list[str] | None = None
    facebook_panel_id: str | None = None
    target: dict | None = None
    study_source_id: str | None = None


async def _own_study(ctx: dict, study_id: str):
    s = await surveys.get_survey(ctx["org_id"], study_id)
    if not s:
        raise HTTPException(404, "study not found")
    return s


@router.get("/studies/{study_id}/sources")
async def study_sources(study_id: str, ctx: dict = Depends(gate())):
    await _own_study(ctx, study_id)
    org = ctx.get("org") or {}
    available = await source_access.resolve_sources(ctx["org_id"], org.get("plan"))
    return {"selected": await studies.list_sources(ctx["org_id"], study_id),
            "available_platforms": [s for s in available if s["enabled"]],
            "scope": await studies.study_source_summary(ctx["org_id"], study_id)}


@router.post("/studies/{study_id}/sources")
async def set_study_source(study_id: str, req: SourceReq, ctx: dict = Depends(gate("survey.edit"))):
    await _own_study(ctx, study_id)
    # SourceAccessService: the org must actually be allowed this platform
    org = ctx.get("org") or {}
    allowed = {s["source_key"] for s in await source_access.resolve_sources(ctx["org_id"], org.get("plan")) if s["enabled"]}
    if req.platform not in allowed:
        raise HTTPException(403, f"المنصّة {req.platform} غير مفعّلة لهذه المؤسسة")
    src = await studies.set_source(ctx["org_id"], study_id, req.platform, req.dict())
    if src:
        await audit.log(ctx["org_id"], "study.source_set", target=study_id, new={"platform": req.platform}, **_actor(ctx))
    return {"saved": bool(src), "source": src}


@router.delete("/studies/{study_id}/sources/{platform}")
async def remove_study_source(study_id: str, platform: str, ctx: dict = Depends(gate("survey.edit"))):
    await _own_study(ctx, study_id)
    return {"removed": await studies.remove_source(ctx["org_id"], study_id, platform)}


@router.get("/studies/{study_id}/targets")
async def study_targets(study_id: str, ctx: dict = Depends(gate())):
    await _own_study(ctx, study_id)
    return {"targets": await studies.list_targets(ctx["org_id"], study_id)}


@router.post("/studies/{study_id}/targets")
async def add_study_targets(study_id: str, req: AttachReq, ctx: dict = Depends(gate("survey.edit"))):
    await _own_study(ctx, study_id)
    added = 0
    if req.facebook_panel_id:
        added = await studies.attach_facebook_panel(ctx["org_id"], study_id, req.facebook_panel_id)
    elif req.facebook_page_ids:
        added = await studies.attach_facebook_pages(ctx["org_id"], study_id, req.facebook_page_ids)
    elif req.target:
        t = await studies.add_target(ctx["org_id"], study_id, req.study_source_id, req.target)
        added = 1 if t else 0
    if added:
        await audit.log(ctx["org_id"], "study.targets_add", target=study_id, new={"count": added}, **_actor(ctx))
    return {"added": added}


@router.delete("/studies/{study_id}/targets/{target_id}")
async def remove_study_target(study_id: str, target_id: str, ctx: dict = Depends(gate("survey.edit"))):
    await _own_study(ctx, study_id)
    return {"removed": await studies.remove_target(ctx["org_id"], study_id, target_id)}


# ── collection dashboard + cost estimation (spec §7,18) ──────────────────────
@router.get("/studies/{study_id}/collection")
async def collection_scope(study_id: str, ctx: dict = Depends(gate())):
    await _own_study(ctx, study_id)
    return await collection.collection_scope(ctx["org_id"], study_id)


@router.get("/studies/{study_id}/estimate")
async def collection_estimate(study_id: str, ctx: dict = Depends(gate())):
    await _own_study(ctx, study_id)
    return await collection.estimate_study(ctx["org_id"], study_id)


@router.post("/studies/{study_id}/collection/{action}")
async def collection_control(study_id: str, action: str, ctx: dict = Depends(gate("survey.manage_distribution"))):
    await _own_study(ctx, study_id)
    status = {"start": "collecting", "pause": "paused", "resume": "collecting", "stop": "stopped"}.get(action)
    if not status:
        raise HTTPException(400, "unknown action")
    ok = await collection.set_status(ctx["org_id"], study_id, status)
    if ok:
        await audit.log(ctx["org_id"], f"study.collection_{action}", target=study_id, **_actor(ctx))
    return {"ok": ok, "status": status,
            "note": "التنفيذ الفعلي للجمع يُربط في المرحلة القادمة (Sprint 3)."}
