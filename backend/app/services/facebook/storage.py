"""Persistence for the Facebook intelligence layer (best-effort).

All writes are upserts keyed on post_id / comment_id so re-collecting the same
post UPDATES its metrics (reactions/comments grow over time → enables velocity
& growth trends). If the tables don't exist yet (migration 011 not applied) or
Supabase is unreachable, every call degrades to a no-op — the live snapshots
keep working regardless.
"""
from app.services import db


async def _table_ok(table: str) -> bool:
    if not db.enabled():
        return False
    try:
        await db.select(table, "select=id&limit=1")   # cheap probe
        return True
    except Exception:
        return False


async def save_posts(rows: list[dict]) -> int:
    rows = [r for r in rows if r and r.get("post_id")]
    if not rows or not db.enabled():
        return 0
    try:
        ok = await db.insert("facebook_posts", rows, upsert=True, on_conflict="post_id")
        return len(rows) if ok else 0
    except Exception:
        return 0


async def save_comments(rows: list[dict]) -> int:
    rows = [r for r in rows if r and r.get("comment_id")]
    if not rows or not db.enabled():
        return 0
    try:
        ok = await db.insert("facebook_comments", rows, upsert=True, on_conflict="comment_id")
        return len(rows) if ok else 0
    except Exception:
        return 0


async def upsert_page(page_name: str, patch: dict) -> bool:
    if not page_name or not db.enabled():
        return False
    try:
        return bool(await db.insert("facebook_pages", {"page_name": page_name, **patch},
                                    upsert=True, on_conflict="page_name"))
    except Exception:
        return False


# ── reads (used by summary / page_ranker / viral) ───────────────────────────
async def recent_posts(limit: int = 1000, since_hours: int | None = None) -> list[dict]:
    if not db.enabled():
        return []
    q = f"select=*&order=collected_at.desc&limit={limit}"
    try:
        rows = await db.select("facebook_posts", q)
        return rows if isinstance(rows, list) else []
    except Exception:
        return []


async def posts_for_page(page_name: str, limit: int = 200) -> list[dict]:
    if not db.enabled():
        return []
    try:
        return await db.select(
            "facebook_posts",
            f"select=*&page_name=eq.{page_name}&order=created_at.desc&limit={limit}") or []
    except Exception:
        return []


async def comments_for_post(post_id: str, limit: int = 500) -> list[dict]:
    if not db.enabled():
        return []
    try:
        return await db.select(
            "facebook_comments",
            f"select=*&post_id=eq.{post_id}&order=created_at.desc&limit={limit}") or []
    except Exception:
        return []


async def counts() -> dict:
    """Total stored rows — drives the dashboard KPI cards. Uses PostgREST
    count=exact via a HEAD-like select; falls back to len() of a capped pull."""
    out = {"posts": 0, "comments": 0, "pages": 0}
    if not db.enabled():
        return out
    for key, table in (("posts", "facebook_posts"), ("comments", "facebook_comments"),
                       ("pages", "facebook_pages")):
        try:
            rows = await db.select(table, "select=id&limit=100000")
            out[key] = len(rows) if isinstance(rows, list) else 0
        except Exception:
            pass
    return out
