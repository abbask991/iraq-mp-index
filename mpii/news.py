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
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

MENTION_COLUMNS = ["mp_id", "date", "source", "title", "link"]

# --- rough Arabic keyword classifier (prototype; an LLM pass would do better) --
_NEG = ["استهداف", "اغتيال", "مسير", "فساد", "اتهام", "تحقيق", "إقالة", "فضيحة",
        "احتجاج", "غضب", "سجن", "توقيف", "قضية", "أزمة", "انتقاد", "تزوير", "رشوة",
        "هجوم", "تهديد", "استجواب", "مقتل", "انسحاب", "عقوبات", "تجميد", "خلاف"]
_POS = ["إنجاز", "تكريم", "افتتاح", "توقيع", "دعم", "تأييد", "نجاح", "مبادرة",
        "إطلاق", "تطوير", "اتفاق", "تعاون", "تهنئة", "فوز", "خدمة"]
_TYPES = [
    ("أمني/حادث", ["استهداف", "اغتيال", "مسير", "هجوم", "تفجير", "مقتل", "قصف", "تهديد"]),
    ("فساد/قضاء", ["فساد", "اتهام", "تحقيق", "قضية", "رشوة", "تزوير", "محكمة", "سجن", "توقيف"]),
    ("تشريعي", ["قانون", "تشريع", "تصويت", "جلسة", "قراءة", "تعديل", "مشروع"]),
    ("رقابي", ["استجواب", "رقابة", "مساءلة", "سؤال"]),
    ("دبلوماسي/زيارة", ["زيارة", "استقبال", "وفد", "لقاء", "سفير", "خارجية", "اتفاق"]),
    ("تصريح", ["يؤكد", "يصرح", "يدعو", "يطالب", "يدين", "بيان", "تصريح", "يعلن"]),
]


def classify(title: str) -> dict:
    t = title or ""
    typ = next((label for label, kws in _TYPES if any(k in t for k in kws)), "عام")
    if any(k in t for k in _NEG):
        sent = "سلبي"
    elif any(k in t for k in _POS):
        sent = "إيجابي"
    else:
        sent = "محايد"
    return {"type": typ, "sentiment": sent}


def _ctx():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl._create_unverified_context()


def short_name(full: str) -> str:
    """Given + father (first two tokens) — the most common 'known name' form for
    Iraqi MPs (e.g. 'عالية نصيف جاسم عزيز' -> 'عالية نصيف'). Tribal-known figures
    (e.g. 'هيبت الحلبوسي') need a manual `search_name` override in members.csv."""
    parts = [p for p in str(full).split() if p]
    if len(parts) <= 2:
        return full
    return f"{parts[0]} {parts[1]}"


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
        members = {int(r["member_id"]): (r["name"], (r.get("search_name") or "").strip())
                   for r in csv.DictReader(f)}

    existing = []
    if os.path.exists(out_csv):
        with open(out_csv, encoding="utf-8") as f:
            existing = [r for r in csv.DictReader(f) if int(r["mp_id"]) not in set(ids)]

    ctx, fetched, counts = _ctx(), [], {}
    for mid in ids:
        rec = members.get(mid)
        if not rec:
            continue
        name, search = rec
        query = search if search else short_name(name)
        try:
            rows = fetch_mentions(query, per_mp, ctx)
        except Exception:
            rows = []  # one failure (rate-limit/timeout) shouldn't kill the run
        counts[mid] = len(rows)
        for r in rows:
            fetched.append({"mp_id": mid, "date": r["date"], "source": r["source"],
                            "title": r["title"], "link": r["link"]})
        time.sleep(0.4)  # be polite to Google News

    os.makedirs(os.path.dirname(out_csv) or ".", exist_ok=True)
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=MENTION_COLUMNS)
        w.writeheader()
        w.writerows(existing + fetched)
    return counts
