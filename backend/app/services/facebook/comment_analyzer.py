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
def _norm(t: str) -> str:
    t = _AR_DIAC.sub("", t or "")
    t = t.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي")
    t = _PUNCT.sub(" ", t)
    return _WS.sub(" ", t).strip().lower()


def _tokens(t: str) -> set:
    return {w for w in _norm(t).split() if w not in _STOP and len(w) > 1}


def _nw(words: set) -> set:
    """Normalize single-word lexicon entries so they match normalized tokens."""
    return {_norm(w) for w in words if _norm(w) and " " not in _norm(w)}


# anger/negation lexicon — OFFLINE pressure estimate + AI-down fallback (normalized)
_ANGER = _nw({"فاشل", "فاشلة", "فاشلين", "حرامي", "حرامية", "فساد", "فاسد", "كذب", "كذاب",
              "خراب", "خربانة", "عار", "فضيحة", "لصوص", "سراق", "نصب", "غضب", "زفت", "خنزير",
              "كلاب", "حقير", "سرقوا", "نهب", "مهزلة"})


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


# ── offline lexicon engine ──────────────────────────────────────────────────
# Crude Iraqi/MSA sentiment — used as a graceful fallback when the AI classifier is
# unavailable (no credits) AND to power demo mode. Approximate, clearly labelled.
_POS_WORDS = _nw({"ممتاز", "رائع", "احسن", "أحسن", "زين", "حلو", "صادق", "بطل", "نزيه", "شجاع",
                  "يحفظك", "شكرا", "شكرًا", "عاشت", "العافية", "محترم", "نظيف", "برافو",
                  "تستاهل", "احسنت", "أحسنت", "موفق", "رهيب", "جميل", "ورد", "تحياتي", "عاش"})
_NEG_WORDS = _ANGER | _nw({"كذب", "كذاب", "خيانة", "خاين", "عميل", "مجرم", "ظالم", "تافه", "غبي",
                           "مقرف", "يلعن", "نصاب", "كاذب", "مزيف", "وكر"})
_DEMAND = _nw({"نطالب", "يجب", "لازم", "وين", "محاسبة", "حاسبوا", "ارجعوا", "اطلب", "نريد", "نطلب"})
_FEAR = _nw({"خوف", "نخاف", "خايف", "رعب", "قلق", "مرعوب", "خايفين"})
_SYMP = _nw({"يرحمه", "مسكين", "حزين", "يعينه", "تعازي", "يصبر", "مساكين"})


def _is_sarc(text: str) -> bool:
    if any(e in (text or "") for e in ("😂", "🤣", "😅", "😆")):   # emojis survive only on raw text
        return True
    raw = _norm(text).replace(" ", "")
    return "ههه" in raw or "ياسلام" in raw


def lexicon_sentiment(text: str) -> str:
    toks = _tokens(text)
    pos = len(toks & _POS_WORDS)
    neg = len(toks & _NEG_WORDS)
    if _is_sarc(text) and pos:     # sarcastic praise → negative
        return "سلبي"
    if neg > pos:
        return "سلبي"
    if pos > neg:
        return "إيجابي"
    return "محايد"


def lexicon_classify(texts: list) -> list:
    return [lexicon_sentiment(t) for t in texts]


def lexicon_mood(texts: list) -> dict:
    """7-dimension Audience Mood (0..100) + mood_index, purely lexical (offline)."""
    n = len(texts) or 1
    c = {"anger": 0, "sarcasm": 0, "frustration": 0, "support": 0, "fear": 0, "sympathy": 0, "trust": 0}
    for t in texts:
        toks = _tokens(t)
        if toks & _ANGER:
            c["anger"] += 1
        if _is_sarc(t):
            c["sarcasm"] += 1
        if toks & _NEG_WORDS and not (toks & _POS_WORDS):
            c["frustration"] += 1
        if toks & _POS_WORDS:
            c["support"] += 1
            c["trust"] += 1
        if toks & _FEAR:
            c["fear"] += 1
        if toks & _SYMP:
            c["sympathy"] += 1
    mood = {k: round(v / n * 100) for k, v in c.items()}
    pos = c["support"]
    neg = c["anger"] + c["frustration"]
    mood_index = round(pos / (pos + neg) * 100) if (pos + neg) else 50
    return {"audience_mood": mood, "mood_index": mood_index,
            "sarcasm_level": mood["sarcasm"], "anger_level": mood["anger"]}


def offline_insights(texts: list, subject: str = "") -> dict:
    """A best-effort, NO-AI insights object so the cards populate when Claude is down.
    Topics come from frequent keyword clusters; demands/accusations from lexicon hits.
    Clearly flagged engine='offline-lexicon' so it's never mistaken for the AI read."""
    texts = [t for t in (texts or []) if t and len(t.strip()) > 1]
    cl = cluster(texts)
    kp = keyword_phrases(texts, top=7)
    labels = lexicon_classify([c["representative"] for c in cl])
    sizes = [c["size"] for c in cl]
    topics = [{"name": k["phrase"], "share": None, "sentiment": "مختلط",
               "summary": f"تكرّر بصِيَغ متشابهة ({k['count']} مرة)", "sample": ""} for k in kp[:6]]
    demands = list({t[:120] for t in texts if _tokens(t) & _DEMAND})[:5]
    accusations = list({t[:120] for t in texts if _tokens(t) & _NEG_WORDS})[:5]
    praise = list({t[:120] for t in texts if (_tokens(t) & _POS_WORDS) and "سلبي" != lexicon_sentiment(t)})[:5]
    return {**lexicon_mood(texts),
            "engine": "offline-lexicon",
            "topics": topics, "entities": [],
            "grievances": accusations[:4], "demands": demands,
            "accusations": accusations, "praise": praise,
            "talking_points": [{"point": c["representative"][:120], "repetition": "عالٍ", "note": f"×{c['size']}"}
                               for c in cl if c["size"] >= 2][:5],
            "notable_quotes": [], "audience": {},
            "takeaways": ["تحليل لغوي تقريبي (بدون ذكاء اصطناعي) — للعرض/التطوير؛ يُستبدل بالتحليل الكامل عند توفّر الرصيد."]}


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
