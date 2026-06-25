"""AI executive summary of the battlefield + recommended actions. Probabilistic
language; coordination/funding always flagged for human review."""
import json

from app.config import ANTHROPIC_API_KEY, SUMMARY_MODEL
from app.services import ai_cache


async def summarize(facts: str) -> dict:
    """Returns {summary, recommended_actions:[...]}."""
    empty = {"summary": "", "recommended_actions": []}
    if not ANTHROPIC_API_KEY:
        return empty
    prompt = (
        "أنت محلّل في غرفة عمليات إعلامية. بناءً على معطيات «ساحة المعركة الإعلامية» أدناه، اكتب موجزاً "
        "تنفيذياً (4-6 جُمل) يصف: من يهاجم ومن يدعم، السردية الرئيسية، من يضخّمها، وميزان القوى (ضغط الهجوم مقابل "
        "قوة الدعم)، ثم توصيات عملية. أعد JSON فقط بالعربية:\n"
        '{"summary":"...", "recommended_actions":["توصية 1","توصية 2","توصية 3"]}\n'
        "استخدم لغة احتمالية (مؤشرات/يُحتمل) ولا تتّهم أي جهة بالتنسيق أو التمويل كحقيقة — أشر إلى الحاجة لمراجعة بشرية.\n\n"
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
                             json={"model": SUMMARY_MODEL, "max_tokens": 700,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=60)
            txt = r.json()["content"][0]["text"]
            out = json.loads(txt[txt.find("{"):txt.rfind("}") + 1])
            await ai_cache.put(SUMMARY_MODEL, prompt, out)
            return out
    except Exception:
        return empty
