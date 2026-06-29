"""Comment Intelligence pipeline (spec §1 + §19).

Stage 1 (NO AI — runs always, even with zero credits):
    dedupe → cluster near-duplicates → pick representatives → frequency-based
    repeated-phrase detection → public-pressure & coordination signals.
Stage 2 (AI — only on the representatives, so cost ~drops with cluster ratio):
    semantic extraction (complaints/demands/accusations/praise/sarcasm/anger/...).
    Handled by facebook_insights.deep_insights; this module prepares its input and
    merges the non-AI signals so the card is useful even when AI is unavailable.

The whole point: never send 500 raw comments to AI. Send ~40 representatives that
cover the same opinion space, and keep the cluster sizes as the "how many people
said this" weight.
"""
import re
from collections import Counter

_AR_DIAC = re.compile(r"[ؐ-ًؚ-ْٰـ]")  # harakat + tatweel
_PUNCT = re.compile(r"[^\w؀-ۿ\s]")
_WS = re.compile(r"\s+")
# light Iraqi/MSA stopwords so clustering keys on meaning, not filler
_STOP = {"في", "من", "على", "الى", "إلى", "عن", "مع", "هذا", "هذه", "ذلك", "التي", "الذي",
         "ان", "أن", "إن", "كان", "قد", "ما", "لا", "يا", "و", "او", "أو", "بس", "هاي",
         "هاذا", "شنو", "ليش", "اكو", "ماكو", "هم", "هي", "هو", "انت", "انا", "كل", "بعد"}
# crude anger/negation lexicon for an OFFLINE pressure estimate (AI does the real read)
_ANGER = {"فاشل", "فاشلة", "حرامي", "حرامية", "فساد", "فاسد", "كذب", "كذاب", "خراب", "خربانة",
          "عار", "فضيحة", "لصوص", "سراق", "نصب", "غضب", "زفت", "خنزير", "كلاب", "حقير"}


def _norm(t: str) -> str:
    t = _AR_DIAC.sub("", t or "")
    t = t.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي")
    t = _PUNCT.sub(" ", t)
    return _WS.sub(" ", t).strip().lower()


def _tokens(t: str) -> set:
    return {w for w in _norm(t).split() if w not in _STOP and len(w) > 1}


def _jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def cluster(texts: list, sim: float = 0.62, cap: int = 600) -> list[dict]:
    """Greedy near-duplicate clustering. Returns clusters sorted by size desc:
    [{representative, size, samples:[..]}]. O(n·k) where k = #clusters (bounded)."""
    items = []
    seen_exact = set()
    for t in texts[:cap]:
        n = _norm(t)
        if len(n) < 2:
            continue
        items.append((t, n, _tokens(t)))
    clusters: list[dict] = []
    for raw, n, toks in items:
        placed = False
        for c in clusters:
            if n == c["_norm"] or _jaccard(toks, c["_toks"]) >= sim:
                c["size"] += 1
                if len(raw) > len(c["representative"]):       # keep the richest wording
                    c["representative"], c["_toks"], c["_norm"] = raw, toks, n
                if len(c["samples"]) < 3:
                    c["samples"].append(raw[:160])
                placed = True
                break
        if not placed:
            clusters.append({"representative": raw, "size": 1, "samples": [raw[:160]],
                             "_toks": toks, "_norm": n})
    clusters.sort(key=lambda c: -c["size"])
    for c in clusters:
        c.pop("_toks", None)
        c.pop("_norm", None)
    return clusters


def representatives(clusters: list[dict], cap: int = 45) -> list[str]:
    """One representative per cluster (largest first), capped for the AI budget."""
    return [c["representative"] for c in clusters[:cap]]


def repeated_phrases(clusters: list[dict], min_size: int = 2, top: int = 8) -> list[dict]:
    """Clusters with ≥min_size members = the SAME thing said many times → repeated
    talking points / possible coordination. NO AI — pure frequency."""
    out = [{"phrase": c["representative"][:140], "count": c["size"]}
           for c in clusters if c["size"] >= min_size]
    return out[:top]


def keyword_phrases(texts: list, top: int = 10) -> list[dict]:
    """Most frequent meaningful 2-grams across all comments (offline trend signal)."""
    grams = Counter()
    for t in texts:
        toks = [w for w in _norm(t).split() if w not in _STOP and len(w) > 1]
        for i in range(len(toks) - 1):
            grams[toks[i] + " " + toks[i + 1]] += 1
    return [{"phrase": g, "count": c} for g, c in grams.most_common(top) if c >= 3]


def pressure_level(texts: list, clusters: list[dict]) -> dict:
    """Public-pressure estimate (0–100) WITHOUT AI: blends raw comment volume,
    how concentrated/repeated the messaging is, and a crude anger-lexicon hit-rate.
    A real sarcasm/anger read still needs the AI layer — this is the floor."""
    n = len(texts)
    if n == 0:
        return {"score": 0, "volume": 0, "repetition_ratio": 0.0, "anger_hits": 0}
    repeated = sum(c["size"] for c in clusters if c["size"] >= 2)
    repetition_ratio = round(repeated / n, 2)
    anger_hits = sum(1 for t in texts if _tokens(t) & _ANGER)
    anger_ratio = anger_hits / n
    volume_score = min(60, n / 5)                     # 300+ comments saturates volume
    score = round(min(100, volume_score + repetition_ratio * 20 + anger_ratio * 60))
    return {"score": score, "volume": n, "repetition_ratio": repetition_ratio,
            "anger_hits": anger_hits, "anger_ratio": round(anger_ratio, 2)}


def prepare(texts: list) -> dict:
    """Full Stage-1 (no-AI) output + the representative set to feed the AI layer."""
    texts = [t for t in (texts or []) if t and len(t.strip()) > 1]
    cl = cluster(texts)
    return {
        "total_comments": len(texts),
        "clusters": len(cl),
        "dedup_ratio": round(1 - (len(cl) / len(texts)), 2) if texts else 0.0,
        "representatives": representatives(cl),
        "repeated_phrases": repeated_phrases(cl),
        "keyword_phrases": keyword_phrases(texts),
        "pressure": pressure_level(texts, cl),
    }
