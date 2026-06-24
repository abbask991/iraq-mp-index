"""Mention storage — the durable intelligence layer.

Turns ephemeral live fetches (news / X / Telegram / Reddit) into stored
`mentions` rows: entity-resolved, sentiment+emotion tagged, deduplicated. This
is what powers the Digital Twin, strategic scores, knowledge graph, timelines,
and the grounded /ask — without it those read empty.

All writes are best-effort and dedup on (platform, external_id), so re-ingesting
the same window is safe.
"""
import hashlib

from app.services import db, emotions, entity_resolver, knowledge_graph


def _platform(p):
    st = p.get("src_type")
    if p.get("platform") in ("x", "news", "telegram", "reddit"):
        return p["platform"]
    return {"Google News": "news", "Telegram": "telegram", "Reddit": "reddit",
            "RSS": "news", "GDELT": "news"}.get(st, "x")


def _external_id(p, text):
    return (p.get("link") or p.get("id") or p.get("external_id")
            or hashlib.sha1((text + (p.get("source") or "")).encode("utf-8")).hexdigest()[:24])


def _row(p, entity_id, owner):
    text = (p.get("title") or p.get("text") or "")[:2000]
    plat = _platform(p)
    emo = emotions._top(emotions._rule_scores(text))           # cheap rule-only
    links = p.get("links") or ([p["link"]] if p.get("link") else [])
    return {
        "external_id": _external_id(p, text), "platform": plat,
        "source": p.get("source"), "source_id": p.get("source_id"),
        "entity_id": entity_id, "author": p.get("author") or p.get("source"),
        "text": text, "sentiment": p.get("sentiment"),
        "emotion": emo[0] if emo[1] > 0 else None,
        "hashtags": p.get("hashtags") or [], "links": links,
        "engagement": int(p.get("engagement") or 0), "owner": owner,
        "created_at": p.get("created_at") or (p.get("date") or None),
    }


def resolve_entity_id(keyword: str) -> str:
    """Map a search keyword to a canonical entity id, or a stable slug."""
    r = entity_resolver.resolve_entity_alias(keyword)
    if r:
        return r["id"]
    norm = entity_resolver.normalize_arabic(keyword).replace(" ", "_")
    return "kw:" + (norm or hashlib.sha1(keyword.encode("utf-8")).hexdigest()[:10])


async def store_mentions(posts, keyword=None, entity_id=None, owner=None):
    """Persist posts as mentions (dedup upsert). Returns count attempted."""
    if not db.enabled() or not posts:
        return 0
    eid = entity_id or (resolve_entity_id(keyword) if keyword else None)
    rows = [_row(p, eid, owner) for p in posts if (p.get("title") or p.get("text"))]
    # dedup within batch on (platform, external_id)
    seen, deduped = set(), []
    for r in rows:
        k = (r["platform"], r["external_id"])
        if k not in seen:
            seen.add(k)
            deduped.append(r)
    if not deduped:
        return 0
    try:
        await db.insert("mentions", deduped, upsert=True, on_conflict="platform,external_id")
    except Exception:
        return 0
    # ensure the entity node exists + feed the knowledge graph (best-effort)
    if eid and not eid.startswith("kw:"):
        r = entity_resolver.resolve_entity_alias(keyword or "")
        if r:
            try:
                await knowledge_graph.upsert_node({"id": r["id"], "canonical": r["canonical"],
                                                   "type": r["type"]})
                await knowledge_graph.persist(posts[:60])
            except Exception:
                pass
    return len(deduped)
