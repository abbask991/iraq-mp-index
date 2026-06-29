"""Collector — scrape the monitored pages, normalize, annotate reactions, and
PERSIST to facebook_posts / facebook_comments so history accumulates.

Reuses the existing low-level scraper in facebook/__init__.py (Apify). Runs from
the scheduler (daily warm) and is safe to call ad-hoc. Best-effort storage: if
migration 011 isn't applied, scraping still works and nothing is lost upstream.
"""
import asyncio
from datetime import datetime, timezone

from app.services import facebook as fb
from app.services.facebook import normalizer, reaction_analyzer as rx, storage


async def collect_page(page_slug: str, limit: int = 12) -> dict:
    """Scrape one page → normalized+annotated post rows + inline comment rows.
    Returns {"posts": [...], "comments": [...], "page_name": str}."""
    res = await fb._scrape(fb.normalize_target(page_slug), limit)
    if res.get("error"):
        return {"posts": [], "comments": [], "page_name": page_slug, "error": res["error"]}
    posts, comments, page_name = [], [], page_slug
    for it in res.get("items", []):
        row = normalizer.normalize_post(it, page_slug)
        if not row:
            continue
        rx.annotate_post(row)
        page_name = row.get("page_name") or page_name
        posts.append(row)
        comments += normalizer.normalize_comments(it, row["post_id"], row.get("page_name"))
    return {"posts": posts, "comments": comments, "page_name": page_name}


async def collect_all(limit: int = 12) -> dict:
    """Collect every monitored page and persist. Returns a run summary."""
    pages = await fb.get_pages()
    sem = asyncio.Semaphore(4)

    async def _one(p):
        async with sem:
            return await collect_page(p, limit)

    results = await asyncio.gather(*(_one(p) for p in pages), return_exceptions=True)
    all_posts, all_comments, ok, failed = [], [], [], []
    for p, r in zip(pages, results):
        if isinstance(r, Exception) or r.get("error") or not r.get("posts"):
            failed.append(p)
            continue
        ok.append(r["page_name"])
        all_posts += r["posts"]
        all_comments += r["comments"]

    saved_posts = await storage.save_posts(all_posts)
    saved_comments = await storage.save_comments(all_comments)
    # touch the page registry so first_seen/last_collected/DNA can build later
    now_iso = datetime.now(timezone.utc).isoformat()
    for r in results:
        if not isinstance(r, Exception) and r.get("posts"):
            await storage.upsert_page(r["page_name"], {"last_collected": now_iso})
    return {
        "pages_ok": ok, "pages_failed": failed,
        "posts_collected": len(all_posts), "posts_saved": saved_posts,
        "comments_collected": len(all_comments), "comments_saved": saved_comments,
    }
