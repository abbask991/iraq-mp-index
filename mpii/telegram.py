"""Telegram public-channel fetcher (prototype). Reads the login-free web preview
at https://t.me/s/<channel>. Posts are DISPLAY ONLY — they do not feed the score.

Only PUBLIC channels are accessible. Private channels / groups are not.
"""

from __future__ import annotations

import csv
import html
import os
import re
import ssl
import time
import urllib.request


def _ctx():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl._create_unverified_context()


def channel_handle(value: str) -> str:
    """Normalize a telegram column value to a bare channel handle.
    Accepts 'https://t.me/x', 't.me/s/x', '@x', or 'x'."""
    v = (value or "").strip()
    v = re.sub(r"^https?://", "", v)
    v = v.replace("t.me/s/", "").replace("t.me/", "")
    return v.lstrip("@/").split("/")[0].split("?")[0]


def _strip(htmltext: str) -> str:
    t = re.sub(r"<br\s*/?>", " ", htmltext)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def fetch_telegram(channel: str, max_posts: int = 6, ctx=None) -> list:
    ctx = ctx or _ctx()
    url = f"https://t.me/s/{channel}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    page = urllib.request.urlopen(req, timeout=25, context=ctx).read().decode("utf-8", "ignore")

    posts = []
    for block in re.split(r"tgme_widget_message_wrap", page)[1:]:
        m = re.search(r'js-message_text[^>]*>(.*?)</div>', block, re.S)
        if not m:
            continue
        text = _strip(m.group(1))
        if not text:
            continue
        dt = re.search(r'datetime="([^"]+)"', block)
        posts.append({"text": text[:300], "date": dt.group(1)[:10] if dt else ""})
    # t.me/s lists oldest→newest; return newest first
    return posts[-max_posts:][::-1]


TELEGRAM_COLUMNS = ["mp_id", "date", "channel", "text"]


def update_telegram(members_csv: str, out_csv: str, ids: list, per_mp: int = 6) -> dict:
    """Fetch posts for MPs that have a `telegram` channel set; merge into out_csv."""
    with open(members_csv, encoding="utf-8") as f:
        members = {int(r["member_id"]): (r.get("telegram") or "").strip()
                   for r in csv.DictReader(f)}

    existing = []
    if os.path.exists(out_csv):
        with open(out_csv, encoding="utf-8") as f:
            existing = [r for r in csv.DictReader(f) if int(r["mp_id"]) not in set(ids)]

    ctx, fetched, counts = _ctx(), [], {}
    for mid in ids:
        ch = channel_handle(members.get(mid, ""))
        if not ch:
            counts[mid] = 0
            continue
        try:
            posts = fetch_telegram(ch, per_mp, ctx)
        except Exception:
            posts = []
        counts[mid] = len(posts)
        for p in posts:
            fetched.append({"mp_id": mid, "date": p["date"], "channel": ch, "text": p["text"]})
        time.sleep(0.4)

    os.makedirs(os.path.dirname(out_csv) or ".", exist_ok=True)
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=TELEGRAM_COLUMNS)
        w.writeheader()
        w.writerows(existing + fetched)
    return counts
