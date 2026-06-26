"""Apify provider — cross-platform social collection via Apify Actors.

Same base contract as the Bright Data provider, so it's a drop-in alternative:
set SOCIAL_PROVIDER=apify + APIFY_TOKEN. Each platform maps to a popular public
Actor (data-driven ACTOR_MAP, easy to swap). Async run pattern: start() kicks an
actor run → poll() checks status and fetches the dataset → normalize.
"""
import asyncio
import os
import re

import httpx

from app.services.social_providers import base

NAME = "apify"
SUPPORTED = ["instagram", "tiktok", "facebook", "youtube", "reddit"]
_API = "https://api.apify.com/v2"
_HASH = re.compile(r"#[\w؀-ۿ_]+")

# platform -> {actor, url(link,n), search(keyword,n)|None}. `search` lets a
# platform be monitored by TOPIC like X (no link needed); None = link-only.
ACTOR_MAP = {
    "instagram": {"actor": "apify~instagram-scraper",
                  "url": lambda u, n: {"directUrls": [u], "resultsType": "posts", "resultsLimit": n},
                  "search": lambda kw, n: {"search": kw, "searchType": "hashtag",
                                           "resultsType": "posts", "resultsLimit": n}},
    "tiktok":    {"actor": "clockworks~tiktok-scraper",
                  "url": lambda u, n: {"profiles": [u], "resultsPerPage": n,
                                       "shouldDownloadVideos": False, "shouldDownloadCovers": False},
                  "search": lambda kw, n: {"searchQueries": [kw], "resultsPerPage": n,
                                           "shouldDownloadVideos": False, "shouldDownloadCovers": False}},
    "facebook":  {"actor": "apify~facebook-posts-scraper",
                  "url": lambda u, n: {"startUrls": [{"url": u}], "resultsLimit": n},
                  "search": None},                         # FB blocks keyword search → link-only
    "youtube":   {"actor": "streamers~youtube-scraper",
                  "url": lambda u, n: {"startUrls": [{"url": u}], "maxResults": n},
                  "search": lambda kw, n: {"searchQueries": [kw], "maxResults": n}},
    "reddit":    {"actor": "trudax~reddit-scraper-lite",
                  "url": lambda u, n: {"startUrls": [{"url": u}], "maxItems": n},
                  "search": lambda kw, n: {"searches": [kw], "maxItems": n, "type": "posts"}},
}

# platforms that can be monitored by keyword (like X)
SEARCHABLE = [p for p, c in ACTOR_MAP.items() if c.get("search")]


def enabled() -> bool:
    return bool(os.getenv("APIFY_TOKEN"))


def _tok():
    return os.getenv("APIFY_TOKEN")


def _first(d: dict, *keys, default=None):
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return default


def _author(platform, r):
    am = r.get("authorMeta") or r.get("author") or {}
    if isinstance(am, str):
        am = {"name": am}
    return base.profile(
        platform,
        username=_first(r, "ownerUsername", "username", "channelName")
        or _first(am, "name", "nickName", "userName"),
        name=_first(r, "ownerFullName", "fullName") or _first(am, "nickName", "name"),
        url=_first(r, "ownerUrl", "channelUrl"),
        followers=_first(am, "fans", "followers", default=0) or _first(r, "followers", default=0),
        verified=bool(_first(r, "verified", default=False) or _first(am, "verified", default=False)))


def _norm(platform, r: dict):
    text = _first(r, "caption", "text", "title", "description", "body", default="")
    return base.post(
        platform,
        id=_first(r, "id", "postId", "shortCode", "videoId"),
        url=_first(r, "url", "webVideoUrl", "postUrl", "link"),
        text=text, created_at=_first(r, "timestamp", "createTimeISO", "date", "createdAt"),
        author=_author(platform, r),
        likes=_first(r, "likesCount", "diggCount", "likes", "upVotes", "score", default=0),
        comments=_first(r, "commentsCount", "commentCount", "numberOfComments", default=0),
        shares=_first(r, "sharesCount", "shareCount", "reshareCount", default=0),
        views=_first(r, "videoViewCount", "playCount", "viewCount", "views", default=0),
        media_type=_first(r, "type", "mediaType"),
        hashtags=_first(r, "hashtags", default=None) or _HASH.findall(text))


async def start(platform: str, target: str, limit: int = 15, mode: str = "auto"):
    if platform not in ACTOR_MAP:
        return {"job_id": None, "error": f"unsupported platform {platform}"}
    cfg = ACTOR_MAP[platform]
    if mode == "search":
        if not cfg.get("search"):
            return {"job_id": None, "error": f"{platform} لا يدعم البحث بالكلمة — استخدم رابطاً"}
        payload = cfg["search"](target, max(1, limit))
    else:
        payload = cfg["url"](target, max(1, limit))
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{_API}/acts/{cfg['actor']}/runs?token={_tok()}", json=payload, timeout=30)
    if r.status_code not in (200, 201):
        return {"job_id": None, "error": f"run {r.status_code}: {r.text[:120]}"}
    data = r.json().get("data", {})
    rid = data.get("id")
    return {"job_id": rid, "dataset": data.get("defaultDatasetId"),
            "platform": platform, "mode": mode, "error": None if rid else "no run id"}


async def poll(job_id: str, platform: str, mode: str = "auto"):
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{_API}/actor-runs/{job_id}?token={_tok()}", timeout=20)
        if r.status_code != 200:
            return {"status": "failed", "posts": [], "profile": None, "error": f"status {r.status_code}"}
        data = r.json().get("data", {})
        st = data.get("status")
        if st in ("READY", "RUNNING"):
            return {"status": "collecting", "posts": [], "profile": None, "error": None}
        if st not in ("SUCCEEDED",):
            return {"status": "failed", "posts": [], "profile": None, "error": f"run {st}"}
        ds = data.get("defaultDatasetId")
        d = await c.get(f"{_API}/datasets/{ds}/items?token={_tok()}&clean=true&limit=50", timeout=40)
    items = d.json() if d.status_code == 200 and isinstance(d.json(), list) else []
    return {"status": "ready", "posts": [_norm(platform, it) for it in items if isinstance(it, dict)],
            "profile": None, "error": None}


async def collect(platform: str, target: str, limit: int = 15, mode: str = "auto"):
    s = await start(platform, target, limit=limit, mode=mode)
    if not s.get("job_id"):
        return {"posts": [], "profile": None, "error": s.get("error")}
    import time as _t
    deadline = _t.time() + 90
    while _t.time() < deadline:
        r = await poll(s["job_id"], platform, mode)
        if r["status"] != "collecting":
            return {"posts": r["posts"], "profile": r["profile"], "error": r["error"]}
        await asyncio.sleep(6)
    return {"posts": [], "profile": None, "error": "collecting", "job_id": s["job_id"]}
