"""Collection volume + cost estimation (spec §7,18). Computes an HONEST estimate
of how many records a study's configured scope would collect and its cost,
BEFORE activation — from the selected pages/targets × collection depth. No fake
collected numbers: until the collector runs (Sprint 3), progress is 0 and the
dashboard shows the planned scope + estimate + status.
"""
from app.services import db, studies

# per-page expectations by collection depth (spec §7)
DEPTH = {
    "light":    {"posts": 20,  "comments_per_post": 10,  "reactions_factor": 5},
    "standard": {"posts": 50,  "comments_per_post": 30,  "reactions_factor": 8},
    "deep":     {"posts": 150, "comments_per_post": 100, "reactions_factor": 12},
    "crisis":   {"posts": 300, "comments_per_post": 200, "reactions_factor": 15},
}
# $ per 1000 records (rough estimate; the real bill is metered per provider call)
RATE_PER_1K = {"posts": 0.60, "comments": 0.35, "reactions": 0.10}


def estimate_target(depth: str, comments_enabled: bool, reactions_enabled: bool) -> dict:
    d = DEPTH.get(depth, DEPTH["standard"])
    posts = d["posts"]
    comments = d["posts"] * d["comments_per_post"] if comments_enabled else 0
    reactions = d["posts"] * d["reactions_factor"] if reactions_enabled else 0
    cost = (posts / 1000 * RATE_PER_1K["posts"]
            + comments / 1000 * RATE_PER_1K["comments"]
            + reactions / 1000 * RATE_PER_1K["reactions"])
    return {"posts": posts, "comments": comments, "reactions": reactions,
            "records": posts + comments + reactions, "cost_usd": round(cost, 2)}


async def estimate_study(org_id: str, study_id: str) -> dict:
    """Aggregate estimate across the study's configured sources + targets."""
    sources = await studies.list_sources(org_id, study_id)
    targets = await studies.list_targets(org_id, study_id)
    src_by_id = {s["id"]: s for s in sources}

    per_platform: dict[str, dict] = {}
    per_target: list[dict] = []
    tot = {"posts": 0, "comments": 0, "reactions": 0, "records": 0, "cost_usd": 0.0}

    for t in targets:
        if not t.get("include", True):
            continue
        src = src_by_id.get(t.get("study_source_id")) or {}
        platform = src.get("platform", "facebook")
        depth = src.get("collection_mode", "standard")
        est = estimate_target(depth, src.get("comments_enabled", True), src.get("reactions_enabled", False))
        per_target.append({"target": t.get("target_name"), "type": t.get("target_type"),
                           "platform": platform, "depth": depth, **est})
        pp = per_platform.setdefault(platform, {"targets": 0, "records": 0, "cost_usd": 0.0})
        pp["targets"] += 1
        pp["records"] += est["records"]
        pp["cost_usd"] = round(pp["cost_usd"] + est["cost_usd"], 2)
        for k in ("posts", "comments", "reactions", "records"):
            tot[k] += est[k]
        tot["cost_usd"] = round(tot["cost_usd"] + est["cost_usd"], 2)

    return {"total": tot, "by_platform": per_platform, "by_target": per_target,
            "target_count": len(per_target),
            "note": "تقدير أوّلي قبل التفعيل — الكلفة الفعلية تُقاس لكل نداء مزوّد."}


async def set_status(org_id: str, study_id: str, status: str) -> bool:
    """Record collection status on the study's settings (queued|collecting|paused|done).
    Real record collection is wired in Sprint 3; this marks intent + is audited."""
    try:
        if db.enabled():
            s = await studies_get_settings(org_id, study_id)
            s["collection_status"] = status
            return await db.update("surveys", f"id=eq.{study_id}&organization_id=eq.{org_id}",
                                   {"settings_json": s})
    except Exception:
        pass
    return False


async def studies_get_settings(org_id: str, study_id: str) -> dict:
    from app.services import surveys
    s = await surveys.get_survey(org_id, study_id)
    return (s or {}).get("settings_json") or {}


async def collection_scope(org_id: str, study_id: str) -> dict:
    """Everything the collection dashboard needs (spec §18) — configured scope,
    live status, and estimate. Collected/progress counts are real (from stored
    signals); 0 until the collector runs."""
    from app.services import surveys
    study = await surveys.get_survey(org_id, study_id)
    sources = await studies.list_sources(org_id, study_id)
    targets = await studies.list_targets(org_id, study_id)
    estimate = await estimate_study(org_id, study_id)
    settings = (study or {}).get("settings_json") or {}
    return {
        "study": study,
        "status": settings.get("collection_status", "not_started"),
        "platforms": [s["platform"] for s in sources],
        "sources": sources,
        "targets": targets,
        "estimate": estimate,
        "collected": {"records": 0, "comments": 0, "reactions": 0},  # real, wired Sprint 3
    }
