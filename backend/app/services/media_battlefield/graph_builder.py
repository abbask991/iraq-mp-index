"""Build the battlefield graph — typed nodes + typed/weighted edges + a
force-directed layout (reuses the influence-network layout). Uncertain
relationships carry probability-language confidence, never asserted as fact.
"""
import hashlib
from collections import Counter, defaultdict

from app.services.bigdata.influence import layout


def _conf(evidence_count):
    return "strong signal" if evidence_count >= 5 else "likely" if evidence_count >= 2 else "possible"


def _eid(src, tgt, rel):
    return "e_" + hashlib.sha1(f"{src}|{tgt}|{rel}".encode("utf-8")).hexdigest()[:14]


def build(entity_name, entity_type, roles, narratives, news_hits,
          max_nodes=100, max_edges=300):
    nodes, edges = [], []
    center = "ent:" + entity_name
    nodes.append({
        "id": center, "name": entity_name, "type": entity_type or "entity",
        "influence_score": 100, "reputation_score": None, "sentiment_score": None,
        "risk_score": None, "activity_level": len(roles), "verification_status": True,
        "is_center": True,
    })

    attackers = [r for r in roles if r["role"] == "attack"][:22]
    supporters = [r for r in roles if r["role"] == "support"][:22]
    for r in attackers + supporters:
        nid = "acc:" + str(r["id"])
        nodes.append({
            "id": nid, "name": "@" + (r["username"] or ""), "type": "influencer" if r["influence"] >= 6 else "account",
            "platform": "x", "influence_score": min(100, r["influence"] * 10), "risk_score": r["bot"],
            "sentiment_score": -1 if r["role"] == "attack" else 1, "activity_level": r["posts"],
            "verification_status": r["verified"], "followers": r["followers"],
        })
        rel = "attacks" if r["role"] == "attack" else "supports"
        edges.append({
            "id": _eid(nid, center, rel), "source_id": nid, "target_id": center,
            "relationship_type": rel, "weight": round(r["posts"] + r["engagement"] / 200, 1),
            "confidence": _conf(r["posts"]), "sentiment": "سلبي" if rel == "attacks" else "إيجابي",
            "evidence_count": r["posts"], "evidence_examples": r["evidence"],
        })

    for n in narratives[:6]:
        nid = "nar:" + n["narrative"]
        nodes.append({"id": nid, "name": n["narrative"], "type": "narrative",
                      "influence_score": n["share"], "activity_level": n["posts"],
                      "sentiment_score": -1 if n["neg_ratio"] > 0.5 else 0})
        rel = "narrative_targets" if n["neg_ratio"] > 0.5 else "narrative_supports"
        edges.append({"id": _eid(nid, center, rel), "source_id": nid, "target_id": center,
                      "relationship_type": rel, "weight": round(n["share"] / 8, 1),
                      "confidence": "likely", "sentiment": "سلبي" if n["neg_ratio"] > 0.5 else "محايد",
                      "evidence_count": n["posts"], "evidence_examples": n.get("keywords", [])})

    # media outlets from news, by net sentiment toward the entity
    by_src = defaultdict(lambda: {"pos": 0, "neg": 0, "n": 0})
    for h in news_hits:
        s = h.get("source") or "—"
        by_src[s]["n"] += 1
        by_src[s][{"إيجابي": "pos", "سلبي": "neg"}.get(h.get("sentiment"), "n")] += 1 if h.get("sentiment") in ("إيجابي", "سلبي") else 0
    for s, d in sorted(by_src.items(), key=lambda kv: -kv[1]["n"])[:8]:
        nid = "media:" + s
        lean = "سلبي" if d["neg"] > d["pos"] else "إيجابي" if d["pos"] > d["neg"] else "محايد"
        nodes.append({"id": nid, "name": s, "type": "media", "platform": "news",
                      "influence_score": min(100, d["n"] * 12), "activity_level": d["n"],
                      "sentiment_score": -1 if lean == "سلبي" else 1 if lean == "إيجابي" else 0})
        edges.append({"id": _eid(nid, center, "media_covers"), "source_id": nid, "target_id": center,
                      "relationship_type": "media_covers", "weight": round(d["n"] / 2, 1),
                      "confidence": "strong signal", "sentiment": lean, "evidence_count": d["n"], "evidence_examples": []})

    nodes = nodes[:max_nodes]
    keep = {n["id"] for n in nodes}
    edges = [e for e in edges if e["source_id"] in keep and e["target_id"] in keep][:max_edges]

    pos = layout([n["id"] for n in nodes], [(e["source_id"], e["target_id"]) for e in edges])
    for n in nodes:
        p = pos.get(n["id"], [0.5, 0.5])
        n["x"], n["y"] = round(p[0], 3), round(p[1], 3)

    return {"nodes": nodes, "edges": edges,
            "edge_types": dict(Counter(e["relationship_type"] for e in edges))}
