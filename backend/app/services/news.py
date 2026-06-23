"""News service — per-source Google News RSS fetching (async/concurrent)."""
import asyncio
import re
from datetime import datetime
from urllib.parse import quote

import httpx

from app.sources import NEWS_SOURCES

_ITEM = re.compile(r"<item>(.*?)</item>", re.S)


def _unesc(s: str) -> str:
    for a, b in (("<![CDATA[", ""), ("]]>", ""), ("&lt;", "<"), ("&gt;", ">"),
                 ("&quot;", '"'), ("&#39;", "'"), ("&amp;", "&")):
        s = s.replace(a, b)
    return s.strip()


def _pick(block: str, tag: str) -> str:
    m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", block, re.S)
    return _unesc(m.group(1)) if m else ""


def _parse(xml: str, term: str, limit: int) -> list[dict]:
    out = []
    for block in _ITEM.findall(xml)[:limit]:
        date = _pick(block, "pubDate")
        try:
            iso = datetime.strptime(date[:25].strip(), "%a, %d %b %Y %H:%M:%S").strftime("%Y-%m-%d") if date else ""
        except Exception:
            iso = ""
        out.append({
            "term": term,
            "title": _pick(block, "title"),
            "link": _pick(block, "link"),
            "source": _pick(block, "source"),
            "date": iso,
        })
    return out


async def _fetch_one(client: httpx.AsyncClient, term: str, domain: str) -> list[dict]:
    q = quote(f'"{term}" site:{domain}')
    url = f"https://news.google.com/rss/search?q={q}&hl=ar&gl=IQ&ceid=IQ:ar"
    try:
        r = await client.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=6)
        return _parse(r.text, term, 12)
    except Exception:
        return []


async def fetch_news(keywords: list[str], per_source: int = 12, cap: int = 120) -> list[dict]:
    jobs = []
    async with httpx.AsyncClient(follow_redirects=True) as client:
        sem = asyncio.Semaphore(45)

        async def guarded(term, domain):
            async with sem:
                return await _fetch_one(client, term, domain)

        for k in keywords[:6]:
            for d in NEWS_SOURCES:
                jobs.append(guarded(k, d))
        batches = await asyncio.gather(*jobs)

    hits, seen = [], set()
    for b in batches:
        for h in b:
            if h["link"] and h["title"] and h["link"] not in seen:
                seen.add(h["link"])
                hits.append(h)
    hits.sort(key=lambda h: h.get("date", ""), reverse=True)
    return hits[:cap]
