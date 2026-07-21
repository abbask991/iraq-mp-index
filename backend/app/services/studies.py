"""Study source selection (spec §10,11) — attach cross-platform sources and
their concrete targets (Facebook pages, X accounts, keywords…) to a study. All
org-scoped; a Facebook panel can be expanded into per-page targets.
"""
from app.services import db, facebook_pages

PLATFORMS = ("facebook", "x", "telegram", "tiktok", "instagram", "youtube",
             "google_reviews", "google_news", "rss", "news_websites")
COLLECTION_MODES = ("light", "standard", "deep", "crisis")


# ── study_sources (platform level) ───────────────────────────────────────────
async def list_sources(org_id: str, study_id: str) -> list[dict]:
    try:
        if db.enabled():
            rows = await db.select("study_sources",
                                   f"select=*&study_id=eq.{study_id}&organization_id=eq.{org_id}&order=priority&limit=100")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


async def set_source(org_id: str, study_id: str, platform: str, cfg: dict) -> dict | None:
    if platform not in PLATFORMS:
        return None
    row = {
        "organization_id": org_id, "study_id": study_id, "platform": platform,
        "enabled": cfg.get("enabled", True),
        "priority": cfg.get("priority", 0),
        "analytical_weight": cfg.get("analytical_weight", 1.0),
        "collection_mode": cfg.get("collection_mode") if cfg.get("collection_mode") in COLLECTION_MODES else "standard",
        "historical_days": cfg.get("historical_days", 0),
        "comments_enabled": cfg.get("comments_enabled", False),
        "reactions_enabled": cfg.get("reactions_enabled", False),
        "media_enabled": cfg.get("media_enabled", False),
        "refresh_interval_minutes": cfg.get("refresh_interval_minutes", 60),
        "record_limit": cfg.get("record_limit"),
        "cost_cap": cfg.get("cost_cap"),
        "configuration_json": cfg.get("configuration_json") or {},
    }
    try:
        if db.enabled():
            return await db.insert("study_sources", row, upsert=True, on_conflict="study_id,platform", returning=True)
    except Exception:
        pass
    return None


async def remove_source(org_id: str, study_id: str, platform: str) -> bool:
    try:
        if db.enabled():
            return await db.delete("study_sources",
                                   f"study_id=eq.{study_id}&platform=eq.{platform}&organization_id=eq.{org_id}")
    except Exception:
        pass
    return False


# ── study_source_targets (concrete sources) ──────────────────────────────────
async def list_targets(org_id: str, study_id: str) -> list[dict]:
    try:
        if db.enabled():
            rows = await db.select("study_source_targets",
                                   f"select=*&study_id=eq.{study_id}&organization_id=eq.{org_id}&order=priority&limit=2000")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


async def add_target(org_id: str, study_id: str, study_source_id: str | None, t: dict) -> dict | None:
    row = {
        "organization_id": org_id, "study_id": study_id, "study_source_id": study_source_id,
        "target_type": t.get("target_type"), "target_external_id": t.get("target_external_id"),
        "target_name": t.get("target_name"), "target_url": t.get("target_url"),
        "include": t.get("include", True), "priority": t.get("priority", 0),
        "analytical_weight": t.get("analytical_weight", 1.0),
        "metadata_json": t.get("metadata_json") or {},
    }
    try:
        if db.enabled():
            return await db.insert("study_source_targets", row, returning=True)
    except Exception:
        pass
    return None


async def remove_target(org_id: str, study_id: str, target_id: str) -> bool:
    try:
        if db.enabled():
            return await db.delete("study_source_targets",
                                   f"id=eq.{target_id}&study_id=eq.{study_id}&organization_id=eq.{org_id}")
    except Exception:
        pass
    return False


async def attach_facebook_pages(org_id: str, study_id: str, page_ids: list[str]) -> int:
    """Expand chosen Facebook catalog pages into study targets (spec §5)."""
    pages = await facebook_pages.get_pages_by_ids(org_id, page_ids)
    if not pages:
        return 0
    src = await set_source(org_id, study_id, "facebook", {"enabled": True, "comments_enabled": True})
    src_id = (src or {}).get("id")
    n = 0
    for i, p in enumerate(pages):
        r = await add_target(org_id, study_id, src_id, {
            "target_type": "facebook_page", "target_external_id": p.get("page_fb_id"),
            "target_name": p.get("page_name"), "target_url": p.get("page_url"),
            "priority": i, "metadata_json": {"page_id": p.get("id"), "category": p.get("category"),
                                             "governorate": p.get("governorate")}})
        if r:
            n += 1
    return n


async def attach_facebook_panel(org_id: str, study_id: str, panel_id: str) -> int:
    members = await facebook_pages.panel_members(org_id, panel_id)
    ids = [m["facebook_page_id"] for m in members if m.get("include", True)]
    return await attach_facebook_pages(org_id, study_id, ids)


async def study_source_summary(org_id: str, study_id: str) -> dict:
    """Platform + target counts for the study's data-collection scope (spec §15 seed)."""
    sources = await list_sources(org_id, study_id)
    targets = await list_targets(org_id, study_id)
    by_platform: dict[str, int] = {}
    for t in targets:
        # find platform via its study_source
        pl = next((s["platform"] for s in sources if s["id"] == t.get("study_source_id")), t.get("target_type", "?"))
        by_platform[pl] = by_platform.get(pl, 0) + 1
    return {"platforms": [s["platform"] for s in sources], "source_count": len(sources),
            "target_count": len(targets), "targets_by_platform": by_platform}
