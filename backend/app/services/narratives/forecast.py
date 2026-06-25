"""Narrative Forecast — growth probability, estimated peak, expected reach, and
probabilities of TV coverage + political escalation, with a confidence score.
Wraps the generic forecast engine and adds narrative-specific escalation odds.
"""
from app.services import forecast as fc


def predict(series, *, avg_followers=0, neg_ratio=0.0, coordination=0,
            influencer=0, media_present=False, bucket_minutes=60):
    series = [float(x) for x in (series or [])]
    base = fc.forecast(series, bucket_minutes=bucket_minutes, avg_followers=avg_followers)
    growth = round(base.get("major_trend_probability", 0) * 100)   # 0..1 -> 0..100
    vel = base.get("velocity", 0)
    peak = base.get("predicted_peak", {}) or {}
    eta = peak.get("eta_minutes")
    samples = len(series)

    tv = min(95, round(growth * 0.5 + (40 if media_present else 0)
                       + min(20, coordination * 0.2)))
    escalation = min(95, round(neg_ratio * 45 + coordination * 0.3
                               + influencer * 0.25 + growth * 0.2))
    confidence = max(10, min(90, round(40 + min(40, samples * 3)
                                       + (10 if media_present else 0) - (15 if samples < 3 else 0))))
    return {
        "growth_probability": growth,
        "peak_status": peak.get("status"),
        "estimated_peak_hours": round(eta / 60, 1) if eta else None,
        "expected_reach": base.get("estimated_reach", 0),
        "tv_coverage_probability": tv,
        "political_escalation_probability": escalation,
        "velocity": round(vel, 1),
        "confidence": confidence,
        "explain": "توقّع احتمالي مبني على سرعة الانتشار، التنسيق، ومشاركة المؤثرين — يتطلّب مراجعة بشرية.",
    }
