"""TwitterAPI.io provider — drop-in alternative to the official X fetch.

Maps TwitterAPI.io's advanced-search response into the SAME shape our pipeline
expects from x.fetch_trend: {"tweets":[{text,author_id,created_at,engagement,
domains,hashtags,mentions,links}], "users":{id:{username,name,verified,location,
description,created_at,public_metrics:{followers_count,...}}}}.

Advantages over official X Basic: full archive (since_time/until_time), richer
metrics (views, bookmarks), pay-per-use, no 7-day cap. Key via env
TWITTERAPI_IO_KEY (never hard-coded).
"""
import os
import time
from email.utils import parsedate_to_datetime
from urllib.parse import quote

import httpx

_BASE = "https://api.twitterapi.io/twitter/tweet/advanced_search"
_RANGE_SECONDS = {"day": 86400, "week": 7 * 86400, "month": 30 * 86400}
_TIME_BUDGET = 150  # max seconds spent paginating one fetch (20/page is sequential)


def enabled() -> bool:
    """Use TwitterAPI.io when its key is set, unless explicitly forced to official."""
    return bool(os.getenv("TWITTERAPI_IO_KEY")) and os.getenv("X_PROVIDER", "twitterapi_io") != "official"


def _iso(created_at: str) -> str:
    """Twitter format 'Thu Jun 25 21:50:14 +0000 2026' -> ISO for our parsers."""
    try:
        return parsedate_to_datetime(created_at).isoformat()
    except Exception:
        return created_at or ""


def _entities(t: dict):
    ent = t.get("entities") or {}
    hashtags = [h.get("text") or h.get("tag") for h in (ent.get("hashtags") or []) if (h.get("text") or h.get("tag"))]
    mentions = [m.get("screen_name") or m.get("username") for m in (ent.get("user_mentions") or ent.get("mentions") or [])
                if (m.get("screen_name") or m.get("username"))]
    links, domains = [], []
    for u_ in (ent.get("urls") or []):
        exp = u_.get("expanded_url") or u_.get("url")
        if exp:
            links.append(exp)
        disp = (u_.get("display_url") or exp or "")
        dom = disp.split("/")[0].replace("www.", "").lower()
        if dom and "twitter.com" not in dom and "x.com" not in dom and "t.co" not in dom:
            domains.append(dom)
    return hashtags, mentions, links, domains


def _user(a: dict) -> dict:
    return {
        "id": a.get("id"), "username": a.get("userName"), "name": a.get("name"),
        "verified": bool(a.get("isBlueVerified") or a.get("isVerified")),
        "verifiedType": a.get("verifiedType"),
        "description": a.get("description") or "",
        "location": a.get("location") or "",
        "created_at": _iso(a.get("createdAt", "")),
        "public_metrics": {
            "followers_count": a.get("followers", 0) or 0,
            "following_count": a.get("following", 0) or 0,
            "tweet_count": a.get("statusesCount", 0) or 0,
            "listed_count": 0,
        },
        "profile_image_url": a.get("profilePicture"),
    }


async def fetch_trend(keyword: str, want: int = 150, range: str = "week") -> dict:
    key = os.getenv("TWITTERAPI_IO_KEY")
    if not key:
        return {"error": "TWITTERAPI_IO_KEY_MISSING"}
    since = int(time.time()) - _RANGE_SECONDS.get(range or "week", _RANGE_SECONDS["week"])
    query = f"{keyword} since_time:{since}"
    tweets, users = [], {}
    cursor = ""
    headers = {"X-API-Key": key}
    # advanced_search returns ~20/page via sequential cursor, so high coverage is
    # paginated. Bound it by a wall-clock budget so a huge `want` can't hang.
    deadline = time.time() + _TIME_BUDGET
    max_pages = min(1200, want // 20 + 3)
    pages = 0
    async with httpx.AsyncClient() as client:
        while len(tweets) < want and pages < max_pages and time.time() < deadline:
            pages += 1
            url = f"{_BASE}?query={quote(query)}&queryType=Latest"
            if cursor:
                url += f"&cursor={quote(cursor)}"
            r = await client.get(url, headers=headers, timeout=30)
            if r.status_code != 200:
                if tweets:
                    break
                return {"error": r.status_code}
            j = r.json()
            for t in (j.get("tweets") or []):
                if t.get("type") == "retweet" or t.get("retweeted_tweet"):
                    continue                       # exclude retweets (parity with official)
                a = t.get("author") or {}
                aid = a.get("id")
                if aid and aid not in users:
                    users[aid] = _user(a)
                hashtags, mentions, links, domains = _entities(t)
                tweets.append({
                    "text": t.get("text", ""), "author_id": aid, "created_at": _iso(t.get("createdAt", "")),
                    "engagement": (t.get("likeCount", 0) or 0) + (t.get("retweetCount", 0) or 0)
                    + (t.get("replyCount", 0) or 0) + (t.get("quoteCount", 0) or 0),
                    "views": t.get("viewCount", 0) or 0,
                    "domains": domains, "hashtags": hashtags, "mentions": mentions, "links": links,
                })
                if len(tweets) >= want:
                    break
            if len(tweets) >= want or not j.get("has_next_page"):
                break
            cursor = j.get("next_cursor") or ""
            if not cursor:
                break
    return {"tweets": tweets[:want], "users": users}
