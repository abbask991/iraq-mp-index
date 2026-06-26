"""PPOI opinion detection — separate OPINION from fact/news/question/ad/spam so
only genuine public expression drives the opinion scores. Rule-first (fast/free);
an AI pass can refine low-confidence items later.
"""
from app.services import stance
from app.services.opinion.text_normalizer import normalize

_OPINION_TYPES = {"opinion", "complaint", "praise", "satire"}

_FACT = ["اعلن", "اعلنت", "صرح", "صرحت", "قال", "قالت", "وقع", "وقعت", "افتتح", "اطلق",
         "اصدر", "بحسب", "وفقا", "ذكرت", "نقلت", "كشف", "اكد رسميا", "بيان", "خبر عاجل", "عاجل"]
_QUESTION = ["كيف", "شلون", "ليش", "متى", "وين", "هل", "ايش", "شنو", "؟"]
_AD = ["عرض", "خصم", "تخفيض", "اشترك", "تابعونا", "للطلب", "للحجز", "رابط الشراء", "كود خصم", "اعلان ممول"]
_SPAM = ["تابعني", "follow", "ربح", "اربح", "جايزه", "click", "اضغط هنا", "زياره صفحتي"]

_NEG = ["فاشل", "سيء", "فساد", "زفت", "خراب", "كذب", "مقطوعه", "تأخير", "ماكو", "نرفض", "يسقط", "حرامي"]
_POS = ["ممتاز", "رائع", "شكرا", "احسنتم", "نجاح", "انجاز", "ندعم", "نؤيد", "افضل", "بطل"]


def detect(text: str) -> dict:
    norm = normalize(text or "")
    if not norm:
        return {"is_opinion": False, "opinion_type": "irrelevant", "confidence": 0.0}

    def has(words):
        return sum(1 for w in words if w in norm)

    spam, ad, fact, q = has(_SPAM), has(_AD), has(_FACT), has(_QUESTION)
    neg, pos = has(_NEG), has(_POS)
    st = stance.classify_stance(text or "")
    stance_strength = st["confidence"] if st["stance"] in ("support", "oppose", "sarcastic") else 0

    # priority: spam/ad → not opinion; strong opinion words → opinion; question; fact
    if spam >= 1 and neg + pos == 0:
        return {"is_opinion": False, "opinion_type": "spam", "confidence": round(min(1, spam / 2), 2)}
    if ad >= 1 and neg + pos == 0:
        return {"is_opinion": False, "opinion_type": "advertisement", "confidence": round(min(1, ad / 2), 2)}
    if st["stance"] == "sarcastic":
        return {"is_opinion": True, "opinion_type": "satire", "confidence": st["confidence"]}
    if neg >= 1 and neg >= pos:
        return {"is_opinion": True, "opinion_type": "complaint", "confidence": round(min(1, 0.5 + neg * 0.2), 2)}
    if pos >= 1:
        return {"is_opinion": True, "opinion_type": "praise", "confidence": round(min(1, 0.5 + pos * 0.2), 2)}
    if q >= 1 and fact == 0:
        return {"is_opinion": False, "opinion_type": "question", "confidence": 0.6}
    if fact >= 1:
        return {"is_opinion": False, "opinion_type": "fact", "confidence": round(min(1, 0.5 + fact * 0.2), 2)}
    if stance_strength >= 0.3:
        return {"is_opinion": True, "opinion_type": "opinion", "confidence": round(stance_strength, 2)}
    return {"is_opinion": False, "opinion_type": "irrelevant", "confidence": 0.3}


def is_opinion(text: str) -> bool:
    return detect(text)["opinion_type"] in _OPINION_TYPES
