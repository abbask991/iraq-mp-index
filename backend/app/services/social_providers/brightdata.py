"""Bright Data provider — cross-platform social collection via the Datasets API
(trigger → poll → download). Implements the base contract so it's swappable.

Per-platform dataset IDs + collection mode live in DATASET_MAP (data-driven), so
tuning a platform = editing one row, not the code. Token via env BRIGHTDATA_TOKEN
(never sent to the browser). Output is mapped into base.post/base.profile with
DEFENSIVE field lookups, because Bright Data field names vary across datasets.
"""
import asyncio
import os
import re

import httpx

from app.services.social_providers import base

NAME = "brightdata"
SUPPORTED = ["instagram", "tiktok", "facebook", "youtube", "reddit", "x"]
_API = "https://api.brightdata.com/datasets/v3"
_HASH = re.compile(r"#[\w؀-ۿ_]+")

# platform -> {profile: dataset, posts: dataset, discover_by: param|None}
# discover_by set => posts are collected in discover mode from a profile/channel URL.
DATASET_MAP = {
    "instagram": {"profile": "gd_l1vikfch901nx3by4", "posts": "gd_lk5ns7kz21pck8jpis", "discover_by": "url"},
    "tiktok":    {"profile": "gd_l1villgoiiidt09ci", "posts": "gd_lu702nij2f790tmv9h", "discover_by": "url"},
    "facebook":  {"profile": "gd_mf0urb782734ik94dz", "posts": "gd_lkaxegm826bjpoo9m5", "discover_by": None},
    "youtube":   {"profile": "gd_lk538t2k2p1k3oos71", "posts": "gd_lk56epmy2i5g7lzu0k", "discover_by": "url"},
    "reddit":    {"profile": None,                     "posts": "gd_lvz8ah06191smkebj4", "discover_by": None},
    "x":         {"profile": "gd_lwxmeb2u1cniijd7t4", "posts": "gd_lwxkxvnf1cynvib9co", "discover_by": None},
}


def enabled() -> bool:
    return bool(os.getenv("BRIGHTDATA_TOKEN"))


def _headers():
    return {"Authorization": f"Bearer {os.getenv('BRIGHTDATA_TOKEN')}", "Content-Type": "application/json"}


def _first(d: dict, *keys, default=None):
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return default


def _norm_post(platform, r: dict):
    text = _first(r, "description", "caption", "post_text", "content", "title", "text", default="")
    author = base.profile(
        platform,
        username=_first(r, "user_posted", "account", "profile_name", "username", "channel_name", "author"),
        name=_first(r, "user_full_name", "full_name", "name"),
        url=_first(r, "profile_url", "user_url", "channel_url"),
        followers=_first(r, "followers", "followers_count", "subscribers", default=0),
        verified=bool(_first(r, "is_verified", "verified", default=False)))
    return base.post(
        platform,
        id=_first(r, "post_id", "id", "shortcode", "video_id"),
        url=_first(r, "url", "post_url", "link", "video_url"),
        text=text,
        created_at=_first(r, "date_posted", "timestamp", "created_time", "date", "upload_date"),
        author=author,
        likes=_first(r, "likes", "likes_count", "num_likes", "digg_count", default=0),
        comments=_first(r, "num_comments", "comments", "comments_count", default=0),
        shares=_first(r, "num_shares", "shares", "reshares", "share_count", default=0),
        views=_first(r, "views", "video_view_count", "play_count", "view_count", default=0),
        media_type=_first(r, "content_type", "type", "media_type"),
        hashtags=_first(r, "hashtags", default=None) or _HASH.findall(text))


def _norm_profile(platform, r: dict):
    return base.profile(
        platform,
        username=_first(r, "account", "username", "profile_name", "channel_name"),
        name=_first(r, "full_name", "name", "channel_name"),
        url=_first(r, "profile_url", "url", "channel_url"),
        followers=_first(r, "followers", "followers_count", "subscribers", default=0),
        verified=bool(_first(r, "is_verified", "verified", default=False)),
        bio=_first(r, "biography", "bio", "description", default=""),
        posts_count=_first(r, "posts_count", "post_count", "videos_count", default=0),
        image=_first(r, "profile_image_link", "profile_image", "avatar"))


async def start(platform: str, target: str, limit: int = 15, mode: str = "auto"):
    """Trigger a collection; return {job_id, platform, mode, error}. Async by
    nature — Bright Data collections take minutes, so we return immediately and
    let the caller poll()."""
    if platform not in DATASET_MAP:
        return {"job_id": None, "error": f"unsupported platform {platform}"}
    cfg = DATASET_MAP[platform]
    ds = cfg.get("profile") if mode == "profile" else cfg.get("posts")
    if not ds:
        return {"job_id": None, "error": f"no dataset for {platform}/{mode}"}
    discover_by = None if mode == "profile" else cfg.get("discover_by")
    n = 1 if mode == "profile" else max(1, limit)
    url = f"{_API}/trigger?dataset_id={ds}&include_errors=true&limit_per_input={n}"
    if discover_by:
        url += f"&type=discover_new&discover_by={discover_by}"
    async with httpx.AsyncClient() as c:
        t = await c.post(url, headers=_headers(), json=[{"url": target}], timeout=30)
    if t.status_code not in (200, 201):
        return {"job_id": None, "error": f"trigger {t.status_code}: {t.text[:120]}"}
    snap = t.json().get("snapshot_id")
    return {"job_id": snap, "platform": platform, "mode": mode, "error": None if snap else "no snapshot_id"}


async def poll(job_id: str, platform: str, mode: str = "auto"):
    """Check a job; return {status: collecting|ready|failed, posts, profile, error}."""
    async with httpx.AsyncClient() as c:
        p = await c.get(f"{_API}/progress/{job_id}", headers=_headers(), timeout=20)
        status = (p.json() or {}).get("status") if p.status_code == 200 else None
        if status in ("running", "starting", "building", "collecting", "queued", None):
            return {"status": "collecting", "posts": [], "profile": None, "error": None}
        if status in ("failed", "error"):
            return {"status": "failed", "posts": [], "profile": None, "error": f"snapshot {status}"}
        d = await c.get(f"{_API}/snapshot/{job_id}?format=json", headers=_headers(), timeout=40)
    if d.status_code != 200:
        return {"status": "failed", "posts": [], "profile": None, "error": f"download {d.status_code}"}
    recs = d.json()
    recs = [r for r in (recs if isinstance(recs, list) else recs.get("data", []))
            if isinstance(r, dict) and "error" not in r]
    if mode == "profile":
        return {"status": "ready", "posts": [], "profile": _norm_profile(platform, recs[0]) if recs else None, "error": None}
    return {"status": "ready", "posts": [_norm_post(platform, r) for r in recs], "profile": None, "error": None}


async def collect(platform: str, target: str, limit: int = 15, mode: str = "auto"):
    """Convenience: start + short poll (best-effort; may return status=collecting)."""
    s = await start(platform, target, limit=limit, mode=mode)
    if not s.get("job_id"):
        return {"posts": [], "profile": None, "error": s.get("error")}
    import time as _t
    deadline = _t.time() + 75
    while _t.time() < deadline:
        r = await poll(s["job_id"], platform, mode)
        if r["status"] != "collecting":
            return {"posts": r["posts"], "profile": r["profile"], "error": r["error"]}
        await asyncio.sleep(6)
    return {"posts": [], "profile": None, "error": "collecting", "job_id": s["job_id"]}
