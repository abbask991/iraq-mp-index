"""Stance / position analysis (مؤيد / معارض / محايد / ساخر).

Distinct from sentiment: stance is the *position* a post takes (support vs
oppose), not just its emotional tone. Rule-based Arabic lexicon (incl. Iraqi
dialect) — fast and free; an optional Claude pass can refine low-confidence
cases later. It's an approximation (lexical, not deeply target-aware), surfaced
as an aggregate distribution for a topic/entity.
"""
from app.services import entity_resolver

STANCES = ["support", "oppose", "neutral", "sarcastic"]

_LEX = {
    "support": ["ندعم", "نؤيد", "مؤيد", "مع", "بطل", "نزيه", "صادق", "انجاز", "احسنت",
                "نثق", "ثقه", "وفاء", "تحيه", "يحفظه", "الله يحفظ", "نفتخر", "رائع", "ممتاز",
                "شكرا", "احسنتم", "موفق", "نساندك", "وياك"],
    "oppose": ["نرفض", "ضد", "يسقط", "فاسد", "فساد", "خيانه", "فاشل", "حرامي", "عار",
               "نندد", "ارحل", "استقيل", "استقاله", "كذاب", "لص", "محتل", "عميل", "مرفوض",
               "فضيحه", "خاين", "حقير", "ندين", "يلعن", "ما نريده", "طوله"],
    "sarcastic": ["هههه", "ههههه", "طبعا", "ياريت", "اكيد", "يا سلام", "برافو", "احسنت يا",
                  "شكله", "تصدق", "ما شاء الله", "بطل زمانه", "عاشت ايدك"],
}
_LEX_NORM = {k: [entity_resolver.normalize_arabic(w) for w in ws] for k, ws in _LEX.items()}


def _scores(text: str) -> dict:
    norm = entity_resolver.normalize_arabic(text)
    return {k: sum(norm.count(w) for w in ws) for k, ws in _LEX_NORM.items()}


def classify_stance(text: str) -> dict:
    """Return {stance, confidence}. Sarcasm overrides (it flips apparent support)."""
    s = _scores(text)
    total = sum(s.values())
    if total == 0:
        return {"stance": "neutral", "confidence": 0.0}
    if s["sarcastic"] >= 1 and s["sarcastic"] >= max(s["support"], s["oppose"]):
        return {"stance": "sarcastic", "confidence": round(s["sarcastic"] / total, 2)}
    top = max(("support", "oppose"), key=lambda k: s[k])
    if s[top] == 0:
        return {"stance": "neutral", "confidence": 0.0}
    return {"stance": top, "confidence": round(s[top] / total, 2)}


def aggregate(texts: list[str]) -> dict:
    """Distribution of stances across many texts (percent + raw + dominant)."""
    counts = {k: 0 for k in STANCES}
    for t in texts:
        counts[classify_stance(t)["stance"]] += 1
    total = sum(counts.values()) or 1
    pct = {k: round(counts[k] / total * 100) for k in STANCES}
    dominant = max(STANCES, key=lambda k: counts[k])
    # a simple net position index: support − oppose, −100..100
    net = round((counts["support"] - counts["oppose"]) / total * 100)
    return {"counts": counts, "pct": pct, "dominant": dominant, "net": net,
            "explain": "تحليل لغوي للموقف (مؤيد/معارض/ساخر) — تقدير لغوي تكميلي للنبرة."}
