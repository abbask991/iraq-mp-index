"""Page DNA (spec §5+§8) — a behavioral fingerprint for each Facebook page.

Captures: dominant topics, posting schedule (active hours/days), posting frequency,
reaction profile, comment profile (sentiment/mood), repeated entities, sentiment
tendency, emotional tone, and an influence estimate. Used both for the page profile
panel AND as the feature vector the cluster detector compares pages on.

Probabilistic language only — never asserts political affiliation as fact.
"""
from collections import Counter
from datetime import datetime

from app.services import facebook as fb
from app.services.facebook import comment_analyzer as ca, normalizer, reaction_analyzer as rx

_DOW = ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]


def _hour(iso):
    try:
        return datetime.fromisoformat((iso or "").replace("Z", "+00:00")).hour
    except Exception:
        return None


def _dow(iso):
    try:
        return datetime.fromisoformat((iso or "").replace("Z", "+00:00")).weekday()
    except Exception:
        return None


def _influence(posts) -> int:
    """0..100 from average engagement per post (log-scaled)."""
    import math
    if not posts:
        return 0
    avg = sum((p.get("reactions_total") or 0) + (p.get("comments_count") or 0)
              + (p.get("shares_count") or 0) for p in posts) / len(posts)
    return min(100, round(math.log10(avg + 1) * 22))


async def build(slug: str, limit: int = 12, demo: bool = False) -> dict:
    res = await fb._scrape(fb.normalize_target(slug), limit, demo=demo)
    if res.get("error"):
        return {"error": res["error"], "page": slug}
    items = [it for it in res.get("items", []) if isinstance(it, dict) and it.get("text") is not None]
    if not items:
        return {"error": "NO_DATA", "page": slug}
    posts = [normalizer.normalize_post(it, slug) for it in items]
    posts = [p for p in posts if p]
    for p in posts:
        rx.annotate_post(p)
    page_name = posts[0].get("page_name") or slug
    comments = [t for it in items for t in fb._comment_texts(it)]

    # posting schedule
    hours = Counter(h for p in posts if (h := _hour(p.get("created_at"))) is not None)
    dows = Counter(d for p in posts if (d := _dow(p.get("created_at"))) is not None)
    peak_hour = hours.most_common(1)[0][0] if hours else None
    active_days = [_DOW[d] for d, _ in dows.most_common(2)]

    # reaction + comment profiles
    react_profile = rx.breakdown(posts)
    labels = ca.lexicon_classify(comments) if comments else []
    cpos, cneg = labels.count("إيجابي"), labels.count("سلبي")
    comment_profile = {"analyzed": len(labels), "pos": cpos, "neg": cneg,
                       "neu": len(labels) - cpos - cneg,
                       "approval": round(cpos / (cpos + cneg) * 100) if (cpos + cneg) else None}
    mood = ca.lexicon_mood(comments) if comments else {}

    # dominant topics from POST text (what the page talks about) — 2-grams, then unigram fallback
    post_texts = [p.get("post_text", "") for p in posts]
    topics = [k["phrase"] for k in ca.keyword_phrases(post_texts, top=8)]
    if len(topics) < 3:
        topics = [k["phrase"] for k in ca.top_terms(post_texts, top=8, min_count=2)]

    # tendency from COMMENTS (the real opinion), not reactions (likes inflate it)
    base = comment_profile["approval"] if comment_profile["approval"] is not None else react_profile.get("mood_score") or 50
    tendency = "سلبي" if base < 45 else "إيجابي" if base > 60 else "متوازن"

    return {
        "page": page_name, "slug": slug,
        "posts_sampled": len(posts),
        "dominant_topics": topics,
        "posting_schedule": {"peak_hour": peak_hour, "active_days": active_days,
                             "by_hour": dict(hours), "by_day": {_DOW[d]: c for d, c in dows.items()}},
        "posting_frequency_sample": len(posts),
        "reaction_profile": {"mix": react_profile.get("mix"), "mood_score": react_profile.get("mood_score"),
                             "dominant": react_profile.get("dominant_signal")},
        "comment_profile": comment_profile,
        "audience_mood": mood.get("audience_mood", {}),
        "sentiment_tendency": tendency,
        "emotional_tone": (react_profile.get("dominant_emotion")),
        "influence": _influence(posts),
        # feature vector for clustering (topics + dominant reaction + peak hour + tendency)
        "_vector": {"topics": set(topics), "dominant_reaction": react_profile.get("dominant"),
                    "peak_hour": peak_hour, "tendency": tendency},
        "disclaimer": "بصمة سلوكية احتمالية — لا تُثبت انتماءً سياسياً؛ تتطلّب مراجعة بشرية.",
    }


async def build_all(slugs: list, demo: bool = False) -> list:
    out = []
    for s in slugs:
        d = await build(s, demo=demo)
        if not d.get("error"):
            out.append(d)
    return out
