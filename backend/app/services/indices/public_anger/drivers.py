"""Anger drivers (§3.2) — the grievances pushing the score up.

Maps items to known driver themes via keyword clusters, then ranks by volume and
attaches a contribution share, trend, platforms and sample evidence.
"""
from collections import defaultdict

from app.services.indices.public_anger import lexicons as lx

# driver theme → normalised trigger words
THEMES = {
    "نقص الكهرباء": (["كهرباء", "الكهرباء", "مقطوعه", "انقطاع", "مولده", "امبير"], "service"),
    "تردّي الخدمات": (["خدمات", "تردي", "سوء", "مقصر", "تقصير", "بلا خدمات"], "service"),
    "الفساد والمحاصصة": (["فساد", "فاسد", "سرقه", "حرامي", "محاصصه", "نزاهه"], "corruption"),
    "الغلاء والأسعار": (["غلاء", "اسعار", "سعر", "دينار", "غالي"], "economic"),
    "الرواتب والبطالة": (["رواتب", "راتب", "بطاله", "عاطل", "تعيين", "خريج"], "economic"),
    "الماء والخدمات الأساسية": (["ماء", "الماي", "مي", "مجاري", "صرف"], "service"),
    "الوقود والنفط": (["وقود", "بنزين", "نفط", "غاز"], "economic"),
    "وعود غير منفّذة": (["وعود", "كذب", "فشلتوا", "خربتوها"], "political"),
}


def _trend(cur: int, prev: int | None) -> str:
    if not prev:
        return "rising" if cur else "stable"
    if cur > prev * 1.15:
        return "rising"
    if cur < prev * 0.85:
        return "declining"
    return "stable"


def extract(items: list, prev_counts: dict | None = None, limit: int = 8) -> list:
    prev_counts = prev_counts or {}
    buckets = defaultdict(list)
    for it in items:
        toks = set(lx.tokens(it.get("text", "")))
        for theme, (words, _typ) in THEMES.items():
            if toks & lx._nw(words):
                buckets[theme].append(it)

    total = sum(len(v) for v in buckets.values()) or 1
    out = []
    for theme, its in buckets.items():
        typ = THEMES[theme][1]
        plats = defaultdict(int)
        for i in its:
            plats[(i.get("platform") or "news").lower()] += 1
        out.append({
            "driver_name": theme,
            "driver_type": typ,
            "contribution_score": round(len(its) / total * 100),
            "trend": _trend(len(its), prev_counts.get(theme)),
            "volume": len(its),
            "evidence_count": len(its),
            "top_platforms": [{"platform": p, "count": c} for p, c in sorted(plats.items(), key=lambda x: -x[1])[:3]],
            "sample_evidence": [{"text": i.get("text", "")[:200], "platform": i.get("platform"),
                                 "source": i.get("source"), "url": i.get("url")} for i in its[:3]],
        })
    out.sort(key=lambda d: -d["volume"])
    return out[:limit]
