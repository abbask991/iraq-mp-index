"""Preprocess collected items (§11 steps 3–4): dedup + drop spam/low-quality.

Returns (clean_items, dup_ratio) — dup_ratio feeds the confidence score.
"""
from app.services.indices.public_anger import lexicons as lx

_SPAM = lx._nw({"اشترك", "تابعنا", "رابط بالبايو", "للاعلان", "تسويق", "متجر", "خصم", "عرض خاص"})


def clean(items: list) -> tuple[list, float]:
    seen = set()
    out = []
    dups = 0
    for it in items:
        text = (it.get("text") or "").strip()
        toks = lx.tokens(text)
        if len(toks) < 2:
            continue
        if set(toks) & _SPAM:
            continue
        key = " ".join(toks[:12])          # near-dup key on normalised prefix
        if key in seen:
            dups += 1
            continue
        seen.add(key)
        out.append(it)
    total = len(out) + dups
    dup_ratio = (dups / total) if total else 0.0
    return out, round(dup_ratio, 3)
