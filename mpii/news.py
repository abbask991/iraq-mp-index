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
WATCH_COLUMNS = ["term", "date", "source", "title", "link"]


def _supabase_env():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    if url and key:
        return url, key
    p = os.path.join("platform", ".env.local")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
                url = line.split("=", 1)[1].strip()
            elif line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
                key = line.split("=", 1)[1].strip()
    return url, key


def load_settings(path: str = "settings.yaml") -> dict:
    """Settings from settings.yaml, OVERLAID by the admin's Supabase settings
    (so changes in the admin panel drive the news pipeline)."""
    cfg = {}
    if os.path.exists(path):
        try:
            import yaml
            cfg = (yaml.safe_load(open(path, encoding="utf-8")) or {}).get("news", {}) or {}
        except Exception:
            cfg = {}
    url, key = _supabase_env()
    if url and key:
        try:
            import json as _json
            req = urllib.request.Request(
                f"{url}/rest/v1/app_settings?select=key,value",
                headers={"apikey": key, "Authorization": f"Bearer {key}", "User-Agent": "Mozilla/5.0"})
            data = _json.loads(urllib.request.urlopen(req, timeout=15, context=_ctx()).read())
            m = {r["key"]: r["value"] for r in data}
            if m.get("news_sources"):
                cfg["sources"] = m["news_sources"]
            if m.get("news_keywords"):
                cfg["extra_keywords"] = m["news_keywords"]
            if m.get("news_hashtags"):
                cfg["watch_terms"] = m["news_hashtags"]
        except Exception:
            pass
    return cfg


def build_query(name: str, settings: dict) -> str:
    """Compose a Google News query from a name + settings (extra keywords AND-ed,
    sources restricted via site: filters)."""
    q = f'"{name}"'
    for kw in (settings.get("extra_keywords") or []):
        q += f" {kw}"
    sources = settings.get("sources") or []
    if sources:
        q += " (" + " OR ".join(f"site:{s}" for s in sources) + ")"
    return q

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


def fetch_mentions(name: str, max_items: int = 6, ctx=None, settings: dict = None) -> list:
    ctx = ctx or _ctx()
    settings = settings or {}
    region = settings.get("region", "IQ")
    lang = settings.get("language", "ar")
    q = urllib.parse.quote(build_query(name, settings))
    url = f"https://news.google.com/rss/search?q={q}&hl={lang}&gl={region}&ceid={region}:{lang}"
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

    settings = load_settings()
    ctx, fetched, counts = _ctx(), [], {}
    for mid in ids:
        rec = members.get(mid)
        if not rec:
            continue
        name, search = rec
        query = search if search else short_name(name)
        try:
            rows = fetch_mentions(query, per_mp, ctx, settings)
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


def update_watch(out_csv: str, per_term: int = 6) -> dict:
    """Fetch news for each settings.watch_terms topic; write to out_csv."""
    settings = load_settings()
    terms = settings.get("watch_terms") or []
    ctx, rows, counts = _ctx(), [], {}
    for term in terms:
        try:
            hits = fetch_mentions(term, per_term, ctx, settings)
        except Exception:
            hits = []
        counts[term] = len(hits)
        for h in hits:
            rows.append({"term": term, "date": h["date"], "source": h["source"],
                         "title": h["title"], "link": h["link"]})
        time.sleep(0.4)

    os.makedirs(os.path.dirname(out_csv) or ".", exist_ok=True)
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=WATCH_COLUMNS)
        w.writeheader()
        w.writerows(rows)
    return counts
