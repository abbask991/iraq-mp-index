"""Collect scope data for PAI (§11 step 2).

Pulls from sources that work TODAY without paid keys: free Google-News RSS for the
scope, plus any stored mentions/comments in Supabase that match the scope. Returns
a flat list of items: { text, platform, engagement, source, url, timestamp, entities }.
"""
from urllib.parse import quote

from app.services import news, db


async def _news_items(terms: list[str], range: str) -> list:
    try:
        hits = await news.fetch_news(terms, range=range)
    except Exception:
        hits = []
    return [{"text": h.get("title", ""), "platform": "news", "engagement": 0,
             "source": h.get("source"), "url": h.get("link"), "timestamp": h.get("date"),
             "entities": []} for h in hits]


async def _stored_mentions(scope_name: str, limit: int = 400) -> list:
    """Best-effort: stored X/social mentions whose text matches the scope."""
    try:
        if not db.enabled() or not scope_name:
            return []
        pat = quote(f"*{scope_name}*")
        rows = await db.select(
            "mentions",
            f"select=text,platform,engagement,author,url,created_at&text=ilike.{pat}&order=created_at.desc&limit={limit}")
        out = []
        for r in rows or []:
            out.append({"text": r.get("text", ""), "platform": (r.get("platform") or "x").lower(),
                        "engagement": int(r.get("engagement") or 0), "source": r.get("author"),
                        "url": r.get("url"), "timestamp": r.get("created_at"), "entities": []})
        return out
    except Exception:
        return []


async def load(scope_type: str, scope_id: str, scope_name: str, period: str = "week") -> list:
    terms = [t for t in [scope_name, scope_id] if t and not str(t).startswith("personal-")]
    if scope_type == "country" and not terms:
        terms = ["العراق"]
    items = []
    items += await _news_items(terms or ["العراق"], period)
    items += await _stored_mentions(scope_name)
    return items
