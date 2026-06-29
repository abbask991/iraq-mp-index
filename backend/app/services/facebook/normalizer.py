"""Normalize raw Apify Facebook items into the unified platform schema
(facebook_posts / facebook_comments rows). Pure/structural — no AI, no I/O.

Apify's facebook-posts-scraper field names vary across runs; we read every known
alias and default missing numerics to 0 / missing strings to None.
"""
import hashlib
from datetime import datetime, timezone

from app.services.facebook import REACTIONS


def _first(it: dict, *keys):
    for k in keys:
        v = it.get(k)
        if v not in (None, "", []):
            return v
    return None


def _int(v):
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def _iso(v):
    """Apify times come as ISO strings or unix seconds → ISO8601 UTC (or None)."""
    if v in (None, ""):
        return None
    try:
        if isinstance(v, (int, float)) or (isinstance(v, str) and v.isdigit()):
            return datetime.fromtimestamp(int(v), tz=timezone.utc).isoformat()
        return datetime.fromisoformat(str(v).replace("Z", "+00:00")).isoformat()
    except Exception:
        return None


def _post_id(it: dict, url: str) -> str:
    pid = _first(it, "postId", "post_id", "facebookId", "id")
    if pid:
        return str(pid)
    return "h:" + hashlib.sha1((url or it.get("text", "")[:120]).encode("utf-8")).hexdigest()[:20]


def _media_url(it: dict):
    m = _first(it, "media", "thumbnail", "thumbnailUrl", "imageUrl")
    if isinstance(m, list) and m:
        m0 = m[0]
        return (m0.get("url") or m0.get("thumbnail")) if isinstance(m0, dict) else m0
    return m if isinstance(m, str) else None


def normalize_post(it: dict, page_slug: str | None = None) -> dict | None:
    """Raw Apify item → a facebook_posts row dict. Returns None for non-posts."""
    if not isinstance(it, dict) or it.get("error") or it.get("text") is None:
        return None
    url = _first(it, "url", "facebookUrl", "topLevelUrl", "postUrl")
    rx = {k: _int(it.get(f)) for k, _e, _a, _p, f in REACTIONS}
    total = sum(rx.values())
    likes = _int(_first(it, "likes", "likesCount"))
    if total == 0 and likes:                       # breakdown unavailable → treat total likes as 'like'
        rx["like"] = likes
        total = likes
    comments_json = it.get("topComments") or it.get("comments_full") or None
    return {
        "platform": "facebook",
        "page_id": _first(it, "pageId", "page_id", "facebookId"),
        "page_name": _first(it, "pageName") or (it.get("user") or {}).get("name") or page_slug,
        "post_id": _post_id(it, url),
        "post_url": url,
        "post_text": (it.get("text") or "")[:4000],
        "post_type": _first(it, "type", "postType"),
        "created_at": _iso(_first(it, "time", "timestamp", "date", "publishTime")),
        "reactions_like": rx["like"], "reactions_love": rx["love"], "reactions_care": rx["care"],
        "reactions_haha": rx["haha"], "reactions_wow": rx["wow"], "reactions_sad": rx["sad"],
        "reactions_angry": rx["angry"], "reactions_total": total,
        "comments_count": _int(_first(it, "comments", "commentsCount")),
        "shares_count": _int(_first(it, "shares", "sharesCount")),
        "media_url": _media_url(it),
        "comments_json": comments_json if isinstance(comments_json, (list, dict)) else None,
        "raw_json": {k: it.get(k) for k in ("type", "pageName", "pageId", "url", "facebookUrl",
                                            "time", "timestamp", "likes", "comments", "shares") if k in it},
    }


def normalize_comments(it: dict, post_id: str, page_name: str | None) -> list[dict]:
    """Inline topComments → facebook_comments rows (best-effort; author ids rare)."""
    out = []
    for c in (it.get("topComments") or []):
        if isinstance(c, str):
            text, cdict = c, {}
        elif isinstance(c, dict):
            text, cdict = (c.get("text") or ""), c
        else:
            continue
        if not text.strip():
            continue
        cid = _first(cdict, "id", "commentId") or ("h:" + hashlib.sha1(
            (post_id + text[:80]).encode("utf-8")).hexdigest()[:20])
        out.append({
            "post_id": post_id,
            "page_name": page_name,
            "comment_id": str(cid),
            "author_name": _first(cdict, "name", "authorName", "profileName"),
            "author_id": _first(cdict, "authorId", "profileId", "userId"),
            "text": text.strip()[:2000],
            "created_at": _iso(_first(cdict, "date", "time", "timestamp")),
            "reaction_count": _int(_first(cdict, "likesCount", "reactionsCount", "likes")),
            "raw_json": None,
        })
    return out
