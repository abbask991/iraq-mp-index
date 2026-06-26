"""AI executive summary of the battlefield + recommended actions. Probabilistic
language; coordination/funding always flagged for human review."""
import json
import re

from app.config import ANTHROPIC_API_KEY, SUMMARY_MODEL
from app.services import ai_cache


def _extract_json(txt: str):
    """Robustly pull a JSON object out of an LLM reply. Newer models often wrap
    it in a ```json fence or add a markdown preamble — handle both, then fall back
    to balanced-brace scanning. Returns dict or None."""
    if not txt:
        return None
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", txt, re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    start = txt.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(txt)):
            if txt[i] == "{":
                depth += 1
            elif txt[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(txt[start:i + 1])
                    except Exception:
                        break
    return None


async def summarize(facts: str) -> dict:
    """Returns {summary, recommended_actions:[...]}."""
    empty = {"summary": "", "recommended_actions": []}
    if not ANTHROPIC_API_KEY:
        return empty
    prompt = (
        "أنت محلّل في غرفة عمليات إعلامية. بناءً على المعطيات أدناه، اكتب موجزاً "
        "تنفيذياً (4-6 جُمل) يصف الموقف وميزان القوى، ثم توصيات عملية. "
        "استخدم لغة احتمالية (مؤشرات/يُحتمل) ولا تتّهم أي جهة بالتنسيق أو التمويل كحقيقة — أشر إلى الحاجة لمراجعة بشرية.\n"
        "أعد كائن JSON واحداً فقط، دون أي مقدمة أو عناوين أو نص أو أسوار شيفرة خارج JSON، وبالعربية، بالشكل:\n"
        '{"summary":"...", "recommended_actions":["توصية 1","توصية 2","توصية 3"]}\n\n'
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
                             json={"model": SUMMARY_MODEL, "max_tokens": 1400,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=60)
            txt = r.json()["content"][0]["text"]
            out = _extract_json(txt)
            if not out:
                # last resort: don't lose the analysis — show the prose as the summary
                clean = re.sub(r"```[a-z]*|```|[{}]", " ", txt).strip()
                out = {"summary": clean[:600], "recommended_actions": []}
            await ai_cache.put(SUMMARY_MODEL, prompt, out)
            return out
    except Exception:
        return empty
