"""Facebook Page Catalog + saved panels (spec §4,5,6,9). Org-scoped: an analyst
only ever sees/edits their own org's page catalog and panels. Affiliation is
manual-only (never auto-inferred). Includes an explainable Panel Balance Score
that flags over-concentration — WITHOUT claiming representativeness.
"""
from app.services import db

PAGE_CATEGORIES = (
    "government", "ministry", "party", "politician", "news_media", "local_news",
    "governorate", "community", "activist", "influencer", "company",
    "public_service", "research_center", "other",
)


# ── catalog ──────────────────────────────────────────────────────────────────
async def list_pages(org_id: str, filters: dict | None = None) -> list[dict]:
    filters = filters or {}
    try:
        if db.enabled():
            q = f"select=*&organization_id=eq.{org_id}&order=page_name&limit=1000"
            for col in ("category", "country", "governorate", "city", "collection_status"):
                v = filters.get(col)
                if v:
                    q += f"&{col}=eq.{v}"
            if filters.get("comments_available") is True:
                q += "&comments_available=is.true"
            rows = await db.select("facebook_page_catalog", q)
            rows = rows if isinstance(rows, list) else []
            # free-text name filter applied in Python (ilike would need encoding)
            term = (filters.get("q") or "").strip().lower()
            if term:
                rows = [r for r in rows if term in (r.get("page_name") or "").lower()]
            return rows
    except Exception:
        pass
    return []


async def create_page(org_id: str, data: dict, created_by: str | None = None) -> dict | None:
    row = {
        "organization_id": org_id, "created_by": created_by,
        "page_name": (data.get("page_name") or "").strip(),
        "page_fb_id": data.get("page_fb_id") or None,
        "page_url": data.get("page_url") or None,
        "category": data.get("category") if data.get("category") in PAGE_CATEGORIES else "other",
        "country": data.get("country") or None,
        "governorate": data.get("governorate") or None,
        "city": data.get("city") or None,
        "language": data.get("language") or "ar",
        "affiliation": data.get("affiliation") or None,
        "affiliation_confidence": data.get("affiliation_confidence") or None,
        "affiliation_evidence": data.get("affiliation_evidence") or None,
        "audience_type": data.get("audience_type") or None,
        "page_size": data.get("page_size") or None,
        "avg_engagement": data.get("avg_engagement") or None,
        "credibility_score": data.get("credibility_score") or None,
        "comments_available": data.get("comments_available", True),
        "reactions_available": data.get("reactions_available", True),
        "historical_days": data.get("historical_days") or 0,
        "est_cost_usd": data.get("est_cost_usd") or 0,
        "notes": data.get("notes") or None,
        "tags": data.get("tags") or [],
    }
    if not row["page_name"]:
        return None
    try:
        if db.enabled():
            return await db.insert("facebook_page_catalog", row, returning=True)
    except Exception:
        pass
    return None


async def update_page(org_id: str, page_id: str, patch: dict) -> bool:
    allowed = {k: v for k, v in patch.items() if k in (
        "page_name", "page_fb_id", "page_url", "category", "country", "governorate",
        "city", "language", "affiliation", "affiliation_confidence", "affiliation_evidence",
        "audience_type", "page_size", "avg_engagement", "credibility_score",
        "comments_available", "reactions_available", "historical_days", "est_cost_usd",
        "collection_status", "notes", "tags")}
    if not allowed:
        return False
    try:
        if db.enabled():
            return await db.update("facebook_page_catalog",
                                   f"id=eq.{page_id}&organization_id=eq.{org_id}", allowed)
    except Exception:
        pass
    return False


async def delete_page(org_id: str, page_id: str) -> bool:
    try:
        if db.enabled():
            return await db.delete("facebook_page_catalog", f"id=eq.{page_id}&organization_id=eq.{org_id}")
    except Exception:
        pass
    return False


async def get_pages_by_ids(org_id: str, ids: list[str]) -> list[dict]:
    if not ids:
        return []
    try:
        if db.enabled():
            lst = ",".join(ids)
            rows = await db.select("facebook_page_catalog",
                                   f"select=*&organization_id=eq.{org_id}&id=in.({lst})&limit=1000")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


# ── saved panels ─────────────────────────────────────────────────────────────
async def list_panels(org_id: str) -> list[dict]:
    try:
        if db.enabled():
            rows = await db.select("facebook_page_panels",
                                   f"select=*&organization_id=eq.{org_id}&order=updated_at.desc&limit=500")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


async def create_panel(org_id: str, data: dict, page_ids: list[str], created_by: str | None = None) -> dict | None:
    row = {"organization_id": org_id, "created_by": created_by,
           "workspace_id": data.get("workspace_id") or None,
           "name": (data.get("name") or "لوحة صفحات").strip(),
           "description": data.get("description") or None,
           "methodology_note": data.get("methodology_note") or None,
           "page_count": len(page_ids or [])}
    try:
        if db.enabled():
            panel = await db.insert("facebook_page_panels", row, returning=True)
            if panel and page_ids:
                for i, pid in enumerate(page_ids):
                    await db.insert("facebook_page_panel_members", {
                        "organization_id": org_id, "panel_id": panel["id"], "facebook_page_id": pid,
                        "priority": i, "include": True}, upsert=True, on_conflict="panel_id,facebook_page_id")
            return panel
    except Exception:
        pass
    return None


async def panel_members(org_id: str, panel_id: str) -> list[dict]:
    try:
        if db.enabled():
            rows = await db.select("facebook_page_panel_members",
                                   f"select=*&panel_id=eq.{panel_id}&organization_id=eq.{org_id}&order=priority&limit=1000")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


async def delete_panel(org_id: str, panel_id: str) -> bool:
    try:
        if db.enabled():
            return await db.delete("facebook_page_panels", f"id=eq.{panel_id}&organization_id=eq.{org_id}")
    except Exception:
        pass
    return False


# ── panel balance score (spec §9) — explainable, NOT representativeness ──────
def balance_score(pages: list[dict]) -> dict:
    n = len(pages)
    if n == 0:
        return {"score": 0, "level": "لا صفحات", "risks": ["اللوحة فارغة"], "components": {}}

    def diversity(key: str) -> float:
        vals = [str(p.get(key) or "—") for p in pages]
        distinct = len(set(vals))
        # Herfindahl-style: 1 - sum(share^2) → 0 (concentrated) .. ~1 (diverse)
        counts: dict[str, int] = {}
        for v in vals:
            counts[v] = counts.get(v, 0) + 1
        hhi = sum((c / n) ** 2 for c in counts.values())
        return round((1 - hhi) * 100), distinct

    cat_div, cat_n = diversity("category")
    geo_div, geo_n = diversity("governorate")
    aud_div, _ = diversity("audience_type")
    comments = round(sum(1 for p in pages if p.get("comments_available")) / n * 100)
    # top-category concentration
    cat_counts: dict[str, int] = {}
    for p in pages:
        c = p.get("category") or "other"
        cat_counts[c] = cat_counts.get(c, 0) + 1
    top_cat, top_ct = max(cat_counts.items(), key=lambda x: x[1])
    top_share = round(top_ct / n * 100)

    components = {
        "category_diversity": cat_div, "geographic_diversity": geo_div,
        "audience_diversity": aud_div, "comment_availability": comments,
        "concentration_penalty": max(0, top_share - 50),
    }
    score = round(max(0, min(100,
        cat_div * 0.30 + geo_div * 0.25 + aud_div * 0.15 + comments * 0.20
        - max(0, top_share - 50) * 0.4)))
    level = ("ممتاز" if score >= 90 else "قوي" if score >= 75 else "مقبول" if score >= 60
             else "ضعيف" if score >= 40 else "متحيّز")
    risks = []
    if top_share >= 60:
        risks.append(f"فئة «{top_cat}» تشكّل {top_share}% من اللوحة")
    if geo_n <= 1:
        risks.append("تنوّع جغرافي منخفض (محافظة واحدة أو غير محدّدة)")
    if cat_n <= 2:
        risks.append("تنوّع فئات منخفض")
    if comments < 50:
        risks.append(f"التعليقات متاحة في {comments}% فقط من الصفحات")
    return {"score": score, "level": level, "risks": risks, "components": components,
            "top_category": top_cat, "top_category_share": top_share,
            "page_count": n, "note": "يقيس تنوّع مصادر الرأي الرقمي — لا يعني تمثيلاً للسكان."}


async def panel_balance(org_id: str, panel_id: str) -> dict:
    members = await panel_members(org_id, panel_id)
    ids = [m["facebook_page_id"] for m in members if m.get("include", True)]
    pages = await get_pages_by_ids(org_id, ids)
    return balance_score(pages)
