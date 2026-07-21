"""Survey Studio API (Phase 1). Every route is tenant-scoped (org from the
session), gated by the survey_studio feature entitlement, and mutations require
the matching survey.* permission and are audit-logged.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.common_auth import current_org
from app.services import audit, feature_access, permissions, surveys

router = APIRouter(prefix="/api/surveys", tags=["surveys"])


async def _survey_ctx(ctx: dict, perm: str | None) -> dict:
    org = ctx.get("org") or {}
    verdict = await feature_access.can_access_feature(
        ctx["org_id"], ctx.get("role"), org.get("plan"), org.get("org_type"),
        (ctx.get("user") or {}).get("id"), feature_access.SURVEY_FEATURE_KEY)
    if not verdict["allowed"]:
        raise HTTPException(403, "وحدة الاستطلاعات غير مفعّلة لباقتك")
    if perm and not permissions.has_permission(ctx.get("role"), perm):
        raise HTTPException(403, f"لا تملك صلاحية {perm}")
    return ctx


def require_survey(perm: str | None = None):
    async def dep(ctx: dict = Depends(current_org)) -> dict:
        return await _survey_ctx(ctx, perm)
    return dep


def _actor(ctx: dict):
    return {"actor_user_id": (ctx.get("user") or {}).get("id"),
            "actor_email": (ctx.get("user") or {}).get("email")}


# ── models ───────────────────────────────────────────────────────────────────
class SurveyReq(BaseModel):
    title: str = ""
    internal_name: str | None = None
    description: str | None = None
    research_objective: str | None = None
    survey_type: str = "standard_survey"
    language: str = "ar"
    country: str | None = None
    workspace_id: str | None = None
    project_id: str | None = None
    sampling_method: str | None = None
    population_description: str | None = None
    population_size: int | None = None
    desired_sample_size: int | None = None
    anonymity_mode: str | None = None
    access_mode: str | None = None


class SurveyPatch(BaseModel):
    title: str | None = None
    internal_name: str | None = None
    description: str | None = None
    research_objective: str | None = None
    survey_type: str | None = None
    language: str | None = None
    country: str | None = None
    sampling_method: str | None = None
    population_description: str | None = None
    population_size: int | None = None
    desired_sample_size: int | None = None
    anonymity_mode: str | None = None
    access_mode: str | None = None
    settings_json: dict | None = None
    methodology_json: dict | None = None


class QuestionReq(BaseModel):
    question_type: str
    title: str = ""
    description: str | None = None
    required: bool = False
    position: int = 0
    section_id: str | None = None
    validation_json: dict | None = None
    options: list[dict] | None = None


class QuestionPatch(BaseModel):
    title: str | None = None
    description: str | None = None
    required: bool | None = None
    position: int | None = None
    question_type: str | None = None
    section_id: str | None = None
    validation_json: dict | None = None


class SectionReq(BaseModel):
    title: str = "قسم"
    description: str | None = None
    position: int = 0
    is_randomized: bool = False


# ── surveys ──────────────────────────────────────────────────────────────────
@router.get("")
async def list_surveys(workspace_id: str = "", project_id: str = "", ctx: dict = Depends(require_survey())):
    return {"surveys": await surveys.list_surveys(ctx["org_id"], workspace_id or None, project_id or None)}


@router.get("/summary")
async def summary(ctx: dict = Depends(require_survey())):
    return await surveys.summary(ctx["org_id"])


@router.post("")
async def create_survey(req: SurveyReq, ctx: dict = Depends(require_survey("survey.create"))):
    s = await surveys.create_survey(ctx["org_id"], req.dict(), created_by=(ctx.get("user") or {}).get("id"))
    if s:
        await audit.log(ctx["org_id"], "survey.create", target=s.get("id"),
                        new={"title": req.title, "type": req.survey_type}, **_actor(ctx))
    return {"created": bool(s), "survey": s}


@router.get("/{survey_id}")
async def get_survey(survey_id: str, ctx: dict = Depends(require_survey())):
    s = await surveys.get_survey(ctx["org_id"], survey_id)
    if not s:
        raise HTTPException(404, "not found")
    return {"survey": s,
            "sections": await surveys.list_sections(ctx["org_id"], survey_id),
            "questions": await surveys.list_questions(ctx["org_id"], survey_id)}


@router.patch("/{survey_id}")
async def patch_survey(survey_id: str, req: SurveyPatch, ctx: dict = Depends(require_survey("survey.edit"))):
    ok = await surveys.update_survey(ctx["org_id"], survey_id, req.dict(exclude_none=True))
    if ok:
        await audit.log(ctx["org_id"], "survey.edit", target=survey_id,
                        new=req.dict(exclude_none=True), **_actor(ctx))
    return {"updated": ok}


@router.post("/{survey_id}/publish")
async def publish_survey(survey_id: str, ctx: dict = Depends(require_survey("survey.publish"))):
    res = await surveys.publish(ctx["org_id"], survey_id, created_by=(ctx.get("user") or {}).get("id"))
    if res.get("ok"):
        await audit.log(ctx["org_id"], "survey.publish", target=survey_id,
                        new={"public_token": res.get("public_token"), "version": res.get("version")}, **_actor(ctx))
    return res


@router.post("/{survey_id}/pause")
async def pause_survey(survey_id: str, ctx: dict = Depends(require_survey("survey.pause"))):
    res = await surveys.set_status(ctx["org_id"], survey_id, "paused")
    if res.get("ok"):
        await audit.log(ctx["org_id"], "survey.pause", target=survey_id, **_actor(ctx))
    return res


@router.post("/{survey_id}/close")
async def close_survey(survey_id: str, ctx: dict = Depends(require_survey("survey.close"))):
    res = await surveys.set_status(ctx["org_id"], survey_id, "closed", extra={"closed_at": surveys._iso_now()})
    if res.get("ok"):
        await audit.log(ctx["org_id"], "survey.close", target=survey_id, **_actor(ctx))
    return res


# ── sections ─────────────────────────────────────────────────────────────────
@router.get("/{survey_id}/sections")
async def list_sections(survey_id: str, ctx: dict = Depends(require_survey())):
    return {"sections": await surveys.list_sections(ctx["org_id"], survey_id)}


@router.post("/{survey_id}/sections")
async def create_section(survey_id: str, req: SectionReq, ctx: dict = Depends(require_survey("survey.edit"))):
    sec = await surveys.create_section(ctx["org_id"], survey_id, req.dict())
    return {"created": bool(sec), "section": sec}


# ── questions ────────────────────────────────────────────────────────────────
@router.get("/{survey_id}/questions")
async def list_questions(survey_id: str, ctx: dict = Depends(require_survey())):
    return {"questions": await surveys.list_questions(ctx["org_id"], survey_id)}


@router.post("/{survey_id}/questions")
async def add_question(survey_id: str, req: QuestionReq, ctx: dict = Depends(require_survey("survey.edit"))):
    q = await surveys.create_question(ctx["org_id"], survey_id, req.dict())
    if not q:
        raise HTTPException(400, "invalid question type or survey")
    await audit.log(ctx["org_id"], "survey.question_add", target=survey_id,
                    new={"type": req.question_type}, **_actor(ctx))
    return {"created": True, "question": q}


@router.patch("/{survey_id}/questions/{question_id}")
async def patch_question(survey_id: str, question_id: str, req: QuestionPatch,
                         ctx: dict = Depends(require_survey("survey.edit"))):
    ok = await surveys.update_question(ctx["org_id"], survey_id, question_id, req.dict(exclude_none=True))
    return {"updated": ok}


@router.delete("/{survey_id}/questions/{question_id}")
async def remove_question(survey_id: str, question_id: str, ctx: dict = Depends(require_survey("survey.edit"))):
    ok = await surveys.delete_question(ctx["org_id"], survey_id, question_id)
    if ok:
        await audit.log(ctx["org_id"], "survey.question_delete", target=survey_id, **_actor(ctx))
    return {"deleted": ok}


@router.get("/{survey_id}/questions/{question_id}/options")
async def question_options(survey_id: str, question_id: str, ctx: dict = Depends(require_survey())):
    return {"options": await surveys.list_options(ctx["org_id"], question_id)}
