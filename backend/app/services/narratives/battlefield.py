"""Narrative Battlefield — for a single narrative: who supports vs opposes it,
which politicians benefit vs are damaged, which media + influencers amplify it,
and which campaigns belong to it. Reuses the media-battlefield primitives
(account roles, side split, graph layout) on a narrative-centred post set.
"""
from collections import Counter

from app.services import campaign, entity_resolver, narrative_engine
from app.services.media_battlefield import (
    evidence_collector, graph_builder, relationship_extractor as rex, scorer,
)


def _acc(a):
    return {"username": a.get("username"), "name": a.get("name"), "influence": a.get("influence"),
            "posts": a.get("posts"), "engagement": a.get("engagement"), "bot": a.get("bot"),
            "followers": a.get("followers"), "confidence": a.get("confidence"),
            "evidence": (a.get("evidence") or [])[:2]}


def build(term, tweets, users, news_hits, narrs):
    roles = rex.account_roles(tweets, users)
    attackers, supporters, neutral = rex.split_sides(roles)
    camp = campaign.detect(term, tweets, users, len(news_hits)) if len(tweets) >= 5 else {}
    coord = camp.get("coordination_score", 0)

    er = entity_resolver.resolve_entity_alias(term)
    etype = er["type"] if er else "narrative"
    graph = graph_builder.build(term, etype, roles, narrs, news_hits)
    ev = evidence_collector.collect(tweets, news_hits)

    media = [{"source": s, "count": c} for s, c in
             Counter(h.get("source") for h in news_hits if h.get("source")).most_common(8)]

    return {
        "supporters": [_acc(a) for a in supporters[:10]],
        "opponents": [_acc(a) for a in attackers[:10]],
        "influencers": [_acc(a) for a in sorted(roles, key=lambda r: -r.get("influence", 0))[:8]],
        "media": media,
        "campaigns": ([{"hashtag": camp.get("main_hashtag"), "coordination_score": coord,
                        "level": camp.get("alert_level", {}).get("label")}] if coord >= 30 else []),
        "coordination_score": coord,
        "nodes": graph["nodes"], "edges": graph["edges"], "edge_types": graph["edge_types"],
        "evidence": ev["evidence"],
        "counts": {"supporters": len(supporters), "opponents": len(attackers), "neutral": len(neutral)},
    }
