"""Telegram collector (Phase 1) — public channels via the t.me/s preview.

No auth, no new dependency: fetches a public channel's web preview and parses the
message blocks into the standard normalized hit shape used by every other source
(x, news, reddit), so store.store_mentions persists them into `mentions` with real
timestamps. That timestamp is what lets Telegram join the cross-platform picture
(platform_activity, evidence, and the narrative-ownership map).

Public channels only (those with web preview enabled). For private/real-time/full
history, graduate to the Telethon (MTProto) collector on the worker.
"""
import re
from datetime import datetime, timezone

import httpx

_UA = {"User-Agent": "Mozilla/5.0 (RasdIntel/1.0; +https://rasd-monitor.vercel.app)"}
_TXT = re.compile(r'tgme_widget_message_text[^>]*>(.*?)</div>', re.S)
_TIME = re.compile(r'<time[^>]*datetime="([^"]+)"')
_VIEWS = re.compile(r'tgme_widget_message_views[^>]*>([\d.,KMkm]+)')


def _clean(h: str) -> str:
    h = re.sub(r"<br\s*/?>", "\n", h)
    h = re.sub(r"<[^>]+>", "", h)
    for a, b in (("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'"), ("&nbsp;", " ")):
        h = h.replace(a, b)
    return h.strip()


def _norm_channel(ch: str) -> str:
    return (ch or "").strip().replace("https://", "").replace("http://", "").replace("t.me/s/", "").replace("t.me/", "").replace("@", "").strip("/")


async def fetch_telegram(channels, per: int = 20) -> list[dict]:
    """Fetch recent posts from public channels → normalized hits."""
    out: list[dict] = []
    now = datetime.now(timezone.utc).isoformat()
    async with httpx.AsyncClient(follow_redirects=True) as c:
        for raw in channels:
            ch = _norm_channel(raw)
            if not ch:
                continue
            try:
                r = await c.get(f"https://t.me/s/{ch}", headers=_UA, timeout=12)
                if r.status_code != 200:
                    continue
                html = r.text
            except Exception:
                continue
            # each message block starts at a data-post attribute; split keeps them self-contained
            parts = html.split('data-post="')[1:]
            for part in parts[-per:]:
                post = part.split('"', 1)[0]
                tm = _TXT.search(part)
                if not tm:
                    continue
                text = _clean(tm.group(1))
                if not text:
                    continue
                tt = _TIME.search(part)
                date = tt.group(1) if tt else now
                vm = _VIEWS.search(part)
                out.append({
                    "platform": "telegram",
                    "external_id": post,                       # dedup key (platform, external_id)
                    "title": text[:120],
                    "text": text,
                    "link": f"https://t.me/{post}",
                    "source": ch,
                    "src_type": "Telegram",
                    "author": ch,
                    "date": date,
                    "hashtags": re.findall(r"#(\w+)", text),
                    "engagement": (vm.group(1) if vm else "0"),
                })
    return out
