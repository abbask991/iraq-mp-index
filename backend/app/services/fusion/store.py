"""Unified post storage — every platform's normalized posts in one table
(social_posts), so fusion can query across all platforms by entity/time.
Best-effort: degrades to no-op if the DB/table is absent (run migration 009)."""
from app.services import db
from app.services.fusion import reach


def _row(p: dict, entity: str | None) -> dict:
    eng = p.get("engagement", {})
    author = p.get("author") or {}
    fol = author.get("followers", 0) or 0
    plat = p.get("platform", "x")
    return {
        "platform": plat, "post_id": str(p.get("id") or p.get("url") or "")[:200] or None,
        "entity": entity, "author": author.get("username") or author.get("name"),
        "author_followers": fol, "text": (p.get("text") or "")[:2000], "url": p.get("url"),
        "likes": int(eng.get("likes", 0) or 0), "comments": int(eng.get("comments", 0) or 0),
        "shares": int(eng.get("shares", 0) or 0), "views": int(eng.get("views", 0) or 0),
        "reach": reach.estimated_reach(plat, eng, fol),
        "sentiment": p.get("sentiment"), "created_at": p.get("created_at"),
    }


async def store_posts(posts: list[dict], entity: str | None = None) -> dict:
    if not db.enabled() or not posts:
        return {"stored": 0}
    rows = [_row(p, entity) for p in posts if (p.get("id") or p.get("url"))]
    n = 0
    # chunk to keep payloads reasonable
    for i in range(0, len(rows), 100):
        try:
            ok = await db.insert("social_posts", rows[i:i + 100], upsert=True, on_conflict="platform,post_id")
            if ok:
                n += len(rows[i:i + 100])
        except Exception:
            pass
    return {"stored": n}


async def query(entity: str, *, platforms=None, since=None, limit=300) -> list[dict]:
    if not db.enabled():
        return []
    q = ("select=platform,author,author_followers,text,url,likes,comments,shares,views,reach,sentiment,created_at"
         f"&entity=eq.{entity}&order=collected_at.desc&limit={limit}")
    if platforms:
        q += f"&platform=in.({','.join(platforms)})"
    if since:
        q += f"&created_at=gte.{since}"
    try:
        rows = await db.select("social_posts", q)
        return rows or []
    except Exception:
        return []


def to_post(row: dict) -> dict:
    """DB row → the in-memory fused-post shape used by picture/reach."""
    return {
        "platform": row.get("platform"), "url": row.get("url"), "text": row.get("text") or "",
        "created_at": row.get("created_at"), "sentiment": row.get("sentiment"),
        "author": {"username": row.get("author"), "followers": row.get("author_followers", 0)},
        "engagement": {"likes": row.get("likes", 0), "comments": row.get("comments", 0),
                       "shares": row.get("shares", 0), "views": row.get("views", 0)},
        "reach": row.get("reach", 0),
    }
