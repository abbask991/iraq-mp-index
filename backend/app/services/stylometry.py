"""Stylometric analysis (#7) — author/organization fingerprinting.

Goes beyond text similarity: profiles *how* something is written — sentence
length, vocabulary richness, emoji/punctuation habits, function-word usage,
character n-grams, repetition. Two posts with different words but the same
"hand" score as likely-same-author — the signal that exposes a sockpuppet farm.
"""
import math
import re
from collections import Counter

_WORD = re.compile(r"[^\W\d_]+", re.U)
_EMOJI = re.compile("[\U0001F000-\U0001FAFF\U00002600-\U000027BF]")
_PUNCT = "،.؛:!؟?…\"'()-"
# common Arabic function words — style markers, not topic markers
_FUNC = ["في", "من", "على", "الى", "إلى", "عن", "مع", "هذا", "هذه", "ذلك", "التي",
         "الذي", "ان", "أن", "إن", "قد", "كل", "بعد", "قبل", "حتى", "ثم", "لكن",
         "او", "أو", "و", "يا", "ما", "لا", "هو", "هي", "كان", "هناك"]


def fingerprint(text: str) -> dict:
    """Compact style vector for one piece of text."""
    t = text or ""
    words = _WORD.findall(t)
    n = len(words) or 1
    sentences = [s for s in re.split(r"[.!؟?\n]+", t) if s.strip()]
    avg_sent = (sum(len(_WORD.findall(s)) for s in sentences) / len(sentences)) if sentences else n
    ttr = len(set(words)) / n                                   # type-token ratio
    emoji_rate = len(_EMOJI.findall(t)) / n
    punct = Counter(c for c in t if c in _PUNCT)
    punct_rate = sum(punct.values()) / max(1, len(t))
    func = Counter(w for w in words if w in _FUNC)
    func_dist = {w: round(func.get(w, 0) / n, 3) for w in _FUNC}
    # char trigram profile (top, normalized)
    tri = Counter(t[i:i + 3] for i in range(len(t) - 2) if t[i:i + 3].strip())
    tri_total = sum(tri.values()) or 1
    tri_prof = {g: c / tri_total for g, c in tri.most_common(30)}
    repetition = 1 - ttr
    return {
        "avg_sentence_len": round(avg_sent, 2),
        "vocab_richness": round(ttr, 3),
        "emoji_rate": round(emoji_rate, 3),
        "punct_rate": round(punct_rate, 3),
        "repetition": round(repetition, 3),
        "func_dist": func_dist,
        "tri_prof": tri_prof,
        "tokens": n,
    }


def _cosine(a: dict, b: dict):
    keys = set(a) | set(b)
    dot = sum(a.get(k, 0) * b.get(k, 0) for k in keys)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0 and nb == 0:       # both vectors all-zero → identical in this dimension
        return 1.0
    return dot / (na * nb) if na and nb else 0.0


def same_author_probability(fp_a: dict, fp_b: dict) -> float:
    """0..1 likelihood two fingerprints share an author/organization."""
    if not fp_a or not fp_b:
        return 0.0
    def scalar_sim(x, y, scale):
        return max(0.0, 1 - abs(x - y) / scale)
    parts = [
        (0.15, scalar_sim(fp_a["avg_sentence_len"], fp_b["avg_sentence_len"], 25)),
        (0.10, scalar_sim(fp_a["vocab_richness"], fp_b["vocab_richness"], 1)),
        (0.10, scalar_sim(fp_a["emoji_rate"], fp_b["emoji_rate"], 0.5)),
        (0.10, scalar_sim(fp_a["punct_rate"], fp_b["punct_rate"], 0.2)),
        (0.25, _cosine(fp_a["func_dist"], fp_b["func_dist"])),
        (0.30, _cosine(fp_a["tri_prof"], fp_b["tri_prof"])),
    ]
    return round(sum(w * s for w, s in parts), 3)


def cluster_authors(posts, threshold=0.82):
    """Greedy-group posts by style; flag clusters that likely share a hand."""
    fps = [(i, fingerprint(p.get("text") or p.get("title") or "")) for i, p in enumerate(posts)]
    fps = [(i, f) for i, f in fps if f["tokens"] >= 4]
    clusters = []
    for i, f in fps:
        placed = False
        for c in clusters:
            if same_author_probability(f, c["centroid"]) >= threshold:
                c["members"].append(i)
                placed = True
                break
        if not placed:
            clusters.append({"centroid": f, "members": [i]})
    suspected = [{"size": len(c["members"]), "members": c["members"]}
                 for c in clusters if len(c["members"]) >= 3]
    suspected.sort(key=lambda c: -c["size"])
    return {"clusters": len(clusters), "suspected_same_author_groups": suspected,
            "explain": "بصمة الأسلوب: تجميع المنشورات حسب طريقة الكتابة لكشف حسابات بنفس اليد."}
