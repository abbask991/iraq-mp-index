"""Per-tenant live feed — the payoff of multi-tenancy.

Given an organization's watchlist (entities + keywords), fetch a REAL, current
news feed about THOSE targets via the free Google News RSS engine — so every
client sees their own data, not the shared national picture. No paid API key
required, so this works today even with the paid providers capped.

Every build records a per-tenant usage event (billing attribution), and any
optional paid enrichment (AI summary) would be metered against the same org.
"""
from collections import Counter

from app.services import news, metering


def _terms(watchlist: dict) -> list[str]:
    seen, out = set(), []
    for k in ("entities", "keywords", "brands"):
        for t in (watchlist.get(k) or []):
            t = str(t).strip()
            key = t.lower()
            if t and key not in seen:
                seen.add(key)
                out.append(t)
    return out


async def build_feed(org_id: str, watchlist: dict, range: str = "week") -> dict:
    terms = _terms(watchlist)
    if not terms:
        return {"org_id": org_id, "terms": [], "total": 0, "items": [],
                "by_term": [], "by_source": [], "by_day": [], "empty": True,
                "note": "قائمتك فارغة — أضف كيانات/كلمات مفتاحية في «قائمة المراقبة» لتظهر بياناتك هنا."}

    try:
        hits = await news.fetch_news(terms, range=range)
    except Exception:
        hits = []

    # per-tenant activity attribution (Google News RSS is free → cost 0, but tracked)
    await metering.record(org_id, "news", "rss_fetch", units=len(terms), cost_usd=0.0,
                          meta={"terms": len(terms)})

    by_term = Counter(h.get("term", "") for h in hits)
    by_source = Counter(h.get("source", "") for h in hits if h.get("source"))
    by_day = Counter(h.get("date", "") for h in hits if h.get("date"))

    return {
        "org_id": org_id,
        "terms": terms,
        "total": len(hits),
        "items": hits[:60],
        "by_term": [{"term": t, "count": c} for t, c in by_term.most_common()],
        "by_source": [{"source": s, "count": c} for s, c in by_source.most_common(10)],
        "by_day": [{"date": d, "count": c} for d, c in sorted(by_day.items())][-14:],
        "empty": not hits,
        "note": None if hits else "لا نتائج حديثة لهذه القائمة في النطاق الزمني المحدّد.",
    }
