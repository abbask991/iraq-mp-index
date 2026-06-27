"""Disinformation & manipulation assessment. For a pasted claim/post (or topic),
combines (a) an AI credibility analysis — manipulation markers, AI-generation
likelihood, verifiability, factual plausibility — with (b) the real spread
pattern — is it pushed by a coordinated/bot network? — into one disinformation
risk score with reasoning. Probabilistic decision-support, never a verdict of
fact."""
import json

import httpx

from app.config import ANTHROPIC_API_KEY, SUMMARY_MODEL
from app.services import x
from app.services.campaign import detector as campaign
from app.services.collection import dedup
from app.services.media_battlefield.battlefield_summary import _extract_json

_AR_STOP_LEN = 4


def _query(text: str) -> str:
    toks = [w for w in dedup.tokens(text) if len(w) >= _AR_STOP_LEN]
    return " OR ".join(toks[:4]) + " lang:ar" if toks else (text[:60] + " lang:ar")


async def _ai_assess(text: str) -> dict:
    fallback = {"credibility_risk": 50, "ai_generated_likelihood": 0, "verifiability": "غير محدّد",
                "manipulation_signals": [], "red_flags": [], "verdict": "غير محدّد",
                "factual_assessment": "", "recommendation": "يتطلّب تحقّقاً بشرياً."}
    if not ANTHROPIC_API_KEY:
        return fallback
    prompt = (
        "أنت خبير في كشف التضليل الإعلامي والمحتوى المُولّد آلياً. حلّل النص أدناه بموضوعية. "
        "أعد كائن JSON واحداً فقط دون أي نص خارجه، بالعربية:\n"
        '{"credibility_risk":0-100,"ai_generated_likelihood":0-100,'
        '"verifiability":"قابل للتحقق|صعب التحقق|غير قابل للتحقق",'
        '"manipulation_signals":["إثارة عاطفية","استعجال","غياب مصدر",...],'
        '"red_flags":["..."],"verdict":"موثوق نسبياً|مشبوه|تضليل محتمل",'
        '"factual_assessment":"تقييم موجز لمدى معقولية الادعاء","recommendation":"خطوة تحقّق عملية"}\n'
        "كن محايداً: لا تصنّف رأياً مشروعاً كتضليل، ولا تجزم بالكذب دون دليل. استخدم لغة احتمالية.\n\n"
        f"النص:\n«{text[:1500]}»"
    )
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post("https://api.anthropic.com/v1/messages",
                             headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                                      "content-type": "application/json"},
                             json={"model": SUMMARY_MODEL, "max_tokens": 800,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=50)
            out = _extract_json(r.json()["content"][0]["text"])
            return {**fallback, **out} if out else fallback
    except Exception:
        return fallback


async def assess(text: str, rng: str = "week") -> dict:
    text = (text or "").strip()
    if len(text) < 8:
        return {"error": "SHORT", "message": "الصق نصّاً أو ادّعاءً أطول للتحليل."}

    ai = await _ai_assess(text)

    # real spread pattern — is a coordinated/bot network pushing it?
    coord, susp_ratio, spread_posts = 0, 0.0, 0
    try:
        tw = await x.fetch_trend(_query(text), want=160, range=rng)
        tweets, users = tw.get("tweets", []), tw.get("users", {})
        spread_posts = len(tweets)
        if spread_posts >= 5:
            camp = campaign.detect(text[:40], tweets, users, 0)
            coord = camp.get("coordination_score", 0)
            susp_ratio = camp.get("suspicious_account_ratio", 0)
    except Exception:
        pass

    ai_risk = ai.get("credibility_risk", 50)
    spread_risk = min(100, coord * 0.7 + susp_ratio * 100 * 0.6)
    # if there IS coordinated spread, it sharply raises disinfo risk; otherwise AI dominates
    final = round(0.6 * ai_risk + 0.4 * spread_risk) if spread_posts >= 5 else ai_risk
    final = max(0, min(100, final))
    band = ("تضليل عالي الاحتمال" if final >= 65 else "مشبوه — يحتاج تحقّق" if final >= 40
            else "منخفض المخاطر")

    return {
        "disinfo_risk": final, "band": band,
        "ai": ai,
        "spread": {"coordination_score": coord, "suspicious_ratio": round(susp_ratio, 2),
                   "posts_analyzed": spread_posts,
                   "note": ("يُنشر بنمط منسّق" if coord >= 45 else "انتشار يبدو طبيعياً" if spread_posts >= 5 else "لا انتشار كافٍ للقياس")},
        "disclaimer": "تقييم احتمالي آلي لدعم القرار — ليس حكماً قاطعاً بالصحّة أو الكذب، ويتطلّب تحقّقاً بشرياً.",
    }
