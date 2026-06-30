"""Reverse image search — adapter-based, provider-agnostic (spec §6).

Tries configured providers in order (SerpAPI / TinEye / Bing). If NONE is configured
it returns a clear 'not configured' result instead of fabricating matches — the
report then states the limitation and lowers confidence. Add a key to activate.
"""
import os

import httpx


def _provider_keys() -> dict:
    return {"serpapi": os.getenv("SERPAPI_KEY"), "tineye": os.getenv("TINEYE_API_KEY"),
            "bing": os.getenv("BING_VISUAL_KEY")}


def configured() -> str | None:
    for name, key in _provider_keys().items():
        if key:
            return name
    return None


def _norm(items: list, provider: str) -> list:
    out = []
    for it in items[:20]:
        out.append({
            "matched_image_url": it.get("thumbnail") or it.get("image") or it.get("original"),
            "matched_page_url": it.get("link") or it.get("url"),
            "title": (it.get("title") or "")[:160],
            "source": it.get("source") or it.get("domain"),
            "first_seen_date": it.get("date"),
            "similarity_score": it.get("similarity"),
            "provider": provider,
        })
    return out


async def search(image_url: str | None = None, image_bytes: bytes | None = None) -> dict:
    prov = configured()
    if not prov:
        return {"configured": False, "provider": None, "results": [],
                "note": "لا مزوّد بحث عكسي مهيّأ — أضِف SERPAPI_KEY أو TINEYE_API_KEY أو BING_VISUAL_KEY لتفعيل البحث العكسي."}
    try:
        if prov == "serpapi" and image_url:
            async with httpx.AsyncClient() as c:
                r = await c.get("https://serpapi.com/search.json",
                                params={"engine": "google_reverse_image", "image_url": image_url,
                                        "api_key": _provider_keys()["serpapi"]}, timeout=40)
                data = r.json()
                items = data.get("image_results") or data.get("inline_images") or []
                return {"configured": True, "provider": "serpapi", "results": _norm(items, "serpapi")}
        # TinEye / Bing adapters: wire when keys provided (same _norm shape)
        return {"configured": True, "provider": prov, "results": [],
                "note": f"المزوّد {prov} مهيّأ لكن المحوّل قيد الإكمال."}
    except Exception as e:
        return {"configured": True, "provider": prov, "results": [], "error": str(e)[:100]}
