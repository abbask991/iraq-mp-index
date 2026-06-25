"""AICE Phase 2 — cluster-before-AI.

Drop-in for `ai.classify_all([texts])` that returns the SAME per-post list
(aligned to input order) but classifies only one representative per cluster and
propagates the verdict to every member — cutting Claude cost ~10× on busy topics
with zero extra X-API usage.

Safe by construction: disabled-flag, small-batch, or any error → falls back to
plain `ai.classify_all`. Returns (classifications, stats) for collector_runs.
"""
from app.services import ai, settings

_NEUTRAL = {"sentiment": "محايد", "type": "عام"}
_MIN_BATCH = 60          # below this, clustering overhead isn't worth it


async def _flag(cat, key, default):
    try:
        return await settings.get(cat, key, default)
    except Exception:
        return default


async def classify_posts(posts: list[dict]) -> tuple[list[dict], dict]:
    n = len(posts)
    texts = [p.get("text", "") for p in posts]
    stats = {"fetched": n, "clusters": n, "representatives": n,
             "ai_calls_saved": 0, "duplicates": 0, "clustered": False}

    enabled = await _flag("aice", "enabled", True)
    clu_on = await _flag("aice", "enable_cluster_before_ai", True)
    if not (enabled and clu_on) or n < _MIN_BATCH:
        return await ai.classify_all(texts), stats

    try:
        cap = int(await _flag("aice", "ai_representative_cap", 800) or 800)
        from app.services.collection import cluster
        clusters = cluster.build_clusters(posts)
        use = clusters[:cap]
        overflow = clusters[cap:]

        rep_cls = await ai.classify_all([texts[c["rep"]] for c in use])

        out: list = [None] * n
        for c, rc in zip(use, rep_cls):
            for m in c["members"]:
                out[m] = rc
        for c in overflow:                       # long tail beyond the cap → cheap rule label
            for m in c["members"]:
                out[m] = dict(_NEUTRAL)
        for i in range(n):                       # safety net
            if out[i] is None:
                out[i] = dict(_NEUTRAL)

        stats.update(clusters=len(clusters), representatives=len(use),
                     ai_calls_saved=max(0, n - len(use)),
                     duplicates=max(0, n - len(clusters)), clustered=True)
        return out, stats
    except Exception:
        # never break collection — fall back to the proven path
        return await ai.classify_all(texts), stats
