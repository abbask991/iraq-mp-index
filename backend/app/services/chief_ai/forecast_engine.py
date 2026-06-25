"""Strategic forecast — probabilities a decision-maker cares about, derived from
the digest signals (no extra cost)."""


def strategic(dg: dict) -> dict:
    narrs = dg.get("rising_narratives", [])
    camps = dg.get("active_campaigns", [])
    rs = dg.get("risk_summary", {})

    national = round(max((n.get("national_trend_probability", 0) for n in narrs), default=0) * 100)
    coord = max((c.get("coordination_score", 0) for c in camps), default=0)
    escalation = round(min(100, rs.get("crisis", 0) * 0.6 + rs.get("political", 0) * 0.4))
    # TV coverage tends to follow a strong national trend + news-side momentum
    tv = round(min(100, national * 0.7 + (20 if len(narrs) >= 3 else 0)))
    confidence = round(min(90, 40 + len(dg.get("entities", [])) * 4 + (10 if narrs else 0)))

    return {
        "national_trend_probability": national,
        "tv_coverage_probability": tv,
        "escalation_probability": escalation,
        "coordinated_campaign_probability": coord,
        "expected_peak_hours": 12 if national >= 50 else 24,
        "confidence": confidence,
        "note": "تقديرات احتمالية من إشارات المنصّة — لا قطعية.",
    }


def multi_horizon(dg: dict) -> dict:
    """Forecast across three decision horizons — confidence decays with distance."""
    base = strategic(dg)

    def at(label, factor, conf_penalty):
        return {
            "horizon": label,
            "national_trend": round(min(100, base["national_trend_probability"] * factor)),
            "media_crisis": round(min(100, base["escalation_probability"] * factor)),
            "narrative_growth": round(min(100, base["national_trend_probability"] * factor * 0.9)),
            "coordinated_campaign": round(min(100, base["coordinated_campaign_probability"] * factor)),
            "confidence": max(20, base["confidence"] - conf_penalty),
        }
    return {
        **base,
        "horizons": [
            at("غداً", 1.0, 0),
            at("خلال 72 ساعة", 0.85, 15),
            at("الأسبوع القادم", 0.65, 30),
        ],
    }
