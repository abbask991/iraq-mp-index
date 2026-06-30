"""Facebook Page Clusters (spec §6+§7) — group monitored pages by BEHAVIOR.

Compares the Page-DNA feature vectors (dominant topics, dominant reaction, peak
posting hour, sentiment tendency) and greedily groups pages whose behavior is
similar. Also produces a per-page "similar pages" list for the DNA panel.

Probabilistic language ONLY — clusters are behavioral affinities, never asserted
political affiliations. Every cluster carries a 'requires human review' note.
"""


def _jaccard(a: set, b: set) -> float:
    a, b = set(a or []), set(b or [])
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def similarity(da: dict, db: dict) -> int:
    """0..100 behavioral similarity between two Page-DNA dicts."""
    va, vb = da.get("_vector", {}), db.get("_vector", {})
    topic = _jaccard(va.get("topics"), vb.get("topics"))
    react = 1.0 if va.get("dominant_reaction") and va.get("dominant_reaction") == vb.get("dominant_reaction") else 0.0
    ha, hb = va.get("peak_hour"), vb.get("peak_hour")
    hour = 1.0 if ha is not None and ha == hb else (0.5 if ha is not None and hb is not None and abs(ha - hb) <= 2 else 0.0)
    tend = 1.0 if va.get("tendency") == vb.get("tendency") else 0.0
    return round(100 * (0.45 * topic + 0.20 * react + 0.15 * hour + 0.20 * tend))


def with_similarities(dnas: list, top: int = 3) -> list:
    """Attach a `similar_pages` list (other pages ranked by behavioral similarity)."""
    for d in dnas:
        sims = []
        for o in dnas:
            if o is d:
                continue
            s = similarity(d, o)
            sims.append({"page": o.get("page"), "slug": o.get("slug"), "similarity": s})
        d["similar_pages"] = sorted(sims, key=lambda x: -x["similarity"])[:top]
    return dnas


def _label(members: list) -> str:
    """Neutral, behavioral cluster label (never an asserted political affiliation)."""
    tend = [m.get("sentiment_tendency") for m in members]
    cats = [(m.get("_vector", {}).get("category")) for m in members]
    if tend.count("سلبي") >= len(members) / 2:
        return "تجمّع نبرته ناقدة (يُرجّح)"
    if tend.count("إيجابي") >= len(members) / 2:
        return "تجمّع نبرته داعمة/إيجابية (يُرجّح)"
    return "تجمّع متقارب السلوك (يُرجّح)"


def detect(dnas: list, threshold: int = 50) -> dict:
    """Greedy behavioral clustering. Returns clusters + the similarity matrix."""
    dnas = with_similarities(dnas)
    n = len(dnas)
    assigned = [-1] * n
    clusters = []
    for i in range(n):
        if assigned[i] != -1:
            continue
        cid = len(clusters)
        assigned[i] = cid
        members = [i]
        for j in range(i + 1, n):
            if assigned[j] == -1 and similarity(dnas[i], dnas[j]) >= threshold:
                assigned[j] = cid
                members.append(j)
        m_dnas = [dnas[k] for k in members]
        shared = set(dnas[members[0]].get("_vector", {}).get("topics", set()))
        for k in members[1:]:
            shared &= set(dnas[k].get("_vector", {}).get("topics", set()))
        sims = [similarity(dnas[a], dnas[b]) for a in members for b in members if a < b]
        clusters.append({
            "id": cid,
            "label": _label(m_dnas),
            "pages": [{"page": d.get("page"), "slug": d.get("slug"),
                       "tendency": d.get("sentiment_tendency"), "influence": d.get("influence")} for d in m_dnas],
            "size": len(members),
            "shared_topics": sorted(shared)[:6],
            "avg_similarity": round(sum(sims) / len(sims)) if sims else 100,
            "confidence": "مرتفع" if (sum(sims) / len(sims) if sims else 100) >= 70 else "متوسط",
            "note": "تجمّع سلوكي احتمالي — يُظهر تقارباً، لا يُثبت تنسيقاً أو انتماءً؛ يتطلّب مراجعة بشرية.",
        })
    return {"clusters": clusters, "pages_analyzed": n,
            "disclaimer": "العناقيد مؤشرات تقارب سلوكي (محتوى/توقيت/نبرة) لا أحكام قاطعة."}
