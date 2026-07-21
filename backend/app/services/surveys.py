"""Survey Studio service (Phase 1). Every read/write is scoped by
organization_id (and workspace/project on surveys) so tenants never see each
other's surveys, questions or responses. Lifecycle transitions are enforced
here; publishing snapshots an immutable version.
"""
import secrets

from app.services import db

VALID_TYPES = {
    "standard_survey", "quick_poll", "field_survey", "customer_satisfaction",
    "citizen_satisfaction", "election_poll", "market_research", "employee_survey",
    "academic_research", "custom",
}
VALID_STATUS = {"draft", "ready", "scheduled", "active", "paused", "closed", "completed", "archived"}
# allowed lifecycle transitions
TRANSITIONS = {
    "draft": {"ready", "active", "archived"},
    "ready": {"active", "scheduled", "draft", "archived"},
    "scheduled": {"active", "paused", "closed", "draft"},
    "active": {"paused", "closed", "completed"},
    "paused": {"active", "closed"},
    "closed": {"active", "completed", "archived"},
    "completed": {"archived"},
    "archived": {"draft"},
}


def _token() -> str:
    return secrets.token_urlsafe(12)


# ── surveys ──────────────────────────────────────────────────────────────────
async def create_survey(org_id: str, data: dict, created_by: str | None = None) -> dict | None:
    row = {
        "organization_id": org_id,
        "workspace_id": data.get("workspace_id") or None,
        "project_id": data.get("project_id") or None,
        "created_by": created_by,
        "title": (data.get("title") or "استطلاع بدون عنوان").strip(),
        "internal_name": data.get("internal_name") or None,
        "description": data.get("description") or None,
        "research_objective": data.get("research_objective") or None,
        "survey_type": data.get("survey_type") if data.get("survey_type") in VALID_TYPES else "standard_survey",
        "language": data.get("language") or "ar",
        "country": data.get("country") or None,
        "timezone": data.get("timezone") or "Asia/Baghdad",
        "sampling_method": data.get("sampling_method") or None,
        "population_description": data.get("population_description") or None,
        "population_size": data.get("population_size") or None,
        "desired_sample_size": data.get("desired_sample_size") or None,
        "anonymity_mode": data.get("anonymity_mode") or "anonymous",
        "access_mode": data.get("access_mode") or "public",
        "status": "draft",
        "settings_json": data.get("settings_json") or {},
        "methodology_json": data.get("methodology_json") or {},
    }
    try:
        if db.enabled():
            return await db.insert("surveys", row, returning=True)
    except Exception:
        pass
    return None


async def list_surveys(org_id: str, workspace_id: str | None = None, project_id: str | None = None) -> list[dict]:
    try:
        if db.enabled():
            q = f"select=*&organization_id=eq.{org_id}&order=updated_at.desc&limit=500"
            if workspace_id:
                q += f"&workspace_id=eq.{workspace_id}"
            if project_id:
                q += f"&project_id=eq.{project_id}"
            rows = await db.select("surveys", q)
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


async def get_survey(org_id: str, survey_id: str) -> dict | None:
    try:
        if db.enabled():
            rows = await db.select("surveys", f"select=*&id=eq.{survey_id}&organization_id=eq.{org_id}&limit=1")
            return rows[0] if rows else None
    except Exception:
        pass
    return None


async def update_survey(org_id: str, survey_id: str, patch: dict) -> bool:
    allowed = {k: v for k, v in patch.items() if k in (
        "title", "internal_name", "description", "research_objective", "survey_type",
        "language", "country", "timezone", "sampling_method", "population_description",
        "population_size", "desired_sample_size", "anonymity_mode", "access_mode",
        "starts_at", "ends_at", "settings_json", "methodology_json")}
    if not allowed:
        return False
    try:
        if db.enabled():
            return await db.update("surveys", f"id=eq.{survey_id}&organization_id=eq.{org_id}", allowed)
    except Exception:
        pass
    return False


async def set_status(org_id: str, survey_id: str, new_status: str, extra: dict | None = None) -> dict:
    """Guarded lifecycle transition. Returns {ok, error?, status}."""
    s = await get_survey(org_id, survey_id)
    if not s:
        return {"ok": False, "error": "not_found"}
    cur = s.get("status", "draft")
    if new_status not in VALID_STATUS:
        return {"ok": False, "error": "invalid_status"}
    if new_status != cur and new_status not in TRANSITIONS.get(cur, set()):
        return {"ok": False, "error": f"cannot go {cur} → {new_status}"}
    patch = {"status": new_status, **(extra or {})}
    try:
        if db.enabled():
            ok = await db.update("surveys", f"id=eq.{survey_id}&organization_id=eq.{org_id}", patch)
            return {"ok": bool(ok), "status": new_status}
    except Exception:
        pass
    return {"ok": False, "error": "db"}


async def publish(org_id: str, survey_id: str, created_by: str | None = None) -> dict:
    """draft/ready → active: mint a public token (if none), snapshot a version."""
    s = await get_survey(org_id, survey_id)
    if not s:
        return {"ok": False, "error": "not_found"}
    # need at least one question
    qs = await list_questions(org_id, survey_id)
    if not qs:
        return {"ok": False, "error": "add at least one question before publishing"}
    token = s.get("public_token") or _token()
    snap = await snapshot(org_id, survey_id, created_by)
    now = "now()"  # let PostgREST default; we pass explicit via update below
    res = await set_status(org_id, survey_id, "active", extra={
        "public_token": token, "published_at": _iso_now()})
    if not res.get("ok"):
        return res
    return {"ok": True, "status": "active", "public_token": token, "version": snap.get("version_number")}


async def snapshot(org_id: str, survey_id: str, created_by: str | None = None) -> dict:
    """Immutable version snapshot of the current design (spec §5,6 versions)."""
    survey = await get_survey(org_id, survey_id)
    sections = await list_sections(org_id, survey_id)
    questions = await list_questions(org_id, survey_id)
    options = await _list_all_options(org_id, survey_id)
    existing = []
    try:
        existing = await db.select("survey_versions",
                                   f"select=version_number&survey_id=eq.{survey_id}&organization_id=eq.{org_id}&order=version_number.desc&limit=1")
    except Exception:
        existing = []
    ver = (existing[0]["version_number"] + 1) if existing else 1
    row = {
        "organization_id": org_id, "survey_id": survey_id, "version_number": ver,
        "created_by": created_by, "published_at": _iso_now(),
        "snapshot_json": {"survey": survey, "sections": sections, "questions": questions, "options": options},
    }
    try:
        if db.enabled():
            await db.insert("survey_versions", row)
    except Exception:
        pass
    return {"version_number": ver}


def _iso_now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


# ── sections ─────────────────────────────────────────────────────────────────
async def list_sections(org_id: str, survey_id: str) -> list[dict]:
    try:
        if db.enabled():
            rows = await db.select("survey_sections",
                                   f"select=*&survey_id=eq.{survey_id}&organization_id=eq.{org_id}&order=position&limit=200")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


async def create_section(org_id: str, survey_id: str, data: dict) -> dict | None:
    if not await get_survey(org_id, survey_id):
        return None
    row = {"organization_id": org_id, "survey_id": survey_id,
           "title": data.get("title") or "قسم", "description": data.get("description") or None,
           "position": data.get("position") or 0, "is_randomized": bool(data.get("is_randomized"))}
    try:
        if db.enabled():
            return await db.insert("survey_sections", row, returning=True)
    except Exception:
        pass
    return None


# ── questions ────────────────────────────────────────────────────────────────
VALID_Q_TYPES = {
    "short_text", "long_text", "email", "phone", "number",
    "single_choice", "multiple_choice", "dropdown", "yes_no", "image_choice",
    "likert", "rating_scale", "star_rating", "slider", "nps",
    "matrix_single", "matrix_multiple", "ranking", "date", "time",
    "heading", "description", "consent",
}


async def list_questions(org_id: str, survey_id: str) -> list[dict]:
    try:
        if db.enabled():
            rows = await db.select("survey_questions",
                                   f"select=*&survey_id=eq.{survey_id}&organization_id=eq.{org_id}&order=position&limit=500")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


async def create_question(org_id: str, survey_id: str, data: dict) -> dict | None:
    if not await get_survey(org_id, survey_id):
        return None
    qtype = data.get("question_type")
    if qtype not in VALID_Q_TYPES:
        return None
    row = {
        "organization_id": org_id, "survey_id": survey_id,
        "section_id": data.get("section_id") or None,
        "question_key": data.get("question_key") or None,
        "question_type": qtype, "title": data.get("title") or "",
        "description": data.get("description") or None,
        "required": bool(data.get("required")),
        "position": data.get("position") or 0,
        "validation_json": data.get("validation_json") or {},
        "display_settings_json": data.get("display_settings_json") or {},
        "scoring_json": data.get("scoring_json") or {},
    }
    try:
        if db.enabled():
            q = await db.insert("survey_questions", row, returning=True)
            # inline options for choice questions
            for i, opt in enumerate(data.get("options") or []):
                await db.insert("survey_question_options", {
                    "organization_id": org_id, "survey_id": survey_id, "question_id": q["id"],
                    "label": opt.get("label") or opt.get("value") or f"خيار {i+1}",
                    "value": opt.get("value") or opt.get("label"),
                    "position": i, "score": opt.get("score")})
            return q
    except Exception:
        pass
    return None


async def update_question(org_id: str, survey_id: str, qid: str, patch: dict) -> bool:
    allowed = {k: v for k, v in patch.items() if k in (
        "section_id", "question_key", "title", "description", "required", "position",
        "question_type", "validation_json", "display_settings_json", "scoring_json")}
    if not allowed:
        return False
    try:
        if db.enabled():
            return await db.update("survey_questions",
                                   f"id=eq.{qid}&survey_id=eq.{survey_id}&organization_id=eq.{org_id}", allowed)
    except Exception:
        pass
    return False


async def delete_question(org_id: str, survey_id: str, qid: str) -> bool:
    try:
        if db.enabled():
            return await db.delete("survey_questions",
                                   f"id=eq.{qid}&survey_id=eq.{survey_id}&organization_id=eq.{org_id}")
    except Exception:
        pass
    return False


async def list_options(org_id: str, question_id: str) -> list[dict]:
    try:
        if db.enabled():
            rows = await db.select("survey_question_options",
                                   f"select=*&question_id=eq.{question_id}&organization_id=eq.{org_id}&order=position&limit=200")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


async def _list_all_options(org_id: str, survey_id: str) -> list[dict]:
    try:
        if db.enabled():
            rows = await db.select("survey_question_options",
                                   f"select=*&survey_id=eq.{survey_id}&organization_id=eq.{org_id}&order=position&limit=2000")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


# ── dashboard summary ────────────────────────────────────────────────────────
async def summary(org_id: str) -> dict:
    surveys = await list_surveys(org_id)
    by_status: dict[str, int] = {}
    for s in surveys:
        k = s.get("status", "draft")
        by_status[k] = by_status.get(k, 0) + 1
    # response + completion counts (org-scoped)
    responses = completed = 0
    try:
        if db.enabled():
            r = await db.select("survey_respondents",
                                f"select=status&organization_id=eq.{org_id}&limit=100000")
            responses = len(r or [])
            completed = sum(1 for x in (r or []) if x.get("status") == "completed")
    except Exception:
        pass
    rate = round(completed / responses * 100) if responses else 0
    return {
        "total": len(surveys),
        "active": by_status.get("active", 0),
        "draft": by_status.get("draft", 0),
        "completed_surveys": by_status.get("completed", 0) + by_status.get("closed", 0),
        "responses": responses,
        "completed_responses": completed,
        "completion_rate": rate,
        "by_status": by_status,
    }
