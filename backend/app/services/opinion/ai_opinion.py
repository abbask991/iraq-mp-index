"""PPOI accuracy upgrade — target-aware AI classification.

Rule-based lexicons miss context and sarcasm. This classifies each post TOWARD a
specific target (is it an opinion? support/oppose? which emotion?) using one AI
pass over clustered representatives (cluster-before-AI keeps cost down), then
propagates to cluster members. Falls back to the rule-based path if AI is off or
errors, so it never blocks.
"""
import json

from app.config import ANTHROPIC_API_KEY, CLASSIFY_MODEL
from app.services import ai_cache
from app.services.collection import cluster
from app.services.opinion import opinion_detector
from app.services import stance as _stance

_STANCE_MAP = {"support": "support", "oppose": "oppose", "neutral": "neutral", "mixed": "neutral", "unclear": "neutral"}


def _rule(text):
    det = opinion_detector.detect(text)
    st = _stance.classify_stance(text)["stance"]
    st = "support" if st == "support" else "oppose" if st in ("oppose", "sarcastic") else "neutral"
    return {"is_opinion": det["is_opinion"], "stance": st, "emotion": None, "source": "rule"}


async def _ai_batch(target, reps):
    listed = "\n".join(f"{i+1}. {t[:180]}" for i, t in enumerate(reps))
    prompt = (
        f"الهدف: «{target}». لكل منشور أدناه، صنّفه تجاه هذا الهدف تحديداً. أعد JSON array فقط، عنصر لكل منشور بالترتيب:\n"
        '[{"op":true/false (هل هو رأي وليس خبراً/سؤالاً/إعلاناً),'
        '"st":"support|oppose|neutral" (الموقف من الهدف),'
        '"emo":"anger|trust|fear|hope|sadness|sarcasm|satisfaction|frustration|neutral"}]\n'
        "راعِ السياق والسخرية والنفي. أعد المصفوفة فقط.\n\n" + listed)
    cached = await ai_cache.get(CLASSIFY_MODEL, prompt)
    if cached is not None:
        return cached
    import httpx
    async with httpx.AsyncClient() as c:
        r = await c.post("https://api.anthropic.com/v1/messages",
                         headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                                  "content-type": "application/json"},
                         json={"model": CLASSIFY_MODEL, "max_tokens": 1500,
                               "messages": [{"role": "user", "content": prompt}]}, timeout=70)
        txt = r.json()["content"][0]["text"]
        out = json.loads(txt[txt.find("["):txt.rfind("]") + 1])
        await ai_cache.put(CLASSIFY_MODEL, prompt, out)
        return out


async def classify(target: str, posts: list[dict]) -> list[dict]:
    """Returns a per-post list aligned to input: {is_opinion, stance, emotion, source}."""
    n = len(posts)
    texts = [p.get("text", "") for p in posts]
    if not ANTHROPIC_API_KEY or n < 8:
        return [_rule(t) for t in texts]
    try:
        clusters = cluster.build_clusters(posts)
        reps = [texts[c["rep"]] for c in clusters][:120]          # cap reps (cost)
        verdicts = []
        for i in range(0, len(reps), 30):                          # 30 per AI call
            verdicts += await _ai_batch(target, reps[i:i + 30])
        out = [None] * n
        for ci, c in enumerate(clusters[:len(reps)]):
            v = verdicts[ci] if ci < len(verdicts) else {}
            res = {"is_opinion": bool(v.get("op", False)),
                   "stance": _STANCE_MAP.get(str(v.get("st", "neutral")).lower(), "neutral"),
                   "emotion": v.get("emo"), "source": "ai"}
            for m in c["members"]:
                out[m] = res
        for i in range(n):
            if out[i] is None:
                out[i] = _rule(texts[i])
        return out
    except Exception:
        return [_rule(t) for t in texts]
