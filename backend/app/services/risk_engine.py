"""Political-Risk & Crisis-Escalation scoring.

Risk = standing exposure (how negative + how coordinated the environment is).
Crisis escalation = momentum of a developing negative event (is it accelerating,
spreading, and going unanswered?). Both are explainable and staged.
"""


def political_risk_score(*, neg_ratio, neg_velocity=0.0, campaign_score=0,
                         manipulation_index=0, reach=0):
    """0-100 political risk from negativity, hostile-campaign signals, manipulation."""
    import math
    neg_c = min(100, neg_ratio * 130)
    velocity_c = min(100, max(0, neg_velocity) * 20)
    campaign_c = campaign_score
    manip_c = manipulation_index
    reach_c = min(100, math.log10(reach + 1) * 12) if reach else 30
    components = {"negativity": round(neg_c), "neg_velocity": round(velocity_c),
                  "hostile_campaign": round(campaign_c), "manipulation": round(manip_c),
                  "reach": round(reach_c)}
    weights = {"negativity": 0.35, "neg_velocity": 0.15, "hostile_campaign": 0.25,
               "manipulation": 0.15, "reach": 0.10}
    score = round(sum(components[k] * w for k, w in weights.items()))
    level = ("حرج" if score >= 75 else "مرتفع" if score >= 55
             else "متوسط" if score >= 35 else "منخفض")
    return {"score": score, "level": level, "components": components,
            "drivers": [k for k, _ in sorted(components.items(), key=lambda kv: -kv[1])[:2]],
            "explain": "الخطر السياسي = النبرة السلبية + تسارعها + الحملات المعادية + التلاعب + الوصول."}


# crisis stages by escalation score
_STAGES = [(80, "اشتعال", "active_crisis"), (60, "تصاعد", "escalating"),
           (40, "تحذير", "warning"), (20, "مراقبة", "watch"), (0, "هادئ", "calm")]


def crisis_escalation_score(*, neg_velocity=0.0, neg_acceleration=0.0, reach=0,
                            campaign_threat=0, official_response=False, persistence=0):
    """0-100 escalation — momentum of a negative event, penalized by an official
    response (which usually defuses) and amplified by acceleration + persistence."""
    import math
    velocity_c = min(100, max(0, neg_velocity) * 22)
    accel_c = min(100, max(0, neg_acceleration) * 30)
    reach_c = min(100, math.log10(reach + 1) * 13) if reach else 25
    threat_c = campaign_threat
    persist_c = min(100, persistence * 12)
    raw = (0.30 * velocity_c + 0.25 * accel_c + 0.20 * reach_c
           + 0.15 * threat_c + 0.10 * persist_c)
    if official_response:
        raw *= 0.7                                    # a response typically cools it
    score = round(max(0, min(100, raw)))
    stage = next((lbl, en) for thr, lbl, en in _STAGES if score >= thr)
    return {"score": score, "stage": stage[0], "stage_key": stage[1],
            "official_response": official_response,
            "components": {"velocity": round(velocity_c), "acceleration": round(accel_c),
                           "reach": round(reach_c), "threat": round(threat_c),
                           "persistence": round(persist_c)},
            "explain": "تصعيد الأزمة = زخم النبرة السلبية وتسارعها وانتشارها والتهديد − أثر الرد الرسمي."}
