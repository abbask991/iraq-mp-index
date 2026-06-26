"""PPOI AI summary — turns the opinion aggregate into a readable executive read
(what the public appears to think, why, what's changing, what may happen, action).
Strict 'observed digital opinion' framing; rule-based fallback so it's never empty.
"""
import json

from app.config import ANTHROPIC_API_KEY, SUMMARY_MODEL
from app.services import ai_cache


def _fallback(o: dict) -> dict:
    lbl = o["public_opinion_label"]
    return {
        "executive": (f"الرأي الرقمي المرصود تجاه «{o['target']}» {lbl} (مؤشر {o['public_opinion_index']}/100). "
                      f"تأييد {o['support_percent']}% مقابل معارضة {o['oppose_percent']}%، والانفعال الغالب «{o['dominant_emotion']}». "
                      f"ضغط عام {o['public_pressure_index']}/100. (تقدير آلي — تعبير رقمي لا استطلاع تمثيلي.)"),
        "main_reasons": "، ".join(n["narrative"] for n in o["top_narratives"][:3]) or "—",
        "whats_changing": o["forecast"]["expected_direction"],
        "what_may_happen": f"{o['forecast']['expected_direction']} باحتمال {round(o['forecast']['probability']*100)}%",
        "recommended_action": "تجهيز توضيح عاجل" if o["public_pressure_index"] >= 70 else "المتابعة والرصد",
        "fallback": True,
    }


async def summarize(o: dict) -> dict:
    if not ANTHROPIC_API_KEY:
        return _fallback(o)
    facts = (f"الهدف: {o['target']}. مؤشر الرأي {o['public_opinion_index']}/100 ({o['public_opinion_label']}). "
             f"تأييد {o['support_percent']}% / معارضة {o['oppose_percent']}%. ضغط {o['public_pressure_index']}/100. "
             f"انفعال غالب {o['dominant_emotion']}. فجوة إعلام-جمهور {o['media_public_gap']['gap_score']} ({o['media_public_gap']['label']}). "
             f"أبرز الشكاوى: {' | '.join(o['top_complaints'][:3]) or '—'}. "
             f"سرديات: {'، '.join(n['narrative'] for n in o['top_narratives'][:3]) or '—'}. "
             f"التوقّع: {o['forecast']['expected_direction']}.")
    prompt = (
        "أنت محلّل رأي عام رقمي. لخّص الرأي العام المرصود (تعبير رقمي لا استطلاع تمثيلي). أعد JSON فقط بالعربية:\n"
        '{"executive":"3-4 جُمل: ما يبدو أن الجمهور يفكّر به ولماذا","main_reasons":"الأسباب الرئيسية",'
        '"whats_changing":"ما الذي يتغيّر","what_may_happen":"ما قد يحدث","recommended_action":"إجراء مقترح واحد"}\n'
        "لغة احتمالية، استند للمعطيات فقط.\n\n" + facts)
    cached = await ai_cache.get(SUMMARY_MODEL, prompt)
    if cached is not None:
        return cached
    try:
        import httpx
        async with httpx.AsyncClient() as c:
            r = await c.post("https://api.anthropic.com/v1/messages",
                             headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                                      "content-type": "application/json"},
                             json={"model": SUMMARY_MODEL, "max_tokens": 650,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=60)
            txt = r.json()["content"][0]["text"]
            out = json.loads(txt[txt.find("{"):txt.rfind("}") + 1])
            await ai_cache.put(SUMMARY_MODEL, prompt, out)
            return out
    except Exception:
        return _fallback(o)
