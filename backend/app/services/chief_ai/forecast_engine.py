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
