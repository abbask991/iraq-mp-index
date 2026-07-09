"""Arabic/Iraqi anger lexicons + local (no-AI) scoring primitives.

These power the default classification path so PAI runs cheaply and keeps working
when paid AI is down. Text is normalised (diacritics stripped, ة→ه, أإآ→ا …) so
lexicon words match real-world spelling variants.
"""
import re

_DIAC = re.compile(r"[ؗ-ًؚ-ْٰـ]")
_NONWORD = re.compile(r"[^\w؀-ۿ]+")


def norm(s: str) -> str:
    s = (s or "").lower()
    s = _DIAC.sub("", s)
    for a, b in (("ة", "ه"), ("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ى", "ي"), ("ؤ", "و"), ("ئ", "ي")):
        s = s.replace(a, b)
    return s


def _nw(words) -> set:
    return {norm(w) for w in words}


def tokens(s: str) -> list:
    return [t for t in _NONWORD.split(norm(s)) if t]


# ── lexicons (normalised sets) ───────────────────────────────────────────────
ANGER = _nw({
    "غاضب", "غضب", "غاضبين", "زعل", "زعلان", "قهر", "مقهور", "سخط", "استياء", "محبط",
    "احباط", "قرف", "مقرف", "خزي", "عار", "فضيحه", "فضايح", "مهزله", "مأساه", "كارثه",
    "حرام", "ذل", "اذلال", "معيب", "مقزز", "يكفي", "اكتفينا", "شبعنا", "طفح", "زهقنا",
    "مليت", "تعبنا", "حقد", "كره", "نكره", "خساره", "ينلعن", "لعنه", "تفو", "عيب",
})
COMPLAINT = _nw({
    "كهرباء", "الكهرباء", "ماء", "الماي", "مي", "رواتب", "راتب", "بطاله", "عاطل", "غلاء",
    "اسعار", "فساد", "فاسد", "خدمات", "وقود", "بنزين", "نفط", "ايجار", "رسوم", "مقطوعه",
    "انقطاع", "مشكله", "مشاكل", "شكوى", "شكوه", "تردي", "سوء", "فشل", "فاشل", "مقصر",
    "تقصير", "وعود", "كذب", "سرقه", "حرامي", "حراميه", "محاصصه", "بلا خدمات", "ماكو",
})
PROTEST = _nw({
    "تظاهر", "مظاهره", "تظاهرات", "اعتصام", "اضراب", "مقاطعه", "ننزل", "نطلع", "نتحرك",
    "قطع طريق", "ثوره", "انتفاضه", "تحرك", "التحرير", "الى الشارع", "انزلوا", "اطلعوا",
    "لازم نطلع", "وين الشعب", "خلي نكسر", "عصيان",
})
NEG_EXTRA = _nw({
    "سيء", "سيئه", "رديء", "خايب", "تعبان", "مو زين", "بلا فايده", "خيبه", "ضد", "رفض",
    "نرفض", "استقاله", "ارحل", "برا", "ماخذ", "فشلتوا", "خربتوها",
})
# sarcasm markers are checked on RAW text (emojis survive), not normalised
SARC_RAW = ("😂", "🤣", "🙄", "👏", "😏", "ههه", "هههه", "برافو", "عاش الفساد",
            "شكرا للحكومه", "يعطيكم العافيه", "احسنتم", "عاشت الايادي")

NEGATIVE = ANGER | COMPLAINT | NEG_EXTRA


def _hit_ratio(items: list, wordset: set) -> float:
    """Fraction of items whose text contains ≥1 word from the set, with a mild
    boost for items that hit multiple words (intensity)."""
    if not items:
        return 0.0
    total = 0.0
    for it in items:
        toks = set(tokens(it.get("text", "")))
        hits = len(toks & wordset)
        if hits:
            total += 1.0 + min(hits - 1, 3) * 0.15   # up to +45% for dense hits
    return total / len(items)


def has_sarcasm(raw_text: str) -> bool:
    t = (raw_text or "")
    return any(m in t for m in SARC_RAW)


def scale(x: float, ceiling: float = 0.6) -> int:
    """Map a 0..1 hit-ratio onto 0..100 with a ceiling so realistic ratios
    (rarely 100% of items) still reach high scores."""
    return max(0, min(100, round((x / ceiling) * 100)))
