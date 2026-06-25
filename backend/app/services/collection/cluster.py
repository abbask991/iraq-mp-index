"""AICE — clustering for cluster-before-AI.

Goal: turn N raw posts into far fewer clusters so the AI classifies one
representative per cluster instead of every post. O(n) — no pairwise blow-up:
each post gets a signature key from its rarest/longest significant tokens; posts
sharing a key (near-duplicate vocabulary, as in coordinated/echoed content) land
in the same cluster. Short posts fall back to exact-fingerprint grouping.
"""
from collections import defaultdict

from app.services.collection import dedup


def _signature(toks: list[str]) -> str:
    """Stable key for near-duplicates: the 4 longest distinct tokens, sorted."""
    uniq = sorted(set(toks), key=lambda w: (-len(w), w))[:4]
    return " ".join(sorted(uniq))


def build_clusters(posts: list[dict], *, min_tokens: int = 3) -> list[dict]:
    """Returns clusters: [{members:[idx...], rep: idx, size, key}]. The
    representative is the highest-engagement member (priority scoring replaces
    this in Phase 3)."""
    groups: dict[str, list[int]] = defaultdict(list)
    for i, p in enumerate(posts):
        toks = dedup.tokens(p.get("text", ""))
        key = _signature(toks) if len(toks) >= min_tokens else "fp:" + dedup.fingerprint(p.get("text", ""))
        groups[key].append(i)

    clusters = []
    for key, members in groups.items():
        rep = max(members, key=lambda i: int(posts[i].get("engagement") or 0))
        clusters.append({"members": members, "rep": rep, "size": len(members), "key": key})
    clusters.sort(key=lambda c: -c["size"])
    return clusters
