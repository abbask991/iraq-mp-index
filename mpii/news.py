"""News-mention pipeline (prototype): fetch Google News RSS per MP and store
mentions for DISPLAY ONLY. These do NOT feed the ranking score.

Name matching is intentionally simple (first + last token) — real deployment
needs disambiguation + human review (see the README / data caveats).
"""

from __future__ import annotations

import csv
import datetime
import os
import ssl
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

MENTION_COLUMNS = ["mp_id", "date", "source", "title", "link"]


def _ctx():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl._create_unverified_context()


def short_name(full: str) -> str:
    """First + last token — the common form news outlets use (e.g.
    'هيبت حمد عباس عبدالجبار الحلبوسي' -> 'هيبت الحلبوسي')."""
    parts = [p for p in str(full).split() if p]
    if len(parts) <= 2:
        return full
    return f"{parts[0]} {parts[-1]}"


def fetch_mentions(name: str, max_items: int = 6, ctx=None) -> list:
    ctx = ctx or _ctx()
    q = urllib.parse.quote(f'"{name}"')
    url = f"https://news.google.com/rss/search?q={q}&hl=ar&gl=IQ&ceid=IQ:ar"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    raw = urllib.request.urlopen(req, timeout=25, context=ctx).read()
    out = []
    for it in ET.fromstring(raw).findall(".//item")[:max_items]:
        src_el = it.find("{*}source")
        date = (it.findtext("pubDate") or "").strip()
        try:
            date = datetime.datetime.strptime(date[:25].strip(), "%a, %d %b %Y %H:%M:%S").strftime("%Y-%m-%d")
        except Exception:
            date = date[:16]
        out.append({
            "title": (it.findtext("title") or "").strip(),
            "source": src_el.text if src_el is not None else "",
            "link": (it.findtext("link") or "").strip(),
            "date": date,
        })
    return out


def update_mentions(members_csv: str, out_csv: str, ids: list, per_mp: int = 6) -> dict:
    """Fetch mentions for the given member ids and merge into out_csv.
    Returns {mp_id: count} for what was fetched."""
    with open(members_csv, encoding="utf-8") as f:
        members = {int(r["member_id"]): r["name"] for r in csv.DictReader(f)}

    existing = []
    if os.path.exists(out_csv):
        with open(out_csv, encoding="utf-8") as f:
            existing = [r for r in csv.DictReader(f) if int(r["mp_id"]) not in set(ids)]

    ctx, fetched, counts = _ctx(), [], {}
    for mid in ids:
        name = members.get(mid)
        if not name:
            continue
        rows = fetch_mentions(short_name(name), per_mp, ctx)
        counts[mid] = len(rows)
        for r in rows:
            fetched.append({"mp_id": mid, "date": r["date"], "source": r["source"],
                            "title": r["title"], "link": r["link"]})

    os.makedirs(os.path.dirname(out_csv) or ".", exist_ok=True)
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=MENTION_COLUMNS)
        w.writeheader()
        w.writerows(existing + fetched)
    return counts
