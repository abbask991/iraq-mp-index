"""Evidence Explorer (Phase 2) — answers "why did the system say this?".

A REUSABLE evidence bundle for any insight (risk/campaign/narrative/reputation/
opinion score, AI recommendation, alert, Facebook gap, viral post, digital twin).
Evidence is COMPUTED from real data (the Facebook items + cross-platform journeys),
never fabricated: matching posts/comments, repeated phrases, related entities,
hashtags/URLs, first-seen time, a cross-platform timeline, and a confidence score.

Demo mode runs the same logic over the demo fixtures so it's presentable offline.
Real mode scans the durable FB snapshot (best-effort) until full storage is wired.

The platform must NEVER surface an AI conclusion without an evidence bundle.
"""
import re

from app.services.facebook import comment_analyzer as ca

_HASHTAG = re.compile(r"#[\w؀-ۿ_]+")
_URL = re.compile(r"https?://\S+")
_ENTITIES = ["المالكي", "الحلبوسي", "السوداني", "الصدر", "النزاهة", "الكهرباء", "المتقاعدين",
             "المنافذ", "البرلمان", "الحكومة", "القضاء", "الجميلي", "الخنجر", "الحكيم", "الخدمات", "الأسعار"]


def _match(text: str, terms: set) -> bool:
    toks = ca._tokens(text)
    return bool(toks & terms) or any(t in (text or "") for t in terms)


async def _demo_items():
    from app.services.facebook import demo as _demo
    out = []
    for slug in _demo.pages():
        for it in _demo.items(slug, 12):
            out.append(it)
    return out, _demo.journeys()


async def _snapshot_items():
    """Best-effort real evidence from the durable FB snapshot (viral posts)."""
    from app.services import facebook as fb
    snap = await fb.get_snapshot() or {}
    items = []
    for v in (snap.get("viral_posts") or []):
        items.append({"text": v.get("text", ""), "pageName": v.get("page"), "url": v.get("url"),
                      "time": v.get("time"), "topComments": []})
    return items, []


async def build(subject: str, subject_type: str = "insight", score: int | None = None,
                demo: bool = False) -> dict:
    terms = {w for w in ca._tokens(subject) if len(w) > 2} | {subject}
    items, journeys = await (_demo_items() if demo else _snapshot_items())

    posts, comments, hashtags, urls, entities = [], [], set(), set(), set()
    times = []
    for it in items:
        text = it.get("text") or ""
        cmts = [c.get("text") if isinstance(c, dict) else c for c in (it.get("topComments") or [])]
        post_match = _match(text, terms)
        matched_cmts = [c for c in cmts if c and _match(c, terms)]
        if not post_match and not matched_cmts:
            continue
        if post_match:
            posts.append({"page": it.get("pageName"), "text": text[:220], "url": it.get("url"),
                          "time": it.get("time"),
                          "reactions": sum(int(it.get(f) or 0) for f in
                                           ("reactionLikeCount", "reactionLoveCount", "reactionCareCount",
                                            "reactionHahaCount", "reactionWowCount", "reactionSadCount", "reactionAngryCount"))})
            if it.get("time"):
                times.append(it["time"])
        for c in (matched_cmts or cmts):
            if c:
                comments.append({"text": c[:160], "sentiment": ca.lexicon_sentiment(c)})
        for h in _HASHTAG.findall(text):
            hashtags.add(h)
        for u in _URL.findall(text):
            urls.add(u)
        for e in _ENTITIES:
            if e in text or any(e in c for c in cmts if c):
                entities.add(e)

    # repeated phrases across matched comments (coordination signal)
    ctexts = [c["text"] for c in comments]
    repeated = ca.repeated_phrases(ca.cluster(ctexts)) if ctexts else []

    # cross-platform timeline if a journey matches the subject
    timeline = []
    for j in journeys:
        if _match(j.get("title", ""), terms):
            for h in j.get("hops", []):
                timeline.append({"platform": h["platform"], "time": h["time"],
                                 "lag_minutes": h.get("lag_minutes"), "similarity": h.get("similarity"),
                                 "detail": h.get("detail")})
            break

    neg = sum(1 for c in comments if c["sentiment"] == "سلبي")
    neg_ratio = round(neg / len(comments) * 100) if comments else 0
    # confidence from evidence volume + corroboration (multiple pages + timeline)
    n_pages = len({p["page"] for p in posts})
    confidence = min(95, 40 + len(posts) * 4 + len(comments) + (15 if timeline else 0) + (n_pages - 1) * 5)
    similarity = (timeline[1]["similarity"] if len(timeline) > 1 else
                  (round((1 - len(ca.cluster(ctexts)) / len(ctexts)) * 100) if len(ctexts) > 3 else None))

    return {
        "demo": demo, "subject": subject, "subject_type": subject_type, "score": score,
        "summary": (f"{len(posts)} منشور و{len(comments)} تعليق مرتبط عبر {n_pages} صفحة"
                    + (f"؛ تكرار {len(repeated)} صياغة متشابهة" if repeated else "")
                    + (f"؛ انتقل عبر {len(timeline)} منصّات" if timeline else "")),
        "evidence_posts": posts[:12],
        "evidence_comments": comments[:15],
        "negative_comment_ratio": neg_ratio,
        "platforms": sorted({p for t in timeline for p in [t["platform"]]} | ({"facebook"} if posts else set())),
        "sources": sorted({p["page"] for p in posts if p["page"]}),
        "first_seen": min(times) if times else (timeline[0]["time"] if timeline else None),
        "repeated_phrases": repeated,
        "hashtags": sorted(hashtags),
        "urls": sorted(urls),
        "related_entities": sorted(entities),
        "similarity_score": similarity,
        "confidence": confidence,
        "timeline": timeline,
        "available": bool(posts or comments),
        "note": None if (posts or comments) else (
            "لا أدلّة مخزّنة لهذا الموضوع بعد — جرّب وضع العرض (?demo=1) أو بعد جمع البيانات."),
        "disclaimer": "الأدلّة مؤشرات احتمالية — تتطلّب مراجعة بشرية. لا تُثبت تنسيقاً كحقيقة.",
    }
