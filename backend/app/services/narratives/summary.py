"""Narrative Intelligence Summary — AI executive summary per narrative.

Strict probability language. Never asserts that a person/org created or
coordinated a narrative as fact — only "likely / possible / إشارة عالية الثقة /
يتطلّب مراجعة بشرية", and every conclusion is paired with evidence + confidence.
"""
import json

from app.config import ANTHROPIC_API_KEY, SUMMARY_MODEL
from app.services import ai_cache

_EMPTY = {"executive": "", "main_idea": "", "status": "", "who_created": "",
          "who_amplifies": "", "who_benefits": "", "who_harmed": "",
          "risk": "", "recommendation": "", "confidence": 0, "evidence": []}


async def summarize(facts: str) -> dict:
    if not ANTHROPIC_API_KEY:
        return dict(_EMPTY)
    prompt = (
        "أنت كبير محلّلي السرديات في غرفة عمليات استخبارات إعلامية. بناءً على المعطيات أدناه عن سردية واحدة، "
        "أنتج تحليلاً استخباراتياً موجزاً ومحدّداً. أعد JSON فقط بالعربية بهذا الشكل:\n"
        '{"executive":"موجز تنفيذي (3-4 جُمل)",'
        '"main_idea":"الفكرة الجوهرية للسردية بجملة",'
        '"status":"الحالة الحالية: ناشئة/نامية/مهيمنة/منحسرة",'
        '"who_created":"تقييم احتمالي لمصدر السردية (مع لغة احتمالية فقط)",'
        '"who_amplifies":"من يضخّمها (حسابات/إعلام/مؤثرون)",'
        '"who_benefits":"الجهة المستفيدة",'
        '"who_harmed":"الجهة المتضرّرة",'
        '"risk":"تقييم الخطر وسبب نموّها",'
        '"recommendation":"توصية عملية واحدة",'
        '"confidence":0-100,'
        '"evidence":["دليل 1","دليل 2"]}\n'
        "قواعد صارمة: لا تنسب إنشاء أو تنسيق السردية لأي شخص أو جهة كحقيقة قاطعة — استخدم «يُحتمل/مؤشر/إشارة عالية الثقة/"
        "يتطلّب مراجعة بشرية». كل استنتاج يجب أن يقترن بدليل.\n\n"
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
                             json={"model": SUMMARY_MODEL, "max_tokens": 900,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=70)
            txt = r.json()["content"][0]["text"]
            out = json.loads(txt[txt.find("{"):txt.rfind("}") + 1])
            merged = {**_EMPTY, **out}
            await ai_cache.put(SUMMARY_MODEL, prompt, merged)
            return merged
    except Exception:
        return dict(_EMPTY)
