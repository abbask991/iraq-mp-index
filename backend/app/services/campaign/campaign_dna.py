"""Campaign DNA — a compact fingerprint of a campaign so new campaigns can be
matched against previously seen ones ("this looks like the March #X wave").

The fingerprint is small + JSON-serializable so it persists in the campaign_dna
table and compares cheaply (set-Jaccard + narrative match + sub-score cosine)."""
import hashlib
import math

from app.services.campaign._util import TOK


def _phrase_tokens(top_phrases, limit=40):
    toks = set()
    for p in top_phrases or []:
        toks |= set(TOK.findall((p.get("text") or "").lower()))
    return sorted(toks)[:limit]


def fingerprint(result: dict) -> dict:
    """Build a campaign DNA signature from a detect() result."""
    hashtags = sorted({h["hashtag"] for h in result.get("top_hashtags", [])})[:12]
    domains = sorted({l["link"].split("/")[2] for l in result.get("top_links", [])
                      if "//" in l.get("link", "")})[:12]
    sub = result.get("sub_scores", {})
    sig_src = "|".join(hashtags) + "#" + result.get("main_narrative", "")
    return {
        "hashtags": hashtags,
        "domains": domains,
        "narrative": result.get("main_narrative", ""),
        "phrase_tokens": _phrase_tokens(result.get("top_repeated_phrases")),
        "sub_vector": {k: sub.get(k, 0) for k in sorted(sub)},
        "sig": hashlib.sha1(sig_src.encode("utf-8")).hexdigest()[:16],
    }


def _jaccard(a, b):
    sa, sb = set(a or []), set(b or [])
    if not sa and not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def _cosine(va: dict, vb: dict):
    keys = set(va) | set(vb)
    if not keys:
        return 0.0
    dot = sum(va.get(k, 0) * vb.get(k, 0) for k in keys)
    na = math.sqrt(sum(v * v for v in va.values()))
    nb = math.sqrt(sum(v * v for v in vb.values()))
    return dot / (na * nb) if na and nb else 0.0


def similarity(a: dict, b: dict) -> float:
    """0..1 similarity between two DNA fingerprints."""
    if not a or not b:
        return 0.0
    parts = [
        (0.30, _jaccard(a.get("hashtags"), b.get("hashtags"))),
        (0.20, _jaccard(a.get("domains"), b.get("domains"))),
        (0.20, _jaccard(a.get("phrase_tokens"), b.get("phrase_tokens"))),
        (0.10, 1.0 if a.get("narrative") and a.get("narrative") == b.get("narrative") else 0.0),
        (0.20, _cosine(a.get("sub_vector", {}), b.get("sub_vector", {}))),
    ]
    return round(sum(w * s for w, s in parts), 3)


async def store(campaign_id, dna: dict, *, owner=None, topic=None, score=None):
    """Persist a fingerprint (best-effort; no-op without DB)."""
    from app.services import db
    await db.insert("campaign_dna", {
        "campaign_id": campaign_id, "owner": owner, "topic": topic,
        "score": score, "dna": dna,
    }, upsert=True, on_conflict="campaign_id")


async def compare_with_known(dna: dict, *, owner=None, top=3):
    """Return the most similar previously stored campaigns."""
    from app.services import db
    q = "select=campaign_id,topic,score,dna&order=created_at.desc&limit=200"
    if owner:
        q += f"&owner=eq.{owner}"
    rows = await db.select("campaign_dna", q)
    scored = [{"campaign_id": r.get("campaign_id"), "topic": r.get("topic"),
               "score": r.get("score"), "similarity": similarity(dna, r.get("dna") or {})}
              for r in rows]
    scored = [s for s in scored if s["similarity"] > 0]
    scored.sort(key=lambda s: -s["similarity"])
    return scored[:top]
