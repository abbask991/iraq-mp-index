"""Extra content sources merged into news monitoring:
  • GDELT DOC 2.0 API  (global news, free, no key)
  • Direct RSS feeds    (pan-Arab outlets covering Iraq)
  • Telegram            (public channel web previews)
Google News RSS is already handled by services/news.py.
"""
import asyncio
import re
from urllib.parse import quote, urlparse

import httpx

# range → GDELT timespan
_GDELT_SPAN = {"day": "1d", "week": "7d", "month": "1m", "year": "12m"}

# verified working RSS feeds (pan-Arab + Iraqi covering Iraq)
RSS_FEEDS = [
    "https://arabic.rt.com/rss/",
    "https://www.france24.com/ar/rss",
    "https://www.skynewsarabia.com/rss.xml",
    "https://www.alaraby.co.uk/rss",
    "https://aljazeera.net/aljazeerarss",
    "https://www.almadapaper.net/rss",
]

# verified public Iraqi/Arab Telegram news channels (web preview)
TG_CHANNELS = ["almaalomah", "baghdadtoday", "almadanews", "rudawarabic", "alghadeertv", "noonpost"]


def _pick(block: str, tag: str) -> str:
    m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", block, re.S)
    if not m:
        return ""
    return re.sub(r"<!\[CDATA\[|\]\]>", "", m.group(1)).replace("&amp;", "&").strip()


def _rss_date(block: str) -> str:
    import datetime
    d = _pick(block, "pubDate")
    for fmt in ("%a, %d %b %Y %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.datetime.strptime(d[:25].strip().rstrip("Z"), fmt).strftime("%Y-%m-%d")
        except Exception:
            continue
    return ""


async def _gdelt(client, keyword, rng):
    span = _GDELT_SPAN.get(rng or "week", "7d")
    url = (f"https://api.gdeltproject.org/api/v2/doc/doc?query={quote(keyword + ' sourcelang:arabic')}"
           f"&mode=artlist&format=json&maxrecords=40&sort=datedesc&timespan={span}")
    try:
        r = await client.get(url, timeout=12, headers={"User-Agent": "Mozilla/5.0"})
        arts = r.json().get("articles", [])
    except Exception:
        return []
    out = []
    for a in arts:
        d = a.get("seendate", "")
        date = f"{d[0:4]}-{d[4:6]}-{d[6:8]}" if len(d) >= 8 else ""
        out.append({"title": a.get("title"), "link": a.get("url"),
                    "source": a.get("domain", "GDELT"), "date": date, "src_type": "GDELT"})
    return out


async def _rss_one(client, url, keyword):
    try:
        xml = (await client.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})).text
    except Exception:
        return []
    host = urlparse(url).netloc.replace("www.", "")
    out = []
    for b in re.findall(r"<item>(.*?)</item>", xml, re.S)[:40]:
        title = _pick(b, "title")
        if keyword in title:
            out.append({"title": title, "link": _pick(b, "link"),
                        "source": host, "date": _rss_date(b), "src_type": "RSS"})
    return out


async def _tg_one(client, ch, keyword):
    try:
        html = (await client.get(f"https://t.me/s/{ch}", timeout=8, headers={"User-Agent": "Mozilla/5.0"})).text
    except Exception:
        return []
    out = []
    for m in re.findall(r'tgme_widget_message_text[^>]*>(.*?)</div>', html, re.S)[:30]:
        text = re.sub(r"<[^>]+>", " ", m)
        text = re.sub(r"\s+", " ", text).strip()
        if keyword in text and len(text) > 12:
            out.append({"title": text[:200], "link": f"https://t.me/{ch}",
                        "source": f"تيليغرام/{ch}", "date": "", "src_type": "Telegram"})
    return out


async def fetch_extra(keyword: str, rng: str = "week") -> list[dict]:
    """GDELT + direct RSS + Telegram for one keyword, merged & deduped."""
    async with httpx.AsyncClient(follow_redirects=True) as client:
        jobs = [_gdelt(client, keyword, rng)]
        jobs += [_rss_one(client, u, keyword) for u in RSS_FEEDS]
        jobs += [_tg_one(client, c, keyword) for c in TG_CHANNELS]
        batches = await asyncio.gather(*jobs)
    hits, seen = [], set()
    for b in batches:
        for h in b:
            if h.get("link") and h.get("title") and h["link"] not in seen:
                seen.add(h["link"])
                hits.append(h)
    return hits
