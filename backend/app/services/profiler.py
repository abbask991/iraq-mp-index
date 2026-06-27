"""Deep account profiler. Give it an X handle or profile URL and it builds a deep
profile of the person from their ACTUAL timeline: political leaning, who they
support / oppose / endorse (extracted by AI from their own content — not limited
to a watchlist), dominant themes, emotional tone, credibility / bot-likeness, and
collusion / coordinated-operative signals. Evidence-based and probabilistic."""
import json
import re
from collections import Counter

import httpx

from app.config import ANTHROPIC_API_KEY, SUMMARY_MODEL
from app.services import emotions, network, trends, x
from app.services.collection import cluster, dedup
from app.services.media_battlefield.battlefield_summary import _extract_json

_URL = re.compile(r"(?:twitter\.com|x\.com)/(@?[A-Za-z0-9_]{2,15})", re.I)
_BARE = re.compile(r"^@?([A-Za-z0-9_]{2,15})$")
_RESERVED = {"https", "http", "www", "home", "search", "i", "intent"}


def clean_handle(s: str) -> str:
    s = (s or "").strip()
    m = _URL.search(s)
    if m:
        return m.group(1).lstrip("@")
    m = _BARE.match(s)
    if m and m.group(1).lower() not in _RESERVED:
        return m.group(1)
    m = re.search(r"@([A-Za-z0-9_]{2,15})", s)
    return m.group(1) if m else ""


def _find_profile(handle, users, tweets):
    for u in users.values():
        if (u.get("username") or "").lower() == handle.lower():
            return u
    return users.get(tweets[0].get("author_id")) if tweets else None


async def _ai_profile(handle, prof, sample_texts):
    """AI extracts the real political profile from the account's own tweets."""
    fallback = {"leaning": "", "supports": [], "opposes": [], "endorses": [],
                "themes": [], "collusion_note": "", "credibility_note": "", "summary": ""}
    if not ANTHROPIC_API_KEY or not sample_texts:
        return fallback
    joined = "\n".join(f"- {t[:220]}" for t in sample_texts[:32])
    prompt = (
        "أنت محلّل استخبارات سياسية. أمامك نبذة حساب على X وعيّنة من منشوراته. استنتج بروفايلاً سياسياً "
        "**من المحتوى نفسه** (لا معرفة خارجية ولا اختراع)، مع الانتباه للإشارات **الضمنية** لا الصريحة فقط:\n"
        "• مَن يمدحه أو يدافع عنه أو يقتبسه بإيجاب = دعم/انحياز.\n"
        "• مَن ينتقده أو يحمّله المسؤولية أو يسخر منه = معارضة.\n"
        "• القضايا/السياسات التي يتبنّاها أو يروّج لها = تأييد.\n"
        "صِف «الميول» دائماً بجملة واضحة (حتى لو التوجّه ضمنياً من النبرة والمواضيع)، ولا تتركها فارغة إلا إذا "
        "كان المحتوى غير سياسي بالمطلق. أعد كائن JSON واحداً فقط بالعربية:\n"
        '{"leaning":"وصف التوجّه/الميول (جملة على الأقل)","supports":["جهات/أشخاص ينحاز لهم"],'
        '"opposes":["جهات/أشخاص يعارضهم أو ينتقدهم"],"endorses":["قضايا/سياسات يؤيّدها"],'
        '"themes":["أبرز المحاور المتكرّرة"],"collusion_note":"إشارات تنسيق/تواطؤ إن وُجدت (تكرار رسائل، '
        'لغة دعائية موحّدة، تضخيم منظّم)","credibility_note":"تقييم المصداقية والموضوعية",'
        '"summary":"بروفايل تحليلي جملتان-ثلاث عن شخصيته السياسية وأجندته"}\n'
        "كن موجزاً جداً: القوائم كلمات قليلة لكل عنصر، والملخّص ٣ جُمل كحدّ أقصى (لتجنّب اقتطاع الإجابة). "
        "استخدم لغة احتمالية رصينة. املأ «themes» و«summary» و«leaning» دائماً ما دام المحتوى عاماً/سياسياً.\n\n"
        f"النبذة: «{(prof.get('description') or '')[:160]}»\n\nالمنشورات:\n{joined}"
    )
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post("https://api.anthropic.com/v1/messages",
                             headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                                      "content-type": "application/json"},
                             json={"model": SUMMARY_MODEL, "max_tokens": 2000,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=60)
            out = _extract_json(r.json()["content"][0]["text"])
            return {**fallback, **out} if out else fallback
    except Exception:
        return fallback


async def analyze(handle_or_url: str, rng: str = "month") -> dict:
    handle = clean_handle(handle_or_url)
    if not handle:
        return {"error": "BAD_HANDLE", "message": "أدخل معرّف X صحيح أو رابط بروفايل."}
    from app.services.collection import budget
    budget.set_category("profiler")
    tw = await x.fetch_user_timeline(handle, want=120, range=rng)
    if "error" in tw:
        msg = ("نفد رصيد مزوّد البيانات (TwitterAPI.io) — يرجى إعادة الشحن."
               if tw["error"] in (402, "BUDGET_CAP_REACHED") else
               "تعذّر الجلب — تأكد من المعرّف أو توكن X.")
        return {"error": tw["error"], "handle": handle, "message": msg}
    tweets, users = tw.get("tweets", []), tw.get("users", {})
    if len(tweets) < 5:
        return {"error": "NO_DATA", "handle": handle,
                "message": "نشاط قليل جداً أو حساب محمي/غير موجود — تعذّر التحليل."}

    prof = _find_profile(handle, users, tweets) or {}
    pm = prof.get("public_metrics", {})
    bs, bot_reasons = network.bot_score(prof) if prof else (0, [])
    texts = [t.get("text", "") for t in tweets if t.get("text")]

    emo = emotions.aggregate(texts)
    top_emo = sorted(emo.items(), key=lambda x: -x[1])[:4]
    disc = trends.discover(tweets, users, ["محايد"] * len(tweets))

    mentions = Counter()
    for t in tweets:
        for m in (t.get("mentions") or []):
            if m and m.lower() != handle.lower():
                mentions[m] += 1

    fps = [dedup.fingerprint(t) for t in texts]
    dup_ratio = round(1 - len(set(fps)) / len(fps), 2) if fps else 0
    age_days = network._age_days(prof.get("created_at", "") or "") or 0
    ppd = round(len(tweets) / max(1, min(age_days, 30)), 1) if age_days else len(tweets)
    collusion = min(100, round(bs * 0.5 + dup_ratio * 100 * 0.3
                               + (15 if (pm.get("followers_count", 0) < 50 and ppd > 15) else 0)))
    operative = ("مؤشّر تشغيل منظّم مرتفع" if collusion >= 60 else "إشارات اشتباه" if collusion >= 35
                 else "يبدو حساباً طبيعياً")

    # AI extracts supports/opposes/endorses from the account's OWN tweets
    reps = [texts[c["rep"]] for c in cluster.build_clusters(tweets)][:30] or texts[:30]
    ai = await _ai_profile(handle, prof, reps)

    return {
        "handle": handle, "period": rng,
        "profile": {
            "name": prof.get("name"), "username": handle,
            "bio": prof.get("description"), "location": prof.get("location"),
            "verified": prof.get("verified", False),
            "followers": pm.get("followers_count", 0), "following": pm.get("following_count", 0),
            "tweets_total": pm.get("tweet_count", 0), "age_days": age_days,
            "posts_analyzed": len(tweets), "posts_per_day": ppd,
        },
        "leaning": ai.get("leaning", ""),
        "supports": ai.get("supports", []),
        "opposes": ai.get("opposes", []),
        "endorses": ai.get("endorses", []),
        "themes": ai.get("themes", []),
        "credibility": {"bot_likeness": bs, "reasons": bot_reasons[:4], "note": ai.get("credibility_note", "")},
        "collusion": {"score": collusion, "label": operative, "duplicate_ratio": dup_ratio,
                      "note": ai.get("collusion_note", "")},
        "amplifies": [{"username": u, "count": c} for u, c in mentions.most_common(8)],
        "top_hashtags": disc.get("hashtags", [])[:8],
        "top_keywords": disc.get("keywords", [])[:8],
        "emotions": [{"emotion": k, "value": round(v)} for k, v in top_emo],
        "summary": ai.get("summary", ""),
        "disclaimer": "تحليل احتمالي آلي لحساب عام على X ضمن آخر فترة — مؤشرات لا اتهامات قاطعة، وتتطلّب مراجعة بشرية.",
    }
