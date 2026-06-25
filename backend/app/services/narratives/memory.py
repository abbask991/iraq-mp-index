"""Narrative Memory — persist every discovered narrative + its DNA so analysts can
ask historical questions ("every narrative against the Ministry of Electricity
since 2026", "which narrative damaged Party X most"). DB-backed; degrades to a
no-op when the DB is unavailable so the live product never blocks on it.
"""
from app.services import db


async def remember(narrative: dict, dna: dict | None = None):
    if not db.enabled():
        return {"stored": False, "reason": "db_disabled"}
    try:
        row = {
            "slug": narrative.get("id"), "label": narrative.get("name"),
            "type": narrative.get("type"), "dominance": narrative.get("dominance"),
            "threat_level": (narrative.get("threat") or {}).get("level"),
            "posts": narrative.get("posts"), "sentiment": narrative.get("sentiment"),
            "keywords": narrative.get("keywords") or [],
            "entities": narrative.get("entities") or [],
        }
        await db.insert("narratives", row, upsert=True, on_conflict="slug")
        if dna:
            await db.insert("narrative_dna",
                            {"narrative_id": narrative.get("id"), "label": narrative.get("name"), "dna": dna},
                            upsert=True, on_conflict="narrative_id")
        return {"stored": True}
    except Exception as e:
        return {"stored": False, "reason": str(e)[:120]}


async def recall(*, entity: str | None = None, since: str | None = None, limit: int = 50):
    """Recall stored narratives, optionally filtered by an affected entity / date."""
    if not db.enabled():
        return {"narratives": [], "reason": "db_disabled"}
    q = f"select=slug,label,type,dominance,threat_level,posts,sentiment,keywords,entities,created_at&order=created_at.desc&limit={limit}"
    if since:
        q += f"&created_at=gte.{since}"
    if entity:
        q += f"&entities=cs.{{{entity}}}"
    try:
        rows = await db.select("narratives", q)
        return {"narratives": rows or []}
    except Exception as e:
        return {"narratives": [], "reason": str(e)[:120]}
