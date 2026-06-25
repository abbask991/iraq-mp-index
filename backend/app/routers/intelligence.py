"""Intelligence API — reads the stored intelligence layer (mentions, entity
metrics, timeline, knowledge graph, campaign DNA).

The /ask endpoint is RAG-style and STRICTLY grounded: it answers only from
evidence pulled out of the platform's own database, and is instructed to say it
has no data rather than fall back on the model's general knowledge.
"""
import json

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import ANTHROPIC_API_KEY, SUMMARY_MODEL
from app.services import (
    db, digital_twin, entity_resolver, intel_digest, knowledge_graph, narrative_engine,
    redis_client, scenario_simulator, stylometry, timeline,
)

router = APIRouter(prefix="/api/intelligence", tags=["intelligence"])


class AskReq(BaseModel):
    question: str
    entity_id: str | None = None
    range_days: int = 30


class ReportReq(BaseModel):
    kind: str = "profile"          # profile | campaign | executive | government
    target: str = ""
    range: str = "week"
    format: str = "pdf"            # pdf | docx | pptx


class ScenarioReq(BaseModel):
    entity_id: str
    scenario: str                  # official_response | no_response | delete_post | ...


class StyloReq(BaseModel):
    posts: list[dict] = []         # [{text:...}, ...]


async def _entity_facts(entity_id: str, days: int = 30):
    """Compact, grounded evidence about an entity from stored data."""
    ent = await db.select("entities", f"select=id,canonical,type&id=eq.{entity_id}&limit=1")
    metrics = await db.select(
        "entity_metrics_daily",
        f"select=day,mentions,pos,neg,neu,media_index,sov&entity_id=eq.{entity_id}"
        f"&order=day.desc&limit={days}")
    mentions = await db.select(
        "mentions",
        f"select=text,sentiment,source,platform,created_at&entity_id=eq.{entity_id}"
        f"&order=created_at.desc&limit=40")
    return {"entity": (ent[0] if ent else {"id": entity_id}), "metrics": metrics, "mentions": mentions}


@router.get("/summary/{entity_id}")
async def summary(entity_id: str):
    facts = await _entity_facts(entity_id)
    metrics = facts["metrics"]
    total = sum(m.get("mentions", 0) for m in metrics)
    neg = sum(m.get("neg", 0) for m in metrics)
    pos = sum(m.get("pos", 0) for m in metrics)
    graph = await knowledge_graph.get_entity_graph(entity_id, limit=20)
    return {
        "entity": facts["entity"],
        "window_days": len(metrics),
        "totals": {"mentions": total, "pos": pos, "neg": neg,
                   "neg_ratio": round(neg / total, 2) if total else 0},
        "trend": [{"day": m["day"], "mentions": m["mentions"], "neg": m.get("neg", 0)} for m in metrics[:14]],
        "connections": len(graph["edges"]),
        "recent_sample": facts["mentions"][:6],
    }


@router.get("/timeline/{target_type}/{target_id}")
async def get_timeline(target_type: str, target_id: str):
    events = await timeline.build_timeline(target_type, target_id)
    return {"target_type": target_type, "target_id": target_id, "events": events}


@router.get("/graph/{entity_id}")
async def get_graph(entity_id: str):
    return await knowledge_graph.get_entity_graph(entity_id)


@router.get("/campaign/{campaign_id}/dna")
async def campaign_dna(campaign_id: str):
    from app.services.campaign import campaign_dna as dna_mod
    rows = await db.select("campaign_dna", f"select=dna,topic,score&campaign_id=eq.{campaign_id}&limit=1")
    if not rows:
        return {"campaign_id": campaign_id, "found": False}
    dna = rows[0]["dna"]
    similar = await dna_mod.compare_with_known(dna)
    similar = [s for s in similar if s["campaign_id"] != campaign_id]
    return {"campaign_id": campaign_id, "found": True, "topic": rows[0].get("topic"),
            "dna": dna, "similar_campaigns": similar}


@router.post("/ask")
async def ask(req: AskReq):
    """Answer ONLY from stored platform data (grounded RAG)."""
    # light rate limit so the endpoint can't be abused
    _, allowed = await redis_client.rate_limit("ask", limit=60, window=3600)
    if not allowed:
        return {"answer": "تم تجاوز حد الأسئلة المؤقّت. حاول لاحقاً.", "grounded": False}

    entity_id = req.entity_id
    if not entity_id:
        resolved = entity_resolver.resolve_entity_alias(req.question)
        entity_id = resolved["id"] if resolved else None

    evidence = {"mentions": [], "metrics": [], "timeline": []}
    if entity_id:
        facts = await _entity_facts(entity_id, req.range_days)
        evidence["mentions"] = [{"t": m.get("text", "")[:200], "s": m.get("sentiment"),
                                 "src": m.get("source")} for m in facts["mentions"]]
        evidence["metrics"] = facts["metrics"][:14]
        evidence["timeline"] = await timeline.build_timeline("entity", entity_id)

    if not (evidence["mentions"] or evidence["metrics"]):
        return {"answer": "لا تتوفّر بيانات مخزّنة كافية للإجابة على هذا السؤال ضمن المنصّة.",
                "grounded": True, "entity_id": entity_id, "evidence_count": 0}

    if not ANTHROPIC_API_KEY:
        return {"answer": "نموذج الإجابة غير مُفعّل.", "grounded": True, "entity_id": entity_id}

    context = json.dumps(evidence, ensure_ascii=False)[:9000]
    prompt = (
        "أنت محلّل في منصّة مركز الرصد. أجب على السؤال اعتماداً **حصراً** على الأدلّة المخزّنة أدناه "
        "(منشورات/مقاييس/أحداث زمنية من قاعدة بيانات المنصّة). ممنوع استخدام أي معرفة عامة من خارج هذه الأدلّة. "
        "إذا لم تكفِ الأدلّة، قل بوضوح: «البيانات المتوفّرة لا تكفي للإجابة». "
        "اكتب إجابة موجزة احترافية بالعربية مع الإشارة إلى ما تستند إليه.\n\n"
        f"السؤال: {req.question}\n\nالأدلّة (JSON):\n{context}"
    )
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post("https://api.anthropic.com/v1/messages",
                             headers={"x-api-key": ANTHROPIC_API_KEY,
                                      "anthropic-version": "2023-06-01",
                                      "content-type": "application/json"},
                             json={"model": SUMMARY_MODEL, "max_tokens": 700,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=60)
            answer = r.json()["content"][0]["text"].strip()
    except Exception:
        answer = "تعذّر توليد الإجابة حالياً."
    return {"answer": answer, "grounded": True, "entity_id": entity_id,
            "evidence_count": len(evidence["mentions"]) + len(evidence["metrics"])}


@router.get("/digest")
async def digest():
    """Ready-made intelligence digest — served INSTANTLY from cache (no live fetch,
    no AI). Refreshed every ~3h by the cron. Builds once from stored data if cold."""
    import time
    d = await intel_digest.get_digest()
    if d is None:
        d = await intel_digest.build_digest(time.time())   # cheap: stored data only
    age = int(time.time() - d.get("generated_at", 0))
    return {**d, "age_seconds": age, "stale": age > 4 * 3600}


@router.get("/twin/{entity_id}")
async def twin(entity_id: str):
    """Central Political Digital Twin — fuses every engine for one entity."""
    return await digital_twin.build(entity_id)


@router.get("/scores/{entity_id}")
async def entity_scores(entity_id: str):
    """The 8 strategic scores for an entity (from its digital twin)."""
    t = await digital_twin.build(entity_id)
    return {"entity_id": entity_id, "scores": t["scores"], "headline": t["scores_headline"]}


@router.get("/narrative-evolution/{entity_id}")
async def narrative_evolution(entity_id: str, window: str = "day"):
    rows = await db.select(
        "mentions",
        f"select=text,sentiment,created_at&entity_id=eq.{entity_id}"
        f"&order=created_at.desc&limit=500")
    posts = [{"title": r.get("text", ""), "type": "عام", "sentiment": r.get("sentiment"),
              "created_at": r.get("created_at")} for r in rows]
    return narrative_engine.evolution(posts, window=window)


@router.post("/scenario")
async def scenario(req: ScenarioReq):
    """Project the likely media reaction to a strategic decision."""
    return await scenario_simulator.simulate_entity(req.entity_id, req.scenario)


@router.post("/stylometry")
async def stylometry_analyze(req: StyloReq):
    """Cluster posts by writing style → flag likely same-author groups."""
    return stylometry.cluster_authors(req.posts)


@router.post("/report")
async def report(req: ReportReq):
    """Queue a server-side PDF report (worker). Falls back to inline rendering
    when no queue is configured. Returns a job id to poll, or the result inline."""
    from app import jobq
    job = jobq.enqueue("app.tasks.generate_report", req.kind, req.target, req.range,
                       req.format, job_timeout=900)
    if job is not None:
        await redis_client.set_job(job.id, {"id": job.id, "status": "queued",
                                            "kind": req.kind, "target": req.target,
                                            "format": req.format})
        return {"job_id": job.id, "status": "queued"}
    # inline fallback (no worker): render now
    from app.services import reports
    out = await reports.build(req.kind, req.target, req.range, req.format)
    return {"job_id": None, "status": "done", **out}


@router.get("/job/{job_id}")
async def job_status(job_id: str):
    """Return the RQ job's real status + result (the rendered report bytes)."""
    from app import jobq
    if jobq.available():
        try:
            from rq.job import Job
            job = Job.fetch(job_id, connection=jobq.connection())
            st = job.get_status(refresh=True)
            status = "done" if st == "finished" else "failed" if st == "failed" else st
            out = {"id": job_id, "status": status}
            if st == "finished" and isinstance(job.result, dict):
                out.update(job.result)
            elif st == "failed":
                out["error"] = (job.exc_info or "")[-300:]
            return out
        except Exception:
            pass
    return await redis_client.get_job(job_id) or {"id": job_id, "status": "unknown"}
