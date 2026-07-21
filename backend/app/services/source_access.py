"""SourceAccessService (spec §12) — decides whether an org may use a data source
for a given operation. Resolution: source status → package allows it → org
enabled → operation supported/enabled → usage caps. Falls back to code defaults
(catalog + per-plan source sets) until Platform-Admin persists them.
"""
from app.services import db, usage_limits

# Global source catalog (code defaults; persisted in source_catalog by Phase 4).
SOURCE_CATALOG: dict[str, dict] = {
    "google_news":   {"name": "أخبار Google", "category": "news", "posts": True, "comments": False, "realtime": False, "historical": True},
    "rss":           {"name": "RSS", "category": "news", "posts": True, "comments": False, "realtime": False, "historical": True},
    "news_websites": {"name": "مواقع إخبارية", "category": "news", "posts": True, "comments": False, "realtime": False, "historical": True},
    "facebook":      {"name": "Facebook", "category": "social", "posts": True, "comments": True, "reactions": True, "realtime": False, "historical": True},
    "x":             {"name": "X (Twitter)", "category": "social", "posts": True, "comments": True, "realtime": True, "historical": True},
    "telegram":      {"name": "Telegram", "category": "messaging", "posts": True, "comments": False, "realtime": True, "historical": False},
    "youtube":       {"name": "YouTube", "category": "video", "posts": True, "comments": True, "realtime": False, "historical": True},
    "tiktok":        {"name": "TikTok", "category": "video", "posts": True, "comments": True, "realtime": False, "historical": False},
    "instagram":     {"name": "Instagram", "category": "social", "posts": True, "comments": True, "realtime": False, "historical": False},
    "google_reviews": {"name": "تقييمات Google", "category": "reviews", "posts": True, "comments": True, "realtime": False, "historical": True},
}

# Per-plan source access (code defaults; persisted in package_sources by Phase 4).
PACKAGE_SOURCES: dict[str, set[str]] = {
    "trial":      {"google_news", "rss"},
    "basic":      {"google_news", "rss", "news_websites", "facebook", "x"},
    "pro":        {"google_news", "rss", "news_websites", "facebook", "x", "telegram", "youtube", "google_reviews"},
    "enterprise": set(SOURCE_CATALOG.keys()),
}

# operation → the catalog capability it requires
_OP_CAP = {
    "collect_posts": "posts",
    "collect_comments": "comments",
    "collect_reactions": "reactions",
    "historical_fetch": "historical",
    "realtime_monitoring": "realtime",
}


def _package_allows(plan: str | None, source_key: str) -> bool:
    return source_key in PACKAGE_SOURCES.get(plan or "trial", PACKAGE_SOURCES["trial"])


async def _org_source_rows(org_id: str | None) -> dict:
    """organization_sources → {source_key: row}. Empty if unseeded (→ defaults)."""
    out: dict[str, dict] = {}
    try:
        if db.enabled() and org_id:
            rows = await db.select("organization_sources",
                                   f"select=*&organization_id=eq.{org_id}&limit=200")
            for r in rows or []:
                if r.get("source_key"):
                    out[r["source_key"]] = r
    except Exception:
        pass
    return out


async def resolve_sources(org_id: str | None, plan: str | None) -> list[dict]:
    """The org's usable sources: package default ∪ explicit org rows, each with
    its enabled flag, collection mode and refresh interval."""
    org_rows = await _org_source_rows(org_id)
    out = []
    for key, cat in SOURCE_CATALOG.items():
        row = org_rows.get(key)
        pkg_default = _package_allows(plan, key)
        enabled = bool(row["enabled"]) if row and row.get("enabled") is not None else pkg_default
        out.append({
            "source_key": key,
            "display_name": cat["name"],
            "category": cat["category"],
            "package_allowed": pkg_default,
            "enabled": enabled and pkg_default,   # org can't enable a source its plan forbids
            "collection_mode": (row or {}).get("collection_mode", "scheduled"),
            "refresh_interval_minutes": (row or {}).get("refresh_interval_minutes", 60),
            "comments_enabled": bool((row or {}).get("comments_enabled", False)),
            "capabilities": {k: v for k, v in cat.items() if k not in ("name", "category")},
        })
    return out


async def can_use_source(org_id: str | None, plan: str | None, source_key: str,
                         operation: str, period: str) -> dict:
    cat = SOURCE_CATALOG.get(source_key)
    if not cat:
        return {"allowed": False, "denial_reason": "unknown_source", "source_status": "unknown"}
    pkg = _package_allows(plan, source_key)
    if not pkg:
        return {"allowed": False, "denial_reason": "package_not_allowed", "source_status": "active",
                "organization_enabled": False, "package_allowed": False, "upgrade_required": True}
    rows = await _org_source_rows(org_id)
    row = rows.get(source_key)
    org_enabled = bool(row["enabled"]) if row and row.get("enabled") is not None else True
    if not org_enabled:
        return {"allowed": False, "denial_reason": "organization_disabled", "source_status": "active",
                "organization_enabled": False, "package_allowed": True}
    # operation capability check
    cap = _OP_CAP.get(operation)
    if cap and not cat.get(cap):
        return {"allowed": False, "denial_reason": f"source_lacks_{cap}", "source_status": "active",
                "organization_enabled": True, "package_allowed": True}
    if operation == "collect_comments" and row is not None and not row.get("comments_enabled", False):
        return {"allowed": False, "denial_reason": "comments_disabled_for_org",
                "source_status": "active", "organization_enabled": True, "package_allowed": True}
    # usage cap (records)
    lim = await usage_limits.check_limit(org_id, plan, "records", period, want=1)
    if not lim["allowed"]:
        return {"allowed": False, "denial_reason": "usage_limit_reached", "source_status": "active",
                "organization_enabled": True, "package_allowed": True, "limits": lim, "upgrade_required": True}
    return {"allowed": True, "source_status": "active", "organization_enabled": True,
            "package_allowed": True, "limits": lim,
            "refresh_interval": (row or {}).get("refresh_interval_minutes", 60)}


# ── analytical weights (spec §8) ─────────────────────────────────────────────
async def get_weights(org_id: str | None) -> list[dict]:
    try:
        if db.enabled() and org_id:
            rows = await db.select("organization_source_weights",
                                   f"select=*&organization_id=eq.{org_id}&limit=200")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


async def set_weight(org_id: str, source_key: str, use_case: str, weight: float, rationale: str = "") -> bool:
    try:
        if db.enabled() and org_id:
            return bool(await db.insert("organization_source_weights",
                {"organization_id": org_id, "source_key": source_key, "use_case": use_case,
                 "weight": weight, "rationale": rationale or None},
                upsert=True, on_conflict="organization_id,source_key,use_case"))
    except Exception:
        pass
    return False
