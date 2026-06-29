"""Facebook Intelligence Dashboard aggregation (spec §1).

Answers "what is happening on Facebook right now?" by combining:
  • STORED post metrics (facebook_posts) → totals, most-active/influential pages,
    viral posts, most positive/negative posts, reaction breakdown.
  • The existing NATIONAL snapshot insights → top topics / entities / narratives
    (already mined by facebook_insights — reused so the board isn't empty on day 1).

Degrades gracefully: if migration 011 isn't applied (no stored rows), it derives
the live picture from facebook.national() so the dashboard still renders.
"""
from collections import defaultdict

from app.services import facebook as fb
from app.services.facebook import reaction_analyzer as rx, storage


def _eng(p: dict) -> int:
    return int(p.get("reactions_total") or 0) + int(p.get("comments_count") or 0) + int(p.get("shares_count") or 0)


def _page_rollup(posts: list[dict]) -> list[dict]:
    by = defaultdict(lambda: {"posts": 0, "reactions": 0, "comments": 0, "shares": 0, "engagement": 0})
    for p in posts:
        b = by[p.get("page_name") or "—"]
        b["posts"] += 1
        b["reactions"] += int(p.get("reactions_total") or 0)
        b["comments"] += int(p.get("comments_count") or 0)
        b["shares"] += int(p.get("shares_count") or 0)
        b["engagement"] += _eng(p)
    rows = [{"page": k, **v, "avg_engagement": round(v["engagement"] / v["posts"]) if v["posts"] else 0}
            for k, v in by.items()]
    return rows


def _viral_card(p: dict) -> dict:
    return {
        "page": p.get("page_name"), "text": (p.get("post_text") or "")[:200],
        "created_at": p.get("created_at"), "url": p.get("post_url"),
        "reactions": int(p.get("reactions_total") or 0), "comments": int(p.get("comments_count") or 0),
        "shares": int(p.get("shares_count") or 0), "engagement": _eng(p),
        "mood_score": p.get("reaction_mood"), "dominant_emotion": p.get("dominant_emotion"),
        "sentiment": p.get("sentiment"), "narrative": p.get("narrative"),
        "related_entity": p.get("related_entity"), "risk_level": p.get("risk_level"),
    }


async def dashboard() -> dict:
    posts = await storage.recent_posts(limit=2000)
    cnt = await storage.counts()
    # the precomputed national snapshot (durable, fast) carries topics/entities + totals.
    # NEVER recompute national() here — it scrapes live and can take >2min.
    snap = {}
    try:
        snap = await fb.get_snapshot() or {}
    except Exception:
        snap = {}

    if not posts:
        # storage empty (migration not applied / first run) → use the durable snapshot
        ins = snap.get("insights") or {}
        return {
            "stored": False,
            "note": "لا تخزين بعد — لقطة حيّة من النبض الوطني. طبّق ترحيل 011 ليبدأ تراكم التاريخ (ترند/DNA/journey).",
            "totals": {"pages": snap.get("pages_ok", 0), "posts": 0, "comments": snap.get("comments_analyzed", 0),
                       "reactions": (snap.get("total_positive") or 0) + (snap.get("total_negative") or 0) or snap.get("total_engagement", 0)},
            "most_active_pages": [], "most_influential_pages": [],
            "viral_posts": [],
            "reaction_breakdown": None,
            "most_positive": [], "most_negative": [],
            "top_topics": ins.get("topics", [])[:7],
            "top_entities": ins.get("entities", [])[:8],
            "top_narratives": (ins.get("talking_points") or [])[:6],
            "fb_contribution": _contribution(snap),
            "national_approval": snap.get("approval"),
        }

    pages = sorted(_page_rollup(posts), key=lambda r: -r["engagement"])
    scored = [p for p in posts if p.get("reaction_mood") is not None]
    viral = sorted(posts, key=lambda p: -_eng(p))[:12]
    most_pos = sorted(scored, key=lambda p: (-(p["reaction_mood"]), -_eng(p)))[:6]
    most_neg = sorted(scored, key=lambda p: ((p["reaction_mood"]), -_eng(p)))[:6]

    # reuse the precomputed national insight for topics/entities (fast; never recompute live)
    ins = snap.get("insights") or {}

    return {
        "stored": True,
        "totals": {"pages": cnt["pages"] or len(pages), "posts": cnt["posts"] or len(posts),
                   "comments": cnt["comments"], "reactions": sum(p.get("reactions_total") or 0 for p in posts)},
        "most_active_pages": sorted(pages, key=lambda r: -r["posts"])[:8],
        "most_influential_pages": pages[:8],
        "viral_posts": [_viral_card(p) for p in viral],
        "reaction_breakdown": rx.breakdown(posts),
        "most_positive": [_viral_card(p) for p in most_pos],
        "most_negative": [_viral_card(p) for p in most_neg],
        "top_topics": ins.get("topics", [])[:7],
        "top_entities": ins.get("entities", [])[:8],
        "top_narratives": ins.get("talking_points", [])[:6],
        "fb_contribution": None,
        "disclaimer": "مؤشرات احتمالية آلية لمحتوى عام — تتطلّب مراجعة بشرية.",
    }


def _contribution(nat: dict) -> dict:
    """A simple 'what Facebook adds' readout for the dashboard footer."""
    if not nat:
        return {}
    return {
        "approval": nat.get("approval"),
        "reaction_vs_comment_gap": (
            (nat.get("reaction_approval") or 0) - (nat.get("comment_approval") or 0)
            if nat.get("comment_approval") is not None else None),
        "comments_analyzed": nat.get("comments_analyzed"),
    }
