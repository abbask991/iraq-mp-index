"""Strategic Intelligence Scores (#10) — one explainable aggregator that turns a
single `evidence` dict into all eight scores:

  Reputation · Political Influence · Political Risk · Campaign Threat ·
  Narrative Dominance · Media Influence · Public Trust · Crisis Escalation

Each score keeps its own algorithm (in its engine) + drivers, so the bundle is
fully explainable and every number is defensible. Pure → testable.
"""
from app.services import influence_engine, narrative_engine, reputation_engine, risk_engine

SCORE_KEYS = ["reputation", "political_influence", "political_risk", "campaign_threat",
              "narrative_dominance", "media_influence", "public_trust", "crisis_escalation"]


def all_scores(ev: dict) -> dict:
    """ev fields (all optional, default-safe):
       pos, neg, neu, reach, source_credibility, bot_ratio, manipulation_index,
       mentions, amplifier_count, network_edges, cross_platform, sources,
       neg_ratio, neg_velocity, neg_acceleration, campaign_score, official_response,
       persistence, trust_emotion_share, anger_share, narratives, prev (per-score)."""
    pos, neg, neu = ev.get("pos", 0), ev.get("neg", 0), ev.get("neu", 0)
    prev = ev.get("prev", {})
    narrs = ev.get("narratives") or []

    reputation = reputation_engine.reputation_score(
        pos, neg, neu, reach=ev.get("reach", 0),
        source_credibility=ev.get("source_credibility", 0.5),
        bot_ratio=ev.get("bot_ratio", 0.0), prev=prev.get("reputation"))

    public_trust = reputation_engine.public_trust_score(
        pos, neg, neu, trust_emotion_share=ev.get("trust_emotion_share", 0.0),
        anger_share=ev.get("anger_share", 0.0), bot_ratio=ev.get("bot_ratio", 0.0))

    pol_influence = influence_engine.political_influence_score(
        mentions=ev.get("mentions", pos + neg + neu), reach=ev.get("reach", 0),
        amplifier_count=ev.get("amplifier_count", 0), network_edges=ev.get("network_edges", 0),
        cross_platform=ev.get("cross_platform", 1),
        follower_weighted_reach=ev.get("follower_weighted_reach", 0))

    media_influence = influence_engine.media_influence_score(
        ev.get("sources", []), outlet_credibility=ev.get("outlet_credibility"))

    pol_risk = risk_engine.political_risk_score(
        neg_ratio=ev.get("neg_ratio", (neg / (pos + neg + neu)) if (pos + neg + neu) else 0),
        neg_velocity=ev.get("neg_velocity", 0.0), campaign_score=ev.get("campaign_score", 0),
        manipulation_index=ev.get("manipulation_index", 0), reach=ev.get("reach", 0))

    crisis = risk_engine.crisis_escalation_score(
        neg_velocity=ev.get("neg_velocity", 0.0), neg_acceleration=ev.get("neg_acceleration", 0.0),
        reach=ev.get("reach", 0), campaign_threat=ev.get("campaign_score", 0),
        official_response=ev.get("official_response", False), persistence=ev.get("persistence", 0))

    dominance = narrative_engine.dominance_score(narrs)

    return {
        "reputation": reputation,
        "political_influence": pol_influence,
        "political_risk": pol_risk,
        "campaign_threat": {"score": ev.get("campaign_score", 0),
                            "explain": "درجة تهديد الحملة من محرّك كشف الحملات المنسّقة."},
        "narrative_dominance": dominance,
        "media_influence": media_influence,
        "public_trust": public_trust,
        "crisis_escalation": crisis,
    }


def headline(scores: dict) -> dict:
    """One-line per score (number + label) for compact dashboards."""
    return {k: {"score": scores[k].get("score", 0),
                "label": scores[k].get("level") or scores[k].get("stage")
                or scores[k].get("grade") or ""}
            for k in SCORE_KEYS if k in scores}
