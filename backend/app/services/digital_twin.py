"""Political Digital Twin (#15) — the central, continuously-updated intelligence
profile for a monitored entity (politician / party / institution / company).

`compose()` is a pure function that fuses every engine (reputation, influence,
risk, narratives, prediction, scores, knowledge graph) into one profile — usable
live. `build()` assembles the same inputs from the stored intelligence layer so
the twin keeps updating as data accumulates.
"""
from app.services import (
    knowledge_graph,
    narrative_engine,
    prediction_engine,
    scores as scores_mod,
)


def compose(inputs: dict) -> dict:
    """Fuse engine outputs into a digital twin. `inputs` is default-safe."""
    ev = {
        "pos": inputs.get("pos", 0), "neg": inputs.get("neg", 0), "neu": inputs.get("neu", 0),
        "reach": inputs.get("reach", 0), "bot_ratio": inputs.get("bot_ratio", 0.0),
        "manipulation_index": inputs.get("manipulation_index", 0),
        "source_credibility": inputs.get("source_credibility", 0.5),
        "mentions": inputs.get("mentions", 0), "amplifier_count": len(inputs.get("key_influencers", [])),
        "network_edges": inputs.get("network_edges", 0), "cross_platform": inputs.get("cross_platform", 1),
        "sources": inputs.get("sources", []), "neg_ratio": inputs.get("neg_ratio", 0.0),
        "neg_velocity": inputs.get("neg_velocity", 0.0), "neg_acceleration": inputs.get("neg_acceleration", 0.0),
        "campaign_score": inputs.get("campaign_score", 0), "official_response": inputs.get("official_response", False),
        "persistence": inputs.get("persistence", 0), "trust_emotion_share": inputs.get("trust_emotion_share", 0.0),
        "anger_share": inputs.get("anger_share", 0.0), "narratives": inputs.get("narratives", []),
        "prev": inputs.get("prev_scores", {}),
    }
    all_scores = scores_mod.all_scores(ev)
    series = inputs.get("series", [])
    prediction = prediction_engine.predict(series, reach=ev["reach"],
                                           history=inputs.get("history_series"))

    return {
        "identity": {"id": inputs.get("id"), "name": inputs.get("name"),
                     "type": inputs.get("type", "entity")},
        "scores": all_scores,
        "scores_headline": scores_mod.headline(all_scores),
        "reputation": all_scores["reputation"],
        "influence": all_scores["political_influence"],
        "risk": all_scores["political_risk"],
        "crisis": all_scores["crisis_escalation"],
        "narratives": inputs.get("narratives", []),
        "narrative_dominance": all_scores["narrative_dominance"],
        "prediction": prediction,
        "emotion_profile": inputs.get("emotion_dist", {}),
        "key_influencers": inputs.get("key_influencers", [])[:8],
        "associates": inputs.get("associates", [])[:8],
        "media_exposure": {"sources": len(inputs.get("sources", [])),
                           "reach": ev["reach"], "mentions": ev["mentions"]},
        "sentiment_trend": series[-30:],
        "campaign_history": inputs.get("campaign_history", []),
        "crisis_history": inputs.get("crisis_history", []),
        "performance_indicators": {
            "reputation": all_scores["reputation"]["score"],
            "influence": all_scores["political_influence"]["score"],
            "risk": all_scores["political_risk"]["score"],
            "trust": all_scores["public_trust"]["score"],
        },
        "explain": "التوأم الرقمي: ملف استخباراتي مركزي يدمج السمعة والنفوذ والخطر "
                   "والسرديات والتنبؤ وشبكة العلاقات لكل كيان.",
    }


# ---- build from the stored intelligence layer ----
async def build(entity_id: str, days: int = 30) -> dict:
    from app.services import db, emotions

    ent_rows = await db.select("entities", f"select=id,canonical,type&id=eq.{entity_id}&limit=1")
    ent = ent_rows[0] if ent_rows else {"id": entity_id, "canonical": entity_id, "type": "entity"}

    metrics = await db.select(
        "entity_metrics_daily",
        f"select=day,mentions,pos,neg,neu,media_index&entity_id=eq.{entity_id}"
        f"&order=day.asc&limit={days}")
    mentions = await db.select(
        "mentions",
        f"select=text,sentiment,source,platform&entity_id=eq.{entity_id}"
        f"&order=created_at.desc&limit=200")

    pos = sum(m.get("pos", 0) for m in metrics) or sum(1 for x in mentions if x.get("sentiment") == "إيجابي")
    neg = sum(m.get("neg", 0) for m in metrics) or sum(1 for x in mentions if x.get("sentiment") == "سلبي")
    neu = sum(m.get("neu", 0) for m in metrics) or max(0, len(mentions) - pos - neg)
    total = pos + neg + neu
    series = [m.get("mentions", 0) for m in metrics] or [len(mentions)]

    posts = [{"title": x.get("text", ""), "type": "عام", "sentiment": x.get("sentiment"),
              "source": x.get("source")} for x in mentions]
    narrs = narrative_engine.narratives(posts)
    emo = emotions.aggregate([x.get("text", "") for x in mentions])
    src_counter = {}
    for x in mentions:
        s = x.get("source") or "—"
        src_counter[s] = src_counter.get(s, 0) + 1
    sources = [{"source": s, "total": c, "lean": 0} for s, c in
               sorted(src_counter.items(), key=lambda kv: -kv[1])[:10]]
    graph = await knowledge_graph.get_entity_graph(entity_id, limit=30)

    inputs = {
        "id": ent["id"], "name": ent.get("canonical"), "type": ent.get("type"),
        "pos": pos, "neg": neg, "neu": neu, "mentions": total,
        "neg_ratio": (neg / total) if total else 0.0,
        "series": series, "narratives": narrs, "emotion_dist": emo,
        "trust_emotion_share": emo.get("trust", 0) / 100, "anger_share": emo.get("anger", 0) / 100,
        "sources": sources, "network_edges": len(graph["edges"]),
        "associates": [n for n in graph["nodes"] if n.get("id") != entity_id][:8],
    }
    twin = compose(inputs)
    twin["window_days"] = len(metrics)
    twin["data_points"] = len(mentions)
    return twin
