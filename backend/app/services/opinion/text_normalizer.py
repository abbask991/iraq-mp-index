"""PPOI text normalization — Iraqi-dialect-aware cleanup so opinions cluster and
classify reliably. Collapses elongation (فااااشل→فاشل), normalizes Arabic letters,
maps emojis to sentiment tokens, expands a few common shorthands, strips URLs/
mentions and tidies hashtags.
"""
import re

from app.services import entity_resolver

_URL = re.compile(r"https?://\S+|www\.\S+|t\.co/\S+")
_MENTION = re.compile(r"@\w+")
_ELONG = re.compile(r"(.)\1{2,}")                      # 3+ repeats → 1
_HASH = re.compile(r"#([\w؀-ۿ_]+)")
_WS = re.compile(r"\s+")

# common emoji → sentiment cue token (helps stance/emotion without breaking text)
_EMOJI = {
    "😂": " سخريه ", "🤣": " سخريه ", "😡": " غضب ", "🤬": " غضب ", "😠": " غضب ",
    "👎": " رفض ", "👍": " تاييد ", "❤": " حب ", "❤️": " حب ", "💔": " خيبه ",
    "😭": " حزن ", "😢": " حزن ", "🔥": " قوه ", "✅": " تاييد ", "❌": " رفض ",
}
# light shorthand expansion (context-safe)
_SHORT = {r"\bالكهربا\b": "الكهرباء", r"\bPM\b": "رئيس الوزراء", r"\bالحكومه\b": "الحكومة"}


def normalize(text: str, *, for_matching: bool = True) -> str:
    t = text or ""
    for e, tok in _EMOJI.items():
        if e in t:
            t = t.replace(e, tok)
    t = _URL.sub(" ", t)
    t = _MENTION.sub(" ", t)
    t = _HASH.sub(lambda m: " " + m.group(1).replace("_", " ") + " ", t)
    for pat, rep in _SHORT.items():
        t = re.sub(pat, rep, t)
    t = _ELONG.sub(r"\1", t)                            # فااااشل → فاشل
    if for_matching:
        t = entity_resolver.normalize_arabic(t)        # unify alef/ya/ta, strip diacritics
    return _WS.sub(" ", t).strip()
