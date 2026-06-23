"""News-mention pipeline (prototype): fetch Google News RSS per MP and store
mentions for DISPLAY ONLY. These do NOT feed the ranking score.

Name matching is intentionally simple (first + last token) — real deployment
needs disambiguation + human review (see the README / data caveats).
"""

from __future__ import annotations

import concurrent.futures as _cf
import csv
import datetime
import os
import ssl
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

# Iraqi news domains (well-indexed in Google News) for deep per-source monitoring.
IRAQI_SOURCES = ["shafaq.com", "ina.iq", "baghdadtoday.news", "almadapaper.net", "ninanews.com",
    "mawazin.net", "sotaliraq.com", "basnews.com", "nrttv.com", "kurdistan24.net", "almasalah.com",
    "alghadpress.com", "964media.com", "rudaw.net", "alaalem.com", "burathanews.com", "alsharqiya.com",
    "almustakbalpaper.net", "alsabaah.iq", "imn.iq", "almothaqaf.com", "alrabiaa.tv",
    "ultrairaq.ultrasawt.com", "altaghier.tv"]

MENTION_COLUMNS = ["mp_id", "date", "source", "title", "link"]
WATCH_COLUMNS = ["term", "date", "source", "title", "link"]


def _fetch_source(term, domain, per_source, ctx, region, lang):
    try:
        q = urllib.parse.quote(f'"{term}" site:{domain}')
        url = f"https://news.google.com/rss/search?q={q}&hl={lang}&gl={region}&ceid={region}:{lang}"
        raw = urllib.request.urlopen(
            urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=20, context=ctx).read()
        out = []
        for it in ET.fromstring(raw).findall(".//item")[:per_source]:
            s = it.find("{*}source")
            date = (it.findtext("pubDate") or "").strip()
            try:
                date = datetime.datetime.strptime(date[:25].strip(), "%a, %d %b %Y %H:%M:%S").strftime("%Y-%m-%d")
            except Exception:
                date = date[:16]
            out.append({"title": (it.findtext("title") or "").strip(),
                        "source": s.text if s is not None else domain,
                        "link": (it.findtext("link") or "").strip(), "date": date})
        return out
    except Exception:
        return []


def fetch_per_source(term, sources, per_source=12, ctx=None, region="IQ", lang="ar"):
    """Query EACH source separately (in parallel) and aggregate — gives deep,
    diverse coverage instead of one query dominated by 1-2 outlets."""
    ctx = ctx or _ctx()
    hits = []
    with _cf.ThreadPoolExecutor(max_workers=10) as ex:
        for r in ex.map(lambda d: _fetch_source(term, d, per_source, ctx, region, lang), sources):
            hits += r
    seen, uniq = set(), []
    for h in hits:
        if h["link"] and h["link"] not in seen:
            seen.add(h["link"]); uniq.append(h)
    uniq.sort(key=lambda x: x.get("date", ""), reverse=True)
    return uniq


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


def classify_llm(title: str):
    """Accurate classification via the Claude API. Active only when
    ANTHROPIC_API_KEY is set (and USE_LLM_CLASSIFY=1). Returns None otherwise."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key or not os.environ.get("USE_LLM_CLASSIFY"):
        return None
    import json as _json
    prompt = ('صنّف هذا العنوان الإخباري عن نائب عراقي. أعد JSON فقط:'
              ' {"sentiment":"إيجابي|محايد|سلبي","type":"أمني/حادث|فساد/قضاء|تشريعي|رقابي|دبلوماسي/زيارة|تصريح|عام"}.'
              f'\nالعنوان: {title}')
    body = {"model": "claude-haiku-4-5-20251001", "max_tokens": 60,
            "messages": [{"role": "user", "content": prompt}]}
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=_json.dumps(body).encode(),
        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    try:
        r = _json.loads(urllib.request.urlopen(req, timeout=30, context=_ctx()).read())
        txt = r["content"][0]["text"]
        m = _json.loads(txt[txt.find("{"):txt.rfind("}") + 1])
        return {"sentiment": m.get("sentiment", "محايد"), "type": m.get("type", "عام")}
    except Exception:
        return None


def _classify_kw(title: str) -> dict:
    t = title or ""
    typ = next((label for label, kws in _TYPES if any(k in t for k in kws)), "عام")
    if any(k in t for k in _NEG):
        sent = "سلبي"
    elif any(k in t for k in _POS):
        sent = "إيجابي"
    else:
        sent = "محايد"
    return {"type": typ, "sentiment": sent}


_CACHE: dict = {}


def classify(title: str) -> dict:
    if title in _CACHE:
        return _CACHE[title]
    r = classify_llm(title) or _classify_kw(title)
    _CACHE[title] = r
    return r


def _llm_on() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") and os.environ.get("USE_LLM_CLASSIFY"))


def classify_batch_llm(titles: list):
    """Classify up to ~25 titles in ONE Claude call. Returns a list or None."""
    if not _llm_on() or not titles:
        return None
    import json as _json
    listed = "\n".join(f"{i+1}. {t}" for i, t in enumerate(titles))
    prompt = ('عناوين أخبار عن نواب عراقيين. صنّف كل عنوان. أعد JSON array فقط، بنفس الترتيب وبنفس العدد '
              f'({len(titles)} عنصر)، كل عنصر: '
              '{"sentiment":"إيجابي|محايد|سلبي","type":"أمني/حادث|فساد/قضاء|تشريعي|رقابي|دبلوماسي/زيارة|تصريح|عام"}.\n\n'
              + listed)
    body = {"model": "claude-haiku-4-5-20251001", "max_tokens": 2000,
            "messages": [{"role": "user", "content": prompt}]}
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=_json.dumps(body).encode(),
        headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
                 "content-type": "application/json"})
    try:
        r = _json.loads(urllib.request.urlopen(req, timeout=60, context=_ctx()).read())
        txt = r["content"][0]["text"]
        arr = _json.loads(txt[txt.find("["):txt.rfind("]") + 1])
        if len(arr) == len(titles):
            return [{"sentiment": x.get("sentiment", "محايد"), "type": x.get("type", "عام")} for x in arr]
    except Exception:
        pass
    return None


def relevance_filter(name: str, governorate: str, bloc: str, items: list) -> list:
    """Keep only mentions actually about THIS MP, using Claude to drop news about
    a different person with the same name or unrelated topics. Falls back to
    keeping everything if the LLM is off or fails (never drops on error)."""
    if not _llm_on() or len(items) < 1:
        return items
    import json as _json
    listed = "\n".join(f"{i + 1}. {it['title']}" for i, it in enumerate(items))
    prompt = (f'عناوين أخبار يُفترض أنها عن النائب العراقي "{name}" من محافظة {governorate} (كتلة {bloc}). '
              'أعد JSON array بأرقام العناوين التي تخصّ هذا النائب تحديداً فقط — '
              'استبعد ما يخصّ شخصاً آخر بنفس الاسم أو مواضيع عامة لا علاقة له بها. '
              'مثال للرد: [1,3,4]\n\n' + listed)
    body = {"model": "claude-haiku-4-5-20251001", "max_tokens": 300,
            "messages": [{"role": "user", "content": prompt}]}
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=_json.dumps(body).encode(),
        headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
                 "content-type": "application/json"})
    try:
        r = _json.loads(urllib.request.urlopen(req, timeout=60, context=_ctx()).read())
        txt = r["content"][0]["text"]
        keep = set(_json.loads(txt[txt.find("["):txt.rfind("]") + 1]))
        filtered = [it for i, it in enumerate(items) if (i + 1) in keep]
        return filtered  # may be empty if AI judges none relevant
    except Exception:
        return items


def classify_many(titles: list) -> list:
    """Classify a list of titles, caching results (batched LLM if enabled)."""
    todo = [t for t in dict.fromkeys(titles) if t not in _CACHE]
    if todo and _llm_on():
        for i in range(0, len(todo), 25):
            chunk = todo[i:i + 25]
            res = classify_batch_llm(chunk)
            if res:
                for t, r in zip(chunk, res):
                    _CACHE[t] = r
            else:
                for t in chunk:
                    _CACHE[t] = _classify_kw(t)
    return [classify(t) for t in titles]


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
        members = {int(r["member_id"]): r for r in csv.DictReader(f)}

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
        name = rec["name"]
        search = (rec.get("search_name") or "").strip()
        query = search if search else short_name(name)
        try:
            rows = fetch_mentions(query, per_mp, ctx, settings)
        except Exception:
            rows = []  # one failure (rate-limit/timeout) shouldn't kill the run
        rows = relevance_filter(name, rec.get("governorate", ""), rec.get("bloc", ""), rows)
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
    sources = settings.get("sources") or IRAQI_SOURCES
    region, lang = settings.get("region", "IQ"), settings.get("language", "ar")
    ctx, rows, counts = _ctx(), [], {}
    for term in terms:
        try:
            hits = fetch_per_source(term, sources, per_source=12, ctx=ctx, region=region, lang=lang)[:per_term]
        except Exception:
            hits = []
        counts[term] = len(hits)
        for h in hits:
            rows.append({"term": term, "date": h["date"], "source": h["source"],
                         "title": h["title"], "link": h["link"]})

    os.makedirs(os.path.dirname(out_csv) or ".", exist_ok=True)
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=WATCH_COLUMNS)
        w.writeheader()
        w.writerows(rows)
    return counts
