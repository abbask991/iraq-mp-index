"""Deep insight mining from Facebook comments.

A single approval percentage is not actionable. This module digs into the raw
comment corpus and extracts what a political/media client actually needs:
  - القضايا/المواضيع التي يتحدث عنها الجمهور + موقفهم من كل قضية
  - الشخصيات/الجهات المذكورة في التعليقات + موقف الناس منها (سمعة شعبية)
  - المطالب والشكاوى الصريحة
  - الرسائل/النقاط المتكررة (مؤشّر تنسيق محتمل)
  - اقتباسات بارزة تمثّل المزاج
  - خلاصة قابلة للتنفيذ (ماذا يعني هذا للعميل)

One Sonnet call over a sample of comments → structured JSON. Cached.
"""
import httpx

from app.config import ANTHROPIC_API_KEY, SUMMARY_MODEL
from app.services import ai_cache
from app.services.media_battlefield.battlefield_summary import _extract_json

EMPTY = {"topics": [], "entities": [], "grievances": [], "demands": [],
         "accusations": [], "praise": [], "talking_points": [], "notable_quotes": [],
         "audience": {}, "audience_mood": {}, "mood_index": None,
         "sarcasm_level": None, "anger_level": None, "takeaways": []}


async def deep_insights(subject: str, comments: list, context: str = "") -> dict:
    """Mine a comment corpus for actionable intelligence. `subject` is the page/topic
    the comments are reacting to; `context` is an optional one-line note (e.g. national)."""
    comments = [c for c in (comments or []) if c and len(c.strip()) > 1]
    if len(comments) < 8:
        return {**EMPTY, "insufficient": True}

    # §19: cluster near-duplicates and analyze REPRESENTATIVES only (cuts tokens ~70%).
    ca = None
    try:
        from app.services.facebook import comment_analyzer as ca
        sample = ca.representatives(ca.cluster(comments), cap=90)
    except Exception:
        sample = []
    if not sample:
        sample = sorted(set(c.strip() for c in comments), key=len, reverse=True)[:120]

    # no API key → straight to the offline lexicon engine (so cards still populate)
    if not ANTHROPIC_API_KEY and ca is not None:
        off = ca.offline_insights(sample, subject)
        return {**EMPTY, **off, "analyzed_comments": len(sample)}
    numbered = "\n".join(f"- {c[:220]}" for c in sample)

    prompt = (
        "أنت محلل استخبارات إعلامية عراقي خبير باللهجة العراقية والسخرية. أمامك تعليقات جمهور "
        f"فيسبوك على «{subject}»" + (f" ({context})" if context else "") + ". "
        "احفر في التعليقات واستخرج ما يفيد صانع القرار فعلياً — لا تكتفِ بالعموميات. "
        "انتبه: السخرية العراقية ظاهرها مدح وباطنها ذمّ = موقف سلبي.\n\n"
        "استخرج بدقة:\n"
        "1. topics: أبرز 4-7 قضايا/مواضيع يتحدث عنها الناس (الفساد، الخدمات، الكهرباء، البطالة، الأمن، "
        "شخص معيّن، حدث... إلخ) — لكلٍّ: name، share (نسبة تقديرية % من التعليقات)، sentiment (سلبي|إيجابي|مختلط)، "
        "summary (جملة تشرح موقف الناس)، sample (اقتباس واحد قصير يمثّلها).\n"
        "2. entities: الشخصيات/الأحزاب/الجهات المذكورة في التعليقات — لكلٍّ: name، type (شخصية|حزب|جهة|دولة)، "
        "stance (الجمهور: تأييد|رفض|مختلط)، mentions (تقديري)، note (لماذا).\n"
        "3. grievances: أبرز الشكاوى/الغضب الصريح (قائمة جُمل قصيرة).\n"
        "4. demands: ماذا يطالب الناس به صراحةً (قائمة جُمل قصيرة).\n"
        "5. talking_points: عبارات/نقاط تتكرر بصياغات متشابهة (قد تدل على تنسيق) — لكلٍّ: point، "
        "repetition (عالٍ|متوسط)، note.\n"
        "6. accusations: أبرز الاتهامات الصريحة التي يطلقها الناس (فساد، سرقة، عمالة... إلخ) — قائمة جُمل قصيرة.\n"
        "7. praise: أبرز نقاط المدح/الثناء الصادق (وليس الساخر) — قائمة جُمل قصيرة.\n"
        "8. notable_quotes: 3-5 اقتباسات حقيقية بارزة — لكلٍّ: text، sentiment، why (لماذا مهمّة).\n"
        "9. audience: {supporters_care_about:[...], critics_care_about:[...]} — ما يهمّ كل فريق.\n"
        "10. audience_mood: مؤشّر مزاج الجمهور — قيّم كل بُعد 0..100 حسب حضوره في التعليقات: "
        "{anger, sarcasm, frustration, support, fear, sympathy, trust}.\n"
        "11. mood_index: مؤشّر مزاج إجمالي 0..100 (0=غضب/رفض شديد، 100=تأييد/ثقة عالية).\n"
        "12. sarcasm_level و anger_level: 0..100 لكلٍّ (نسبة التعليقات الساخرة / الغاضبة).\n"
        "13. takeaways: 3-4 خلاصات عملية لصانع القرار (ماذا يعني هذا وماذا يفعل).\n\n"
        "أعد كائن JSON واحداً فقط بالعربية، دون أي نص أو أسوار شيفرة خارج JSON، بالمفاتيح: "
        "topics, entities, grievances, demands, accusations, praise, talking_points, notable_quotes, "
        "audience, audience_mood, mood_index, sarcasm_level, anger_level, takeaways.\n\n"
        f"التعليقات:\n{numbered}"
    )

    def _has_content(d):
        return bool(d) and any(d.get(k) for k in ("topics", "entities", "grievances", "takeaways"))

    # cache read must never lose the result if the cache backend (Redis) is down/capped.
    # an empty cached value is treated as a MISS (don't trust a poisoned/old empty entry).
    try:
        cached = await ai_cache.get(SUMMARY_MODEL, prompt)
    except Exception:
        cached = None
    if _has_content(cached):
        return cached
    out = None
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post("https://api.anthropic.com/v1/messages",
                             headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                                      "content-type": "application/json"},
                             json={"model": SUMMARY_MODEL, "max_tokens": 8000,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=120)
            txt = r.json()["content"][0]["text"]
        out = _extract_json(txt) or {}
    except Exception:
        out = None
    # AI unavailable (no credits / error) or empty extraction → OFFLINE lexicon insights,
    # so the cards still populate (clearly flagged engine='offline-lexicon'). Not cached.
    if not out or not any(out.get(k) for k in ("topics", "grievances", "takeaways")):
        try:
            from app.services.facebook import comment_analyzer as ca
            off = ca.offline_insights(sample, subject)
            if off.get("topics") or off.get("accusations") or off.get("demands"):
                return {**EMPTY, **off, "analyzed_comments": len(sample)}
        except Exception:
            pass
        return {**EMPTY, "error": True}
    # normalize: ensure all keys exist and are the right shape
    result = {**EMPTY, **{k: out.get(k, EMPTY[k]) for k in EMPTY}}
    result["analyzed_comments"] = len(sample)
    # cache ONLY real content — never poison the cache with an empty/failed extraction.
    if _has_content(result):
        try:
            await ai_cache.put(SUMMARY_MODEL, prompt, result)
        except Exception:
            pass
    return result
