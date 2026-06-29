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
         "talking_points": [], "notable_quotes": [], "audience": {}, "takeaways": []}


async def deep_insights(subject: str, comments: list, context: str = "") -> dict:
    """Mine a comment corpus for actionable intelligence. `subject` is the page/topic
    the comments are reacting to; `context` is an optional one-line note (e.g. national)."""
    comments = [c for c in (comments or []) if c and len(c.strip()) > 1]
    if not ANTHROPIC_API_KEY or len(comments) < 8:
        return {**EMPTY, "insufficient": True}

    # bound input: a representative sample, longest-first (richer signal), truncated
    sample = sorted(set(c.strip() for c in comments), key=len, reverse=True)[:120]
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
        "6. notable_quotes: 3-5 اقتباسات حقيقية بارزة — لكلٍّ: text، sentiment، why (لماذا مهمّة).\n"
        "7. audience: {supporters_care_about:[...], critics_care_about:[...]} — ما يهمّ كل فريق.\n"
        "8. takeaways: 3-4 خلاصات عملية لصانع القرار (ماذا يعني هذا وماذا يفعل).\n\n"
        "أعد كائن JSON واحداً فقط بالعربية، دون أي نص أو أسوار شيفرة خارج JSON، بالمفاتيح: "
        "topics, entities, grievances, demands, talking_points, notable_quotes, audience, takeaways.\n\n"
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
