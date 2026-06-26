"""Shared-issue discovery across the two country pools. A topic = a hashtag or a
two-word phrase (collocation); an issue is "shared" when it appears in BOTH
timelines. Two-word phrases ("عودة اللاجئين", "اعادة الاعمار") are real issues —
single bare words ("اعاده", "وزاره") are noise, so they're excluded. Generic
country/news words are dropped too."""
from collections import defaultdict

from app.services import trends
from app.services.collection import dedup

_GENERIC = {
    # home/region country & city names — not "issues"
    "العراق", "عراق", "عراقي", "عراقيه", "سوريا", "سوري", "سوريه", "سورية", "بغداد", "دمشق",
    "لبنان", "لبناني", "ايران", "ايراني", "تركيا", "تركي", "امريكا", "امريكي", "اميركا",
    "اسرائيل", "اسرائيلي", "السعوديه", "سعودي", "الكويت", "قطر", "الامارات", "البحرين",
    "اليمن", "يمني", "مصر", "مصري", "الاردن", "فلسطين", "فلسطيني", "غزه", "روسيا", "روسي",
    "اوكرانيا", "الصين", "صيني", "فرنسا", "بريطانيا", "اوروبا", "الناتو", "طهران", "بيروت",
    "انقره", "اسطنبول", "الرياض", "اوروبي", "خليجي", "عربي", "العرب",
    # generic news/discourse words
    "اخبار", "عاجل", "فيديو", "صوره", "اليوم", "الان", "خبر", "تصريح", "حول", "بشان", "قال",
    "الحكومه", "الرئيس", "الوزير", "البلد", "الدوله", "الشعب", "الناس", "العالم", "المنطقه",
    "تويتر", "منشور", "تغريده", "متابعه", "رابط",
}


def _ok(w):
    return len(w) >= 3 and w not in trends.AR_STOP and w not in _GENERIC


def _post_topics(t):
    """Set of (display, key) topics — hashtags + adjacent two-word phrases."""
    out = set()
    for h in (t.get("hashtags") or []):
        if not h:
            continue
        key = dedup.normalize(h)
        if key and key not in _GENERIC and len(key) >= 3:
            out.add(("#" + h, "h:" + key))
    words = dedup.normalize(t.get("text", "")).split()
    for i in range(len(words) - 1):
        a, b = words[i], words[i + 1]
        if _ok(a) and _ok(b):
            out.add((f"{a} {b}", f"b:{a} {b}"))
    return out


def index(posts):
    """key → {display, idxs:[post indices]}."""
    idx = defaultdict(lambda: {"display": None, "idxs": []})
    for i, p in enumerate(posts):
        for disp, key in _post_topics(p):
            e = idx[key]
            e["display"] = e["display"] or disp
            e["idxs"].append(i)
    return idx


def shared(iq_idx, sy_idx, *, min_each=4, top=18):
    """Topics present in BOTH pools with min volume, ranked by combined volume."""
    out = []
    for key in set(iq_idx) & set(sy_idx):
        ic, sc = len(iq_idx[key]["idxs"]), len(sy_idx[key]["idxs"])
        if ic >= min_each and sc >= min_each:
            out.append({"key": key,
                        "display": iq_idx[key]["display"] or sy_idx[key]["display"],
                        "iq_count": ic, "sy_count": sc, "score": ic + sc})
    out.sort(key=lambda x: -x["score"])
    return out[:top]
