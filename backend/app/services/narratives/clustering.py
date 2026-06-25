"""Narrative Clustering helpers — merge near-duplicate narratives by shared
signals (keywords / entities / hashtags), so two differently-worded clusters that
push the same idea collapse into one. Used to refine raw issue-type clusters.

Semantic vectors (embeddings) are a fast-follow; today we cluster on the overlap
of strong tokens, which already captures "same idea, different words".
"""


def _overlap(a, b):
    sa, sb = set(a or []), set(b or [])
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / max(1, min(len(sa), len(sb)))


def merge_similar(narratives, *, threshold=0.5):
    """Merge narrative dicts whose keyword/hashtag overlap exceeds threshold."""
    merged = []
    for n in narratives:
        target = None
        for m in merged:
            kw = _overlap(n.get("keywords"), m.get("keywords"))
            ht = _overlap(n.get("top_hashtags"), m.get("top_hashtags"))
            if max(kw, ht) >= threshold:
                target = m
                break
        if target is None:
            merged.append(dict(n))
        else:
            target["posts"] = target.get("posts", 0) + n.get("posts", 0)
            target["share"] = target.get("share", 0) + n.get("share", 0)
            target["keywords"] = list(dict.fromkeys((target.get("keywords") or [])
                                                    + (n.get("keywords") or [])))[:8]
            target.setdefault("merged_from", []).append(n.get("name"))
            target["dominance"] = max(target.get("dominance", 0), n.get("dominance", 0))
    return merged
