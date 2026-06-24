"""Emotion classification (optional layer on top of pos/neg/neutral sentiment).

Emotions: anger, fear, trust, joy, sadness, frustration, disgust, sarcasm.
Rule-based Arabic lexicon first (free, instant); Claude (Haiku) is consulted ONLY
when the lexicon is unconfident — keeping cost near zero on the common path.
"""
import json

from app.services import entity_resolver

EMOTIONS = ["anger", "fear", "trust", "joy", "sadness", "frustration", "disgust", "sarcasm"]

# normalized Arabic cue lexicon per emotion (extend freely)
_LEX = {
    "anger": ["غاضب", "غضب", "نندد", "ندين", "استنكار", "خيانه", "عار", "مرفوض", "يسقط", "فضيحه", "ارهاب"],
    "fear": ["خطر", "تهديد", "خوف", "قلق", "تحذير", "كارثه", "ازمه", "انهيار", "حرب"],
    "trust": ["نثق", "ثقه", "ندعم", "ندعمه", "بطل", "وفاء", "صادق", "نزيه", "انجاز", "شكرا"],
    "joy": ["فرح", "نجاح", "تهنئه", "مبروك", "فوز", "سعداء", "بشري", "احتفال"],
    "sadness": ["حزن", "مؤسف", "خساره", "وفاه", "استشهاد", "دموع", "ماساه", "مظلوم"],
    "frustration": ["احباط", "تعب", "يائس", "مليت", "زهق", "بلا فايده", "نفس الكلام", "وعود", "متي"],
    "disgust": ["قرف", "مقرف", "نتانه", "فساد", "وسخ", "حقير", "انحطاط"],
    "sarcasm": ["هههه", "طبعا", "ياريت", "اكيد", "بالطبع", "شكله", "يا سلام", "برافو", "احسنت يا"],
}
_LEX_NORM = {emo: [entity_resolver.normalize_arabic(w) for w in ws] for emo, ws in _LEX.items()}

_CONF_THRESHOLD = 0.34          # below this → ask Claude


def _rule_scores(text: str) -> dict:
    norm = entity_resolver.normalize_arabic(text)
    raw = {emo: sum(norm.count(w) for w in ws) for emo, ws in _LEX_NORM.items()}
    total = sum(raw.values())
    if total == 0:
        return {e: 0.0 for e in EMOTIONS}
    return {e: round(raw[e] / total, 3) for e in EMOTIONS}


def _top(scores: dict):
    emo = max(scores, key=scores.get)
    return emo, scores[emo]


async def _ai_emotion(text: str) -> dict | None:
    """Single low-confidence text → Claude Haiku emotion JSON (best-effort)."""
    import httpx

    from app.config import ANTHROPIC_API_KEY, CLASSIFY_MODEL
    if not ANTHROPIC_API_KEY:
        return None
    prompt = (
        "صنّف المشاعر السائدة في النص العربي التالي. أعد JSON فقط: "
        '{"top":"<anger|fear|trust|joy|sadness|frustration|disgust|sarcasm>",'
        '"confidence":0..1}.\n\nالنص: ' + text[:400]
    )
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post("https://api.anthropic.com/v1/messages",
                             headers={"x-api-key": ANTHROPIC_API_KEY,
                                      "anthropic-version": "2023-06-01",
                                      "content-type": "application/json"},
                             json={"model": CLASSIFY_MODEL, "max_tokens": 60,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=30)
            txt = r.json()["content"][0]["text"]
            d = json.loads(txt[txt.find("{"):txt.rfind("}") + 1])
            if d.get("top") in EMOTIONS:
                return d
    except Exception:
        pass
    return None


async def classify_emotion(text: str, language: str = "ar") -> dict:
    """Returns {top, confidence, scores, method}. Rule-first, Claude fallback."""
    scores = _rule_scores(text)
    emo, conf = _top(scores)
    if conf >= _CONF_THRESHOLD:
        return {"top": emo, "confidence": conf, "scores": scores, "method": "rule"}
    ai = await _ai_emotion(text)
    if ai:
        return {"top": ai["top"], "confidence": round(float(ai.get("confidence", 0.5)), 2),
                "scores": scores, "method": "ai"}
    return {"top": emo if conf > 0 else "neutral", "confidence": conf, "scores": scores, "method": "rule"}


def aggregate(texts: list[str]) -> dict:
    """Cheap rule-only distribution across many texts (for dashboards)."""
    dist = {e: 0.0 for e in EMOTIONS}
    for t in texts:
        emo, conf = _top(_rule_scores(t))
        if conf > 0:
            dist[emo] += 1
    total = sum(dist.values()) or 1
    return {e: round(dist[e] / total * 100) for e in EMOTIONS}
