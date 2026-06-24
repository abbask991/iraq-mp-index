"""Campaign DNA — a compact fingerprint of a campaign so new campaigns can be
matched against previously seen ones ("this looks like the March #X wave").

The fingerprint is small + JSON-serializable so it persists in the campaign_dna
table and compares cheaply (set-Jaccard + narrative match + sub-score cosine)."""
import hashlib
import math
from collections import Counter
from datetime import datetime

from app.services.campaign._util import TOK


def _phrase_tokens(top_phrases, limit=40):
    toks = set()
    for p in top_phrases or []:
        toks |= set(TOK.findall((p.get("text") or "").lower()))
    return sorted(toks)[:limit]


def _posting_schedule(tweets):
    """Normalized 24-hour posting histogram (a campaign's daily rhythm)."""
    hours = [0] * 24
    for t in tweets or []:
        try:
            dt = datetime.fromisoformat((t.get("created_at") or "").replace("Z", "+00:00"))
            hours[dt.hour] += 1
        except Exception:
            pass
    total = sum(hours) or 1
    return [round(h / total, 3) for h in hours]


def _platform_distribution(result, tweets):
    plats = result.get("platforms_detected") or []
    dist = {p: 0 for p in plats} or {"X": 0}
    for t in tweets or []:
        dist["X"] = dist.get("X", 0) + 1
    total = sum(dist.values()) or 1
    return {k: round(v / total, 3) for k, v in dist.items()}


def _language_pattern(tweets):
    """Aggregate stylometric markers across the campaign (writing-hand profile)."""
    from app.services import stylometry
    fps = [stylometry.fingerprint(t.get("text", "")) for t in (tweets or []) if t.get("text")]
    fps = [f for f in fps if f["tokens"] >= 4]
    if not fps:
        return {}
    n = len(fps)
    func_keys = set().union(*(f["func_dist"].keys() for f in fps))
    return {
        "avg_sentence_len": round(sum(f["avg_sentence_len"] for f in fps) / n, 2),
        "emoji_rate": round(sum(f["emoji_rate"] for f in fps) / n, 3),
        "punct_rate": round(sum(f["punct_rate"] for f in fps) / n, 3),
        "repetition": round(sum(f["repetition"] for f in fps) / n, 3),
        "func_dist": {k: round(sum(f["func_dist"].get(k, 0) for f in fps) / n, 3) for k in func_keys},
    }


def _geo_spread(users):
    locs = Counter((u.get("location") or "").strip() for u in (users or {}).values()
                   if (u.get("location") or "").strip())
    return [{"location": loc, "count": c} for loc, c in locs.most_common(8)]


def fingerprint(result: dict, tweets=None, users=None) -> dict:
    """Build a campaign DNA signature. With `tweets`/`users` it also captures the
    posting schedule, platform distribution, language patterns, and geo spread."""
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
        "posting_schedule": _posting_schedule(tweets),
        "platform_distribution": _platform_distribution(result, tweets),
        "language_pattern": _language_pattern(tweets),
        "geo_spread": _geo_spread(users),
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


def _schedule_cosine(a, b):
    if not a or not b:
        return 0.0
    return _cosine({str(i): v for i, v in enumerate(a)}, {str(i): v for i, v in enumerate(b)})


def similarity(a: dict, b: dict) -> float:
    """0..1 similarity between two DNA fingerprints across every captured trait:
    hashtags, domains, phrasing, narrative, signal profile, posting rhythm, and
    writing style."""
    if not a or not b:
        return 0.0
    lang_a = (a.get("language_pattern") or {}).get("func_dist", {})
    lang_b = (b.get("language_pattern") or {}).get("func_dist", {})
    parts = [
        (0.24, _jaccard(a.get("hashtags"), b.get("hashtags"))),
        (0.16, _jaccard(a.get("domains"), b.get("domains"))),
        (0.16, _jaccard(a.get("phrase_tokens"), b.get("phrase_tokens"))),
        (0.08, 1.0 if a.get("narrative") and a.get("narrative") == b.get("narrative") else 0.0),
        (0.16, _cosine(a.get("sub_vector", {}), b.get("sub_vector", {}))),
        (0.10, _schedule_cosine(a.get("posting_schedule"), b.get("posting_schedule"))),
        (0.10, _cosine(lang_a, lang_b)),
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
