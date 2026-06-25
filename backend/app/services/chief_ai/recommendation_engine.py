"""The analyst's brain — one Sonnet call turns the digest facts into the
executive advisor output: brief, threats, opportunities, structured
recommendations (priority/confidence/reason/evidence/outcome), and questions.

Cached (ai_cache) so it runs ~once per refresh, not per request. Probabilistic
language; coordination/funding flagged for human review.
"""
import json

from app.config import ANTHROPIC_API_KEY, SUMMARY_MODEL
from app.services import ai_cache

_EMPTY = {"executive_brief": "", "threats": [], "opportunities": [],
          "recommendations": [], "questions": []}


async def generate(facts: str) -> dict:
    if not ANTHROPIC_API_KEY:
        return _EMPTY
    prompt = (
        "أنت «رئيس الاستخبارات» الافتراضي بجانب صانع القرار (رئيس وزراء/وزير/قائد حزب/مدير حملة). "
        "بناءً على المعطيات الآلية أدناه عن آخر فترة، أنتج تقريراً تنفيذياً عملياً. أعد JSON فقط بالعربية بهذا الشكل:\n"
        "{\n"
        '"executive_brief":"5-8 جُمل: ماذا حدث، لماذا يهم، من المتورط، وما المتوقّع",\n'
        '"threats":[{"title":"...","severity":"critical|high|medium|low","probability":0-100,"impact":"...","response":"..."}],\n'
        '"opportunities":[{"title":"...","description":"...","action":"..."}],\n'
        '"recommendations":[{"recommendation":"...","priority":"critical|high|medium|low","confidence":0-100,"reason":"...","evidence":"...","estimated_impact":"الأثر المتوقّع","deadline":"خلال X ساعة","owner":"الجهة المسؤولة (إعلام/قانوني/سياسي)","status":"مقترح"}],\n'
        '"questions":["سؤال مقترح 1","سؤال 2","سؤال 3"]\n'
        "}\n\n"
        "أعطِ 2-4 تهديدات، 1-3 فرص، 3-5 توصيات مرتّبة بالأولوية. كل توصية بدليل من المعطيات. "
        "استخدم لغة احتمالية ولا تتّهم أي جهة بالتنسيق أو التمويل كحقيقة (أشر لمراجعة بشرية).\n\n"
        f"المعطيات:\n{facts}"
    )
    cached = await ai_cache.get(SUMMARY_MODEL, prompt)
    if cached is not None:
        return cached
    try:
        import httpx
        async with httpx.AsyncClient() as c:
            r = await c.post("https://api.anthropic.com/v1/messages",
                             headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                                      "content-type": "application/json"},
                             json={"model": SUMMARY_MODEL, "max_tokens": 1600,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=90)
            txt = r.json()["content"][0]["text"]
            out = json.loads(txt[txt.find("{"):txt.rfind("}") + 1])
            await ai_cache.put(SUMMARY_MODEL, prompt, out)
            return out
    except Exception:
        return _EMPTY
