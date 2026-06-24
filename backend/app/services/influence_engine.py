"""Political-Influence & Media-Influence scoring.

Political influence = how much reach/amplification/network centrality an entity
commands. Media influence = how broadly and credibly outlets cover it.
"""
import math


def political_influence_score(*, mentions, reach, amplifier_count, network_edges,
                              cross_platform=1, follower_weighted_reach=0):
    """0-100 political influence from volume, reach, amplification, centrality."""
    volume_c = min(100, math.log10(mentions + 1) * 33)
    reach_c = min(100, math.log10(max(reach, follower_weighted_reach) + 1) * 13)
    amplification_c = min(100, amplifier_count * 8)
    centrality_c = min(100, network_edges * 4)
    platform_c = min(100, cross_platform * 40)
    components = {"volume": round(volume_c), "reach": round(reach_c),
                  "amplification": round(amplification_c), "centrality": round(centrality_c),
                  "cross_platform": round(platform_c)}
    weights = {"volume": 0.25, "reach": 0.30, "amplification": 0.20,
               "centrality": 0.15, "cross_platform": 0.10}
    score = round(sum(components[k] * w for k, w in weights.items()))
    return {"score": score, "components": components,
            "drivers": [k for k, _ in sorted(components.items(), key=lambda kv: -kv[1])[:2]],
            "explain": "النفوذ السياسي = الوصول + حجم الذِكر + التضخيم + المركزية الشبكية + تعدّد المنصّات."}


def media_influence_score(sources, *, outlet_credibility=None):
    """0-100 media influence from coverage breadth × outlet credibility.
    `sources` = list of {source, total, lean}; `outlet_credibility` = optional
    {source: 0..1} trust map."""
    outlet_credibility = outlet_credibility or {}
    if not sources:
        return {"score": 0, "components": {}, "drivers": [], "breadth": 0}
    breadth = len(sources)
    breadth_c = min(100, breadth * 10)
    total_cov = sum(s.get("total", 0) for s in sources) or 1
    cred = sum(outlet_credibility.get(s.get("source", ""), 0.5) * s.get("total", 0)
               for s in sources) / total_cov
    cred_c = cred * 100
    # concentration: dominated by one outlet = weaker independent influence
    top = max(s.get("total", 0) for s in sources)
    diversity_c = (1 - top / total_cov) * 100
    components = {"breadth": round(breadth_c), "credibility": round(cred_c),
                  "diversity": round(diversity_c)}
    score = round(0.4 * breadth_c + 0.35 * cred_c + 0.25 * diversity_c)
    return {"score": score, "components": components, "breadth": breadth,
            "drivers": [k for k, _ in sorted(components.items(), key=lambda kv: -kv[1])[:2]],
            "explain": "النفوذ الإعلامي = اتّساع التغطية × مصداقية المنابر × تنوّعها."}
