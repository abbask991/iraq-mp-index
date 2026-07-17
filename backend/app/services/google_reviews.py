"""Google Reviews / Maps ratings — adapter-based (provider-agnostic).

Fetches a place's rating, review count, star distribution, and recent reviews.
Providers tried in order: SerpAPI (google_maps engine) → Google Places API. If none
is configured it returns a clear 'not configured' result (no fabricated data). Demo
mode returns a rich sample. Review sentiment is computed with the local lexicon.
"""
import os

import httpx


def configured() -> str | None:
    if os.getenv("SERPAPI_KEY"):
        return "serpapi"
    if os.getenv("GOOGLE_PLACES_KEY"):
        return "places"
    return None


def _sent(texts: list) -> dict:
    try:
        from app.services.facebook import comment_analyzer as ca
        labs = ca.lexicon_classify([t for t in texts if t])
        pos, neg = labs.count("إيجابي"), labs.count("سلبي")
        n = len(labs) or 1
        return {"positive": round(pos / n * 100), "negative": round(neg / n * 100),
                "neutral": round((n - pos - neg) / n * 100)}
    except Exception:
        return {}


def _dist(reviews: list) -> dict:
    d = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
    for r in reviews:
        try:
            s = int(round(float(r.get("rating") or 0)))
            if s in d:
                d[s] += 1
        except Exception:
            pass
    return {str(k): v for k, v in d.items()}


async def fetch(place: str, demo: bool = False) -> dict:
    if demo:
        return _demo(place)
    prov = configured()
    if not prov:
        # client-facing: never name a provider key. Our billing state is not the
        # reader's business — say what is unavailable, not what we have not paid for.
        return {"configured": False, "place": place,
                "note": "ريفيوات Google غير مفعّلة لهذا الحساب."}
    try:
        if prov == "serpapi":
            async with httpx.AsyncClient() as c:
                r = await c.get("https://serpapi.com/search.json",
                                params={"engine": "google_maps", "q": place, "type": "search",
                                        "api_key": os.getenv("SERPAPI_KEY")}, timeout=40)
                data = r.json()
                local = (data.get("local_results") or [data.get("place_results") or {}])
                top = local[0] if isinstance(local, list) and local else (data.get("place_results") or {})
                reviews = (top.get("user_reviews", {}) or {}).get("most_relevant", []) or []
                norm = [{"author": rv.get("username"), "rating": rv.get("rating"),
                         "text": (rv.get("description") or "")[:280], "time": rv.get("date")} for rv in reviews[:12]]
                return {"configured": True, "provider": "serpapi", "place": top.get("title") or place,
                        "rating": top.get("rating"), "total_reviews": top.get("reviews"),
                        "distribution": _dist(norm), "recent": norm,
                        "sentiment": _sent([x["text"] for x in norm])}
        return {"configured": True, "provider": prov, "place": place, "note": "محوّل Places قيد الإكمال."}
    except Exception as e:
        return {"configured": True, "provider": prov, "place": place, "error": str(e)[:100]}


def _demo(place: str) -> dict:
    recent = [
        {"author": "أحمد", "rating": 1, "text": "خدمة العملاء سيئة وما يردون على الاتصال", "time": "قبل يومين"},
        {"author": "سارة", "rating": 5, "text": "التغطية ممتازة والفرع محترم", "time": "قبل 3 أيام"},
        {"author": "مصطفى", "rating": 2, "text": "خصمولي رصيد بلا سبب ومحد يحل المشكلة", "time": "قبل أسبوع"},
        {"author": "زينب", "rating": 4, "text": "زين بس الأسعار غالية شوي", "time": "قبل أسبوع"},
        {"author": "علي", "rating": 1, "text": "انتظرت ساعة بالفرع بلا فايدة", "time": "قبل أسبوعين"},
        {"author": "نور", "rating": 5, "text": "أحسن شركة اتصالات بالعراق", "time": "قبل شهر"},
    ]
    return {
        "configured": True, "provider": "demo", "demo": True, "place": "آسياسيل — الفرع الرئيسي",
        "rating": 3.4, "total_reviews": 1240,
        "distribution": {"5": 430, "4": 180, "3": 120, "2": 190, "1": 320},
        "recent": recent, "sentiment": {"positive": 38, "negative": 49, "neutral": 13},
        "summary": "تقييم 3.4/5 من 1,240 مراجعة — استقطاب واضح: ثناء على التغطية، شكاوى متكررة على خدمة العملاء وخصم الرصيد.",
        "disclaimer": "بيانات تجريبية — تُستبدل بريفيوات Google الحقيقية عند إضافة مفتاح المزوّد.",
    }
