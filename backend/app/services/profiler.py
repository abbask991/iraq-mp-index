"""Deep account profiler. Give it an X handle or profile URL and it builds a deep
profile of the person: who they support / oppose (target-aware stance per entity),
their political leaning, dominant themes, emotional tone, credibility / bot-likeness,
and collusion / coordinated-operative signals (copypasta + bot markers + narrow
focus). Evidence-based and probabilistic."""
import re
from collections import Counter

from app.services import db, emotions, entity_resolver, network, trends, x
from app.services.collection import dedup
from app.services.opinion import ai_opinion

_URL = re.compile(r"(?:twitter\.com|x\.com)/(@?[A-Za-z0-9_]{2,15})", re.I)
_BARE = re.compile(r"^@?([A-Za-z0-9_]{2,15})$")
_RESERVED = {"https", "http", "www", "home", "search", "i", "intent"}


def clean_handle(s: str) -> str:
    s = (s or "").strip()
    m = _URL.search(s)                          # a profile URL → take the path segment
    if m:
        return m.group(1).lstrip("@")
    m = _BARE.match(s)                          # a bare @handle / handle
    if m and m.group(1).lower() not in _RESERVED:
        return m.group(1)
    m = re.search(r"@([A-Za-z0-9_]{2,15})", s)  # @handle inside other text
    return m.group(1) if m else ""


def _find_profile(handle, users, tweets):
    for u in users.values():
        if (u.get("username") or "").lower() == handle.lower():
            return u
    # fall back to the author of the fetched tweets
    if tweets:
        return users.get(tweets[0].get("author_id"))
    return None


async def analyze(handle_or_url: str, rng: str = "month") -> dict:
    handle = clean_handle(handle_or_url)
    if not handle:
        return {"error": "BAD_HANDLE", "message": "أدخل معرّف X صحيح أو رابط بروفايل."}
    tw = await x.fetch_trend(f"from:{handle}", want=140, range=rng)
    if "error" in tw:
        return {"error": tw["error"], "handle": handle,
                "message": "تعذّر الجلب — تأكد من المعرّف أو توكن X أو سقف الميزانية."}
    tweets, users = tw.get("tweets", []), tw.get("users", {})
    if len(tweets) < 5:
        return {"error": "NO_DATA", "handle": handle,
                "message": "نشاط قليل جداً أو حساب محمي/غير موجود — تعذّر التحليل."}

    prof = _find_profile(handle, users, tweets) or {}
    pm = prof.get("public_metrics", {})
    bs, bot_reasons = network.bot_score(prof) if prof else (0, [])
    texts = [t.get("text", "") for t in tweets]

    emo = emotions.aggregate(texts)
    top_emo = sorted(emo.items(), key=lambda x: -x[1])[:4]
    disc = trends.discover(tweets, users, ["محايد"] * len(tweets))

    mentions = Counter()
    for t in tweets:
        for m in (t.get("mentions") or []):
            if m and m.lower() != handle.lower():
                mentions[m] += 1

    # which monitored entities does this account talk about, and with what stance?
    monitors = await db.get_monitors(40)
    ent_hits = []
    for m in monitors:
        name = m.get("name") or (m.get("keywords") or [""])[0]
        nn = entity_resolver.normalize_arabic(name)
        if not nn:
            continue
        posts = [t for t in tweets if nn in entity_resolver.normalize_arabic(t.get("text", ""))]
        if len(posts) >= 2:
            ent_hits.append((name, posts))
    ent_hits.sort(key=lambda x: -len(x[1]))

    stances = []
    for name, posts in ent_hits[:5]:
        cls = await ai_opinion.classify(name, posts)
        sup = sum(1 for c in cls if c.get("stance") == "support")
        opp = sum(1 for c in cls if c.get("stance") == "oppose")
        net = ("مؤيّد" if sup > opp else "معارض" if opp > sup else "محايد")
        stances.append({"entity": name, "mentions": len(posts), "support": sup,
                        "oppose": opp, "stance": net,
                        "intensity": round(100 * abs(sup - opp) / max(1, sup + opp))})

    # collusion / coordinated-operative signal
    fps = [dedup.fingerprint(t) for t in texts if t]
    dup_ratio = round(1 - len(set(fps)) / len(fps), 2) if fps else 0
    age_days = network._age_days(prof.get("created_at", "") or "") or 0
    posts_per_day = round(len(tweets) / max(1, min(age_days, 30)), 1) if age_days else len(tweets)
    collusion = min(100, round(bs * 0.5 + dup_ratio * 100 * 0.3
                               + (15 if (pm.get("followers_count", 0) < 50 and posts_per_day > 15) else 0)))
    operative = ("مؤشّر تشغيل منظّم مرتفع" if collusion >= 60 else "إشارات اشتباه" if collusion >= 35
                 else "يبدو حساباً طبيعياً")

    summary = await _profile_ai(handle, prof, stances, disc, top_emo, bs, dup_ratio, collusion)

    return {
        "handle": handle, "period": rng,
        "profile": {
            "name": prof.get("name"), "username": handle,
            "bio": prof.get("description"), "location": prof.get("location"),
            "verified": prof.get("verified", False),
            "followers": pm.get("followers_count", 0), "following": pm.get("following_count", 0),
            "tweets_total": pm.get("tweet_count", 0), "age_days": age_days,
            "posts_analyzed": len(tweets), "posts_per_day": posts_per_day,
        },
        "credibility": {"bot_likeness": bs, "reasons": bot_reasons[:4]},
        "leaning_stances": stances,
        "amplifies": [{"username": u, "count": c} for u, c in mentions.most_common(8)],
        "top_hashtags": disc.get("hashtags", [])[:8],
        "top_keywords": disc.get("keywords", [])[:8],
        "emotions": [{"emotion": k, "value": round(v * 100)} for k, v in top_emo],
        "collusion": {"score": collusion, "label": operative, "duplicate_ratio": dup_ratio},
        "summary": summary,
        "disclaimer": "تحليل احتمالي آلي لحساب عام على X ضمن آخر فترة — مؤشرات لا اتهامات قاطعة، وتتطلّب مراجعة بشرية.",
    }


async def _profile_ai(handle, prof, stances, disc, top_emo, bs, dup_ratio, collusion):
    from app.services.media_battlefield import battlefield_summary
    st = "؛ ".join(f"{s['entity']}: {s['stance']} (تأييد {s['support']}/معارضة {s['oppose']})" for s in stances) or "لا مواقف واضحة"
    tags = "، ".join(h.get("hashtag", h) if isinstance(h, dict) else str(h) for h in disc.get("hashtags", [])[:5]) or "—"
    emo = "، ".join(f"{k} {round(v*100)}%" for k, v in top_emo[:3])
    facts = (
        f"بروفايل حساب X @{handle}. النبذة: «{(prof.get('description') or '')[:160]}». "
        f"المتابعون {prof.get('public_metrics', {}).get('followers_count', 0)}. "
        f"مواقفه من الكيانات: {st}. أبرز الوسوم: {tags}. النبرة العاطفية: {emo}. "
        f"احتمال آلية/بوت {bs}/100، تكرار محتوى {round(dup_ratio*100)}%، مؤشر تواطؤ/تنسيق {collusion}/100. "
        f"اكتب بروفايلاً تحليلياً موجزاً: التوجّه السياسي العام، مَن يدعم ومَن يعارض، أنماطه وأجندته المحتملة، "
        f"مصداقيته، وهل توجد إشارات تواطؤ/تشغيل منظّم. استخدم لغة احتمالية رصينة."
    )
    out = await battlefield_summary.summarize(facts)
    return out.get("summary", "")
