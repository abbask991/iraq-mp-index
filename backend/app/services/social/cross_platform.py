"""Cross-Platform Monitor — collect posts from monitored sources (Instagram /
TikTok / Facebook / YouTube / Reddit / X) via the active social provider, in one
normalized feed. Provider-agnostic: it only talks to social_providers.base.
"""
import asyncio

from app.services.social_providers import base


def status() -> dict:
    prov = base.get()
    searchable = set(getattr(prov, "SEARCHABLE", []))
    return {
        "provider": base.active_name(),
        "enabled": bool(prov and prov.enabled()),
        "platforms": [{"key": p, "ar": base.PLATFORM_AR.get(p, p),
                       "supported": bool(prov and p in getattr(prov, "SUPPORTED", [])),
                       "searchable": p in searchable}
                      for p in base.PLATFORMS],
        "searchable": sorted(searchable),
    }


async def enrich_entity(keyword: str, limit: int = 10):
    """Background: keyword-search every search-capable platform for `keyword`,
    wait for each, and store results tagged with the entity — so the unified
    picture progressively fills with all platforms (like X) without any links."""
    import asyncio
    import time

    from app.services.fusion import store
    prov = base.get()
    if not prov or not prov.enabled():
        return
    for p in getattr(prov, "SEARCHABLE", []):
        try:
            s = await prov.start(p, keyword, limit=limit, mode="search")
            jid = s.get("job_id")
            if not jid:
                continue
            deadline = time.time() + 200
            while time.time() < deadline:
                r = await prov.poll(jid, p, "search")
                if r.get("status") != "collecting":
                    if r.get("posts"):
                        await store.store_posts(r["posts"], keyword)
                    break
                await asyncio.sleep(8)
        except Exception:
            continue


async def discover(keyword: str, limit: int = 10) -> dict:
    """Keyword/topic monitoring across all search-capable platforms (like X) —
    fire each as a job and return the job handles for polling."""
    prov = base.get()
    if not prov or not prov.enabled():
        return {"jobs": [], "error": "provider not configured"}
    jobs = []
    for p in getattr(prov, "SEARCHABLE", []):
        s = await prov.start(p, keyword, limit=limit, mode="search")
        if s.get("job_id"):
            jobs.append({"platform": p, "job_id": s["job_id"]})
    return {"jobs": jobs, "keyword": keyword}


async def start_source(platform: str, url: str, limit: int = 15, mode: str = "auto") -> dict:
    prov = base.get()
    if not prov or not prov.enabled():
        return {"job_id": None, "error": "provider not configured"}
    if not url:
        return {"job_id": None, "error": "missing url"}
    return await prov.start(platform, url, limit=limit, mode=mode)


async def poll_source(job_id: str, platform: str, mode: str = "auto", entity: str | None = None) -> dict:
    prov = base.get()
    if not prov or not prov.enabled():
        return {"status": "failed", "error": "provider not configured", "posts": [], "profile": None}
    r = await prov.poll(job_id, platform, mode)
    # persist collected posts into the unified store so they feed the fusion picture
    if r.get("status") == "ready" and r.get("posts"):
        try:
            from app.services.fusion import store
            await store.store_posts(r["posts"], entity)
        except Exception:
            pass
    return r


async def collect_source(platform: str, url: str, limit: int = 15, mode: str = "auto") -> dict:
    prov = base.get()
    if not prov or not prov.enabled():
        return {"posts": [], "profile": None, "error": "provider not configured"}
    if not url:
        return {"posts": [], "profile": None, "error": "missing url"}
    return await prov.collect(platform, url, limit=limit, mode=mode)


async def monitor(sources: list[dict], limit: int = 10) -> dict:
    """sources = [{platform, url}]. Collect all concurrently → merged feed."""
    prov = base.get()
    if not prov or not prov.enabled():
        return {"posts": [], "error": "provider not configured", "sources": 0}

    async def _one(s):
        try:
            r = await prov.collect(s.get("platform"), s.get("url"), limit=limit)
            for p in r.get("posts", []):
                p["source_url"] = s.get("url")
            return r.get("posts", [])
        except Exception:
            return []

    results = await asyncio.gather(*(_one(s) for s in sources))
    posts = [p for sub in results for p in sub]
    # newest first when timestamps parse
    posts.sort(key=lambda p: str(p.get("created_at") or ""), reverse=True)
    return {"posts": posts, "sources": len(sources), "provider": base.active_name()}
