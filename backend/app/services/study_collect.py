"""Digital-opinion collection + classification (Sprint 3, spec §13,14).
Collects REAL content from the sources that work without paid providers — Google
News (RSS) by keyword and public Telegram channels — classifies each into
opinion / sentiment / emotion / type using local Arabic rules (cheap first),
and stores normalized study_signals. Facebook collection needs a paid provider
(Apify) which isn't connected here — those pages are reported as pending, and
NO data is fabricated for them.
"""
from app.services import db, emotions, news, studies, surveys, telegram

# ── lightweight Arabic opinion + type lexicons (local, no cost) ───────────────
_SUPPORT = ("دعم", "مؤيد", "نؤيد", "ممتاز", "رائع", "أحسنتم", "شكرا", "شكراً", "إنجاز",
            "نجاح", "جيد", "ممتازة", "نشكر", "بارك", "توفيق", "إيجابي", "تحسن", "خطوة جيدة")
_OPPOSE = ("فشل", "رفض", "نرفض", "ضد", "سيء", "سيئة", "فساد", "كارثة", "احتجاج", "غاضب",
           "غضب", "مطالبة", "نطالب", "استقالة", "تردي", "أزمة", "خذلان", "وعود", "كذب", "تجاهل")
_COMPLAINT = ("لا يوجد", "انقطاع", "سوء", "شكوى", "معاناة", "تردي", "غياب", "نقص", "تأخر",
              "بلا", "منذ أيام", "منذ ساعات", "متى", "أين", "لماذا لا")
_DEMAND = ("نطالب", "يجب", "مطلوب", "ندعو", "نأمل", "ضرورة", "لا بد", "نريد")
_PRAISE = ("شكرا", "شكراً", "أحسنتم", "بارك الله", "نشكر", "جهود مشكورة", "ممتاز")
_QUESTION = ("؟", "هل ", "لماذا", "متى", "كيف", "أين")


def _hits(text: str, words) -> int:
    return sum(1 for w in words if w in text)


def classify(text: str) -> dict:
    t = text or ""
    sup, opp = _hits(t, _SUPPORT), _hits(t, _OPPOSE)
    if sup and opp:
        opinion = "mixed"
    elif sup > opp:
        opinion = "support"
    elif opp > sup:
        opinion = "oppose"
    else:
        opinion = "neutral"
    sentiment = "positive" if opinion == "support" else "negative" if opinion == "oppose" else "neutral"

    if _hits(t, _DEMAND):
        ctype = "demand"
    elif _hits(t, _COMPLAINT) or opp > sup:
        ctype = "complaint"
    elif _hits(t, _PRAISE):
        ctype = "praise"
    elif _hits(t, _QUESTION):
        ctype = "question"
    else:
        ctype = "opinion"

    scores = emotions._rule_scores(t)
    emo, conf = emotions._top(scores)
    emotion = emo if conf > 0 else "neutral"
    return {"opinion_class": opinion, "sentiment": sentiment, "content_type": ctype, "emotion": emotion}


async def _insert(org_id, study_id, platform, text, url, author, sig, target_id=None, ts=None):
    try:
        await db.insert("study_signals", {
            "organization_id": org_id, "study_id": study_id, "platform": platform,
            "source_target_id": target_id, "content_type": sig["content_type"],
            "content_text": (text or "")[:2000], "content_url": url, "author_or_page": author,
            "ts": ts, "opinion_class": sig["opinion_class"], "sentiment": sig["sentiment"],
            "emotion": sig["emotion"],
        })
        return True
    except Exception:
        return False


async def collect_study(org_id: str, study_id: str, replace: bool = True) -> dict:
    study = await surveys.get_survey(org_id, study_id)
    if not study:
        return {"error": "not_found"}
    analysis = study.get("analysis_json") or {}
    keywords = [k for k in (analysis.get("keywords") or []) if k]
    if not keywords and study.get("title"):
        keywords = [study["title"]]
    targets = await studies.list_targets(org_id, study_id)

    # fresh run: clear previous signals for this study so counts reflect this collection
    if replace:
        try:
            await db.delete("study_signals", f"study_id=eq.{study_id}&organization_id=eq.{org_id}")
        except Exception:
            pass

    inserted = 0
    by_platform: dict[str, int] = {}

    # 1) Google News by keyword (REAL, free)
    if keywords:
        try:
            arts = await news.fetch_news(keywords, per_source=8, cap=60)
        except Exception:
            arts = []
        for a in arts:
            sig = classify(a.get("title", ""))
            if await _insert(org_id, study_id, "google_news", a.get("title"), a.get("link"), a.get("source"), sig):
                inserted += 1
                by_platform["google_news"] = by_platform.get("google_news", 0) + 1

    # 2) public Telegram channels selected as targets (REAL, free)
    tg_channels = [(_t.get("target_external_id") or _t.get("target_name"))
                   for _t in targets if _t.get("target_type") == "telegram_channel"]
    tg_channels = [c for c in tg_channels if c]
    if tg_channels:
        try:
            posts = await telegram.fetch_telegram(tg_channels, per=20)
        except Exception:
            posts = []
        for p in posts:
            sig = classify(p.get("text", ""))
            if await _insert(org_id, study_id, "telegram", p.get("text"), p.get("link"),
                             p.get("source"), sig, ts=p.get("date")):
                inserted += 1
                by_platform["telegram"] = by_platform.get("telegram", 0) + 1

    # 3) Facebook pages — real collection needs a provider (Apify) not connected here.
    fb = [t for t in targets if t.get("target_type") == "facebook_page"]
    note = None
    if fb:
        note = (f"{len(fb)} صفحة فيسبوك مختارة لم تُجمَع: جمع فيسبوك الحقيقي يحتاج مزوّد "
                "(Apify) غير مربوط بهذا النشر — ولم تُلفّق أي بيانات.")

    return {"collected": inserted, "by_platform": by_platform,
            "keywords": keywords, "facebook_pending_pages": len(fb), "note": note}
