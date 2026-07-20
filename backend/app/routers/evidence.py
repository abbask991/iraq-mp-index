"""Evidence API — the posts behind a score. Cached (SWR)."""
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from fastapi import APIRouter

from app.services import cache, db, evidence

router = APIRouter(prefix="/api/evidence", tags=["evidence"])


@router.get("")
async def get_evidence(target: str, filter: str = "oppose", range: str = "week"):
    t = (target or "").strip()
    if not t:
        return {"error": "missing target"}
    rng = range if range in ("day", "week") else "week"
    return await cache.swr(f"evidence:{rng}:{filter}:{t}", 1800,
                           lambda: evidence.get_evidence(t, filter=filter, rng=rng))


@router.get("/search")
async def search_evidence(q: str = "", platform: str = "", sentiment: str = "", emotion: str = "",
                          entity_id: str = "", has_link: int = 0, since_days: int = 30, limit: int = 60):
    """Raw-evidence explorer over the normalized `mentions` table (X + news, and
    any other platform that lands there). Free-text (trigram ILIKE) + structured
    filters. Honest scope: this is the always-on signal store, so it is mostly X
    and Google News today — the response reports which platforms it actually spans."""
    if not db.enabled():
        return {"items": [], "count": 0, "platform_facets": {}, "note": "قاعدة البيانات غير مهيّأة"}
    parts = ["select=external_id,platform,source,author,text,sentiment,emotion,hashtags,links,engagement,created_at",
             "order=created_at.desc", f"limit={max(1, min(limit, 200))}"]
    if q.strip():
        parts.append(f"text=ilike.*{quote(q.strip())}*")
    if platform:
        parts.append(f"platform=eq.{quote(platform)}")
    if sentiment:
        parts.append(f"sentiment=eq.{quote(sentiment)}")
    if emotion:
        parts.append(f"emotion=eq.{quote(emotion)}")
    if entity_id:
        parts.append(f"entity_id=eq.{quote(entity_id)}")
    if since_days and since_days > 0:
        since = (datetime.now(timezone.utc) - timedelta(days=since_days)).isoformat()
        parts.append(f"created_at=gte.{quote(since)}")
    rows = await db.select("mentions", "&".join(parts))
    if has_link:
        rows = [r for r in rows if r.get("links")]
    facets: dict = {}
    for r in rows:
        p = r.get("platform") or "other"
        facets[p] = facets.get(p, 0) + 1
    return {"items": rows, "count": len(rows), "platform_facets": facets}


# Narrative-to-Action: mobilization language that signals online anger tipping
# toward real-world action. Purely observational — real phrase matches in stored
# text, categorized; no AI inference.
_ACTION = {
    "protest": ["احتجاج", "تظاهر", "مظاهرة", "نطلع", "ننزل", "تجمّع", "تجمع", "اعتصام"],
    "boycott": ["مقاطعة", "قاطعوا", "نقاطع"],
    "strike": ["إضراب", "اضراب"],
    "accountability": ["حاسبوا", "محاسبة", "لازم نوقف"],
    "roadblock": ["قطع الطريق", "قطع طريق", "قطع الطرق"],
}


@router.get("/action-signals")
async def action_signals(q: str = "", since_days: int = 14, limit: int = 400):
    """Scan stored mentions for real-world-action language (protest/boycott/strike/
    roadblock/accountability). Observation only: counts phrase matches in real text,
    categorized — it does not infer intent."""
    if not db.enabled():
        return {"available": False, "note": "قاعدة البيانات غير مهيّأة"}
    parts = ["select=platform,source,text,created_at", "order=created_at.desc", f"limit={max(1, min(limit, 600))}"]
    if q.strip():
        parts.append(f"text=ilike.*{quote(q.strip())}*")
    if since_days and since_days > 0:
        since = (datetime.now(timezone.utc) - timedelta(days=since_days)).isoformat()
        parts.append(f"created_at=gte.{quote(since)}")
    rows = await db.select("mentions", "&".join(parts))
    cats: dict = {}
    plats: dict = {}
    samples: list = []
    for r in rows:
        t = r.get("text") or ""
        for cat, phrases in _ACTION.items():
            hit = next((ph for ph in phrases if ph in t), None)
            if hit:
                c = cats.setdefault(cat, {"count": 0, "phrases": set()})
                c["count"] += 1
                c["phrases"].add(hit)
                p = r.get("platform") or "other"
                plats[p] = plats.get(p, 0) + 1
                if len(samples) < 12:
                    samples.append({"platform": p, "source": r.get("source"), "text": t[:200],
                                    "created_at": r.get("created_at"), "matched": hit})
                break
    signals = sorted(
        ({"category": k, "count": v["count"], "phrases": sorted(v["phrases"])} for k, v in cats.items()),
        key=lambda x: -x["count"])
    total = sum(s["count"] for s in signals)
    scanned = len(rows)
    return {"available": True, "signals": signals, "total": total, "scanned": scanned,
            "platform_facets": plats, "samples": samples,
            "ratio": round(total / scanned, 3) if scanned else 0}
