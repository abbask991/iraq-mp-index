"""Viral Post Intelligence (spec §4).

For the top posts across the monitored pages, explains WHY each went viral, the
dominant narrative, the audience reaction (reaction mood) vs comment mood, the
related entity, and a risk score — so a viral post becomes an intelligence item,
not just a high number. Works in demo mode (no Apify/AI).
"""
from app.services import facebook as fb
from app.services.facebook import comment_analyzer as ca, normalizer, reaction_analyzer as rx

# small offline gazetteer so we can tag a related entity without AI (extend freely)
_ENTITIES = ["المالكي", "الحلبوسي", "السوداني", "الصدر", "النزاهة", "الكهرباء", "المتقاعدين",
             "المنافذ", "البرلمان", "الحكومة", "القضاء", "الجميلي", "الخنجر", "الحكيم"]


def _eng(p):
    return p["pos"] + p["neg"] + p["amb"] + p["comments"] + p["shares"]


def _why_viral(p) -> list:
    why = []
    reacts = p["pos"] + p["neg"] + p["amb"] or 1
    if p["shares"] > reacts * 0.25:
        why.append("انتشار واسع بالمشاركة (محتوى قابل للنشر)")
    if p["comments"] > reacts * 0.4:
        why.append("جدل مرتفع بالتعليقات")
    if p["angry"] > reacts * 0.15:
        why.append("غضب شعبي واضح")
    if p["pos"] > reacts * 0.7:
        why.append("تأييد/تعاطف واسع")
    return why or ["تفاعل إجمالي مرتفع"]


def _related_entity(text: str):
    for e in _ENTITIES:
        if e in (text or ""):
            return e
    return None


def _risk(p, comment_neg_ratio: float) -> dict:
    reacts = p["pos"] + p["neg"] + p["amb"] or 1
    anger = p["angry"] / reacts
    amp = min(1.0, p["shares"] / (reacts + 1) / 0.3)
    score = round(min(100, anger * 45 + comment_neg_ratio * 35 + amp * 20))
    level = "حرج" if score >= 70 else "مرتفع" if score >= 50 else "متوسط" if score >= 30 else "منخفض"
    return {"score": score, "level": level}


async def top_viral(demo: bool = False, per_page: int = 12, top: int = 12) -> dict:
    if demo:
        from app.services.facebook import demo as _demo
        pages = _demo.pages()
    else:
        pages = await fb.get_pages()
    all_posts = []
    for slug in pages:
        res = await fb._scrape(fb.normalize_target(slug), per_page, demo=demo)
        for it in res.get("items", []):
            if not isinstance(it, dict) or it.get("text") is None:
                continue
            m = fb._metrics(it)
            if (m["pos"] + m["neg"] + m["amb"]) <= 0:
                continue
            m["_page"] = it.get("pageName") or slug
            all_posts.append(m)
    all_posts.sort(key=lambda p: -_eng(p))
    cards = []
    for p in all_posts[:top]:
        comments = p.get("_comments", [])
        labels = ca.lexicon_classify(comments) if comments else []
        cneg = labels.count("سلبي")
        neg_ratio = cneg / len(labels) if labels else 0.0
        comment_mood = round((labels.count("إيجابي")) / (labels.count("إيجابي") + cneg) * 100) if (labels.count("إيجابي") + cneg) else None
        cards.append({
            "page": p.get("_page"), "text": p["text"], "url": p.get("url"), "time": p.get("time"),
            "reactions": p["pos"] + p["neg"] + p["amb"], "comments": p["comments"], "shares": p["shares"],
            "engagement": _eng(p),
            "reaction_mood": rx.mood_score(p["reactions"]),
            "comment_mood": comment_mood,
            "dominant_emotion": rx.breakdown(p).get("dominant_signal"),
            "why_viral": _why_viral(p),
            "narrative": (ca.top_terms([p["text"]], top=1, min_count=1) or [{}])[0].get("phrase"),
            "related_entity": _related_entity(p["text"]),
            "risk": _risk(p, neg_ratio),
        })
    return {"viral_posts": cards, "count": len(cards), "demo": demo,
            "disclaimer": "ترتيب احتمالي بالتفاعل — درجة الخطر مؤشّر لا حكم قاطع."}
