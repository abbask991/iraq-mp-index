"""Additional public data sources (#11), normalized to the standard hit shape:
  {term, title, link, source, date, src_type, hashtags, engagement}

- Reddit: public search JSON (no key needed; just a User-Agent).
- Government / official RSS: Iraqi news agency + official feeds (best-effort;
  feeds that fail are skipped).

TikTok / Facebook / Instagram are intentionally NOT here — they require paid or
authenticated access and block scraping; add them later behind real credentials.
"""
import re
from datetime import datetime, timezone

import httpx

_UA = {"User-Agent": "Mozilla/5.0 (RasdIntel/1.0)"}

# official / government-leaning Iraqi RSS (best-effort; non-working ones skipped)
GOV_FEEDS = [
    ("INA - الوكالة الوطنية", "https://ina.iq/rss.xml"),
    ("INA Sections", "https://www.ina.iq/rss"),
    ("Iraqi Media House", "https://imn.iq/feed/"),
]

_ITEM = re.compile(r"<item>(.*?)</item>", re.S)


def _unesc(s):
    for a, b in (("<![CDATA[", ""), ("]]>", ""), ("&lt;", "<"), ("&gt;", ">"),
                 ("&quot;", '"'), ("&#39;", "'"), ("&amp;", "&")):
        s = s.replace(a, b)
    return s.strip()


def _pick(block, tag):
    m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", block, re.S)
    return _unesc(m.group(1)) if m else ""


async def fetch_reddit(query: str, limit: int = 25):
    url = "https://www.reddit.com/search.json"
    params = {"q": query, "limit": limit, "sort": "new", "type": "link"}
    try:
        async with httpx.AsyncClient(follow_redirects=True) as c:
            r = await c.get(url, params=params, headers=_UA, timeout=8)
            data = r.json()
    except Exception:
        return []
    out = []
    for ch in data.get("data", {}).get("children", []):
        d = ch.get("data", {})
        title = d.get("title") or ""
        if not title:
            continue
        try:
            date = datetime.fromtimestamp(d.get("created_utc", 0), timezone.utc).strftime("%Y-%m-%d")
        except Exception:
            date = ""
        out.append({
            "term": query, "title": title,
            "link": "https://reddit.com" + d.get("permalink", ""),
            "source": "r/" + (d.get("subreddit") or "reddit"), "date": date,
            "src_type": "Reddit", "platform": "reddit", "hashtags": [],
            "engagement": int(d.get("ups", 0) or 0) + int(d.get("num_comments", 0) or 0),
            "author": d.get("author"),
        })
    return out


async def _fetch_feed(name, url):
    try:
        async with httpx.AsyncClient(follow_redirects=True) as c:
            r = await c.get(url, headers=_UA, timeout=6)
            xml = r.text
    except Exception:
        return []
    out = []
    for block in _ITEM.findall(xml)[:15]:
        title = _pick(block, "title")
        link = _pick(block, "link")
        if not (title and link):
            continue
        date = _pick(block, "pubDate")
        try:
            iso = datetime.strptime(date[:25].strip(), "%a, %d %b %Y %H:%M:%S").strftime("%Y-%m-%d") if date else ""
        except Exception:
            iso = ""
        out.append({"term": "", "title": title, "link": link, "source": name,
                    "date": iso, "src_type": "Government", "platform": "news",
                    "hashtags": [], "engagement": 0})
    return out


async def fetch_gov():
    import asyncio
    results = await asyncio.gather(*(_fetch_feed(n, u) for n, u in GOV_FEEDS))
    return [h for batch in results for h in batch]


async def fetch_social(query: str):
    """Reddit + government feeds combined (each degrades to [] on failure)."""
    import asyncio
    reddit, gov = await asyncio.gather(fetch_reddit(query), fetch_gov())
    for h in gov:
        h["term"] = query
    return reddit + gov
