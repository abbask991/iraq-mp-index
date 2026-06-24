"""Knowledge graph of the Iraqi information space — Postgres-backed (NOT Neo4j).

Nodes: politicians, parties, ministries, media outlets, journalists, influencers,
hashtags, campaigns, narratives, locations, sources.
Edges: typed, weighted, evidence-bearing relationships (co_mention, amplifies,
uses_hashtag, published_by, member_of, …).

Relationships are extracted from posts via the entity resolver, then upserted
into the entities / entity_relationships tables (accumulating weight over time).
"""
from collections import Counter

from app.services import entity_resolver


def extract_relationships(posts) -> list[dict]:
    """Derive typed edges from posts: entity↔entity co-mentions, entity→hashtag,
    entity→source. Pure — returns edge dicts to be upserted by the caller."""
    co_mention = Counter()
    ent_hashtag = Counter()
    ent_source = Counter()
    ent_meta: dict[str, dict] = {}

    for p in posts:
        text = p.get("title") or p.get("text") or ""
        ents = entity_resolver.extract_entities(text)
        for e in ents:
            ent_meta[e["id"]] = e
        ids = [e["id"] for e in ents]
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                a, b = sorted((ids[i], ids[j]))
                co_mention[(a, b)] += 1
            for h in p.get("hashtags", []):
                ent_hashtag[(ids[i], h)] += 1
            src = p.get("source")
            if src:
                ent_source[(ids[i], src)] += 1

    edges = []
    for (a, b), w in co_mention.items():
        edges.append({"source_id": a, "target_id": b, "relation_type": "co_mention",
                      "weight": w, "evidence": {"co_mentions": w}})
    for (e, h), w in ent_hashtag.items():
        if w >= 2:
            edges.append({"source_id": e, "target_id": f"hashtag:{h}", "relation_type": "uses_hashtag",
                          "weight": w, "evidence": {"count": w}})
    for (e, s), w in ent_source.items():
        if w >= 2:
            edges.append({"source_id": e, "target_id": f"source:{s}", "relation_type": "covered_by",
                          "weight": w, "evidence": {"count": w}})
    return edges, list(ent_meta.values())


# ---- persistence (best-effort; no-op without DB) ----
async def upsert_node(entity: dict):
    """entity = {id, canonical, type}."""
    from app.services import db
    await db.insert("entities", {
        "id": entity["id"], "canonical": entity.get("canonical"),
        "type": entity.get("type", "entity"),
    }, upsert=True, on_conflict="id")


async def upsert_edge(source_id, target_id, relation_type, weight=1, evidence=None):
    """Accumulate a weighted, typed edge (weight adds on conflict)."""
    from app.services import db
    key = f"{source_id}|{target_id}|{relation_type}"
    existing = await db.select("entity_relationships",
                               f"select=weight&edge_key=eq.{key}&limit=1")
    new_weight = weight + (existing[0]["weight"] if existing else 0)
    await db.insert("entity_relationships", {
        "edge_key": key, "source_id": str(source_id), "target_id": str(target_id),
        "relation_type": relation_type, "weight": new_weight, "evidence": evidence or {},
    }, upsert=True, on_conflict="edge_key")


async def persist(posts):
    """Extract + upsert nodes and edges for a batch of posts."""
    edges, nodes = extract_relationships(posts)
    for n in nodes:
        await upsert_node(n)
    for e in edges:
        await upsert_edge(e["source_id"], e["target_id"], e["relation_type"],
                          e["weight"], e["evidence"])
    return {"nodes": len(nodes), "edges": len(edges)}


async def get_entity_graph(entity_id, limit=60):
    """Ego graph around one entity: its strongest edges + neighbor nodes."""
    from app.services import db
    rows = await db.select(
        "entity_relationships",
        f"select=source_id,target_id,relation_type,weight"
        f"&or=(source_id.eq.{entity_id},target_id.eq.{entity_id})"
        f"&order=weight.desc&limit={limit}")
    node_ids = {entity_id}
    for r in rows:
        node_ids.add(r["source_id"]); node_ids.add(r["target_id"])
    ents = await db.select("entities", "select=id,canonical,type&limit=2000") if node_ids else []
    meta = {e["id"]: e for e in ents}
    nodes = [meta.get(nid, {"id": nid, "canonical": nid, "type": nid.split(":")[0] if ":" in nid else "entity"})
             for nid in node_ids]
    edges = [{"s": r["source_id"], "t": r["target_id"], "type": r["relation_type"], "w": r["weight"]}
             for r in rows]
    return {"center": entity_id, "nodes": nodes, "edges": edges}


async def get_campaign_graph(campaign_id, limit=80):
    """Graph of accounts/hashtags/entities tied to a campaign (via edge_key tag)."""
    from app.services import db
    rows = await db.select(
        "entity_relationships",
        f"select=source_id,target_id,relation_type,weight,evidence"
        f"&relation_type=eq.campaign_member&target_id=eq.campaign:{campaign_id}"
        f"&order=weight.desc&limit={limit}")
    nodes = {f"campaign:{campaign_id}"}
    for r in rows:
        nodes.add(r["source_id"])
    return {"campaign": campaign_id,
            "nodes": [{"id": n} for n in nodes],
            "edges": [{"s": r["source_id"], "t": r["target_id"], "w": r["weight"]} for r in rows]}
