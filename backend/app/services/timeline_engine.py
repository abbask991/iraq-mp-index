"""Timeline engine (#2) — reconstruct the full evolution of an event/campaign/
hashtag/narrative: origin → amplification stages → turning points, annotated with
the narrative chain. Orchestrates timeline.py + narrative_engine + origin tracing.
"""
from app.services import narrative_engine, timeline

_TURNING = {"velocity_spike", "sentiment_shift", "peak_detected", "campaign_alert",
            "first_influencer_amplification", "official_response"}


def reconstruct(posts, users=None, metrics=None):
    """Build a unified intelligence timeline from raw posts."""
    milestones = timeline.detect_timeline_milestones(posts, metrics)
    evo = narrative_engine.evolution(posts, window="day")

    origin = next((m for m in milestones if m["type"] == "first_seen"), None)
    amplification = [m for m in milestones
                     if m["type"] in ("first_telegram_mention", "first_x_mention",
                                      "first_news_article", "first_influencer_amplification")]
    turning_points = [m for m in milestones if m["type"] in _TURNING]

    return {
        "origin": origin,
        "amplification_stages": amplification,
        "turning_points": turning_points,
        "milestones": milestones,
        "narrative_chain": evo["chain"],
        "narrative_shifts": evo["shifts"],
        "narrative_stages": evo["stages"],
        "explain": "إعادة بناء كاملة: نقطة الانطلاق → مراحل التضخيم → نقاط التحوّل، "
                   "مع سلسلة تطوّر السردية.",
    }
