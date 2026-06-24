"""AI Scenario Simulator (#14) — strategic what-if projection.

Given an entity's current state, estimate the likely media reaction to a decision
(issue a statement, stay silent, delete a post, …) using historical response
patterns. Output is explicitly probabilistic with a confidence + disclaimer — it
is decision-support, not prophecy.
"""

# effect models: multiplicative/additive deltas on the baseline state, with a
# short rationale grounded in observed Iraqi media dynamics.
SCENARIOS = {
    "official_response": {
        "label": "إصدار بيان/رد رسمي",
        "neg_ratio": 0.70, "volume": 1.30, "risk": -15, "escalation": -25, "reputation": +8,
        "rationale": "الردود الرسمية تاريخياً تخفّض النبرة السلبية خلال 24-48 ساعة مع قفزة ظهور مؤقتة.",
        "base_prob": 0.7,
    },
    "no_response": {
        "label": "الصمت / عدم الرد",
        "neg_ratio": 1.18, "volume": 1.05, "risk": +12, "escalation": +22, "reputation": -6,
        "rationale": "غياب الرد يُبقي السردية السلبية تتمدّد ويرفع احتمال التصعيد، خاصة مع وجود حملة.",
        "base_prob": 0.65,
    },
    "delete_post": {
        "label": "حذف منشور مثير للجدل",
        "neg_ratio": 1.05, "volume": 0.8, "risk": +5, "escalation": +8, "reputation": -3,
        "rationale": "الحذف يقلّل الظهور المباشر لكنه قد يُحدث أثر سترايسند إذا كان المنشور واسع الانتشار.",
        "base_prob": 0.55, "streisand_reach": 200000,
    },
    "counter_campaign": {
        "label": "إطلاق حملة مضادة",
        "neg_ratio": 0.85, "volume": 1.5, "risk": -8, "escalation": -10, "reputation": +4,
        "rationale": "الحملات المضادة تخفّف الهيمنة السلبية لكنها ترفع حجم النقاش وقد تثير اتهامات بالتنظيم.",
        "base_prob": 0.5,
    },
    "ally_statement": {
        "label": "تدخّل حليف مؤثّر",
        "neg_ratio": 0.88, "volume": 1.2, "risk": -10, "escalation": -12, "reputation": +6,
        "rationale": "دعم حليف مؤثّر يعيد التوازن للسردية ويخفّف الخطر تدريجياً.",
        "base_prob": 0.6,
    },
}


def _clamp(v, lo=0, hi=100):
    return max(lo, min(hi, v))


def simulate(baseline: dict, scenario: str) -> dict:
    """baseline = {neg_ratio, volume, reach, risk, escalation, reputation}.
    Returns projected state + deltas + probability + confidence."""
    model = SCENARIOS.get(scenario)
    if not model:
        return {"error": "unknown_scenario", "available": list(SCENARIOS)}

    neg0 = baseline.get("neg_ratio", 0.3)
    vol0 = baseline.get("volume", 100)
    reach = baseline.get("reach", 0)
    risk0 = baseline.get("risk", 40)
    esc0 = baseline.get("escalation", 30)
    rep0 = baseline.get("reputation", 50)

    proj = {
        "neg_ratio": round(min(1.0, neg0 * model["neg_ratio"]), 2),
        "volume": round(vol0 * model["volume"]),
        "risk": _clamp(risk0 + model["risk"]),
        "escalation": _clamp(esc0 + model["escalation"]),
        "reputation": _clamp(rep0 + model["reputation"]),
    }
    notes = [model["rationale"]]
    # Streisand modifier for deletions on highly-visible content
    if scenario == "delete_post" and reach >= model.get("streisand_reach", 1e9):
        proj["volume"] = round(vol0 * 1.4)
        proj["neg_ratio"] = round(min(1.0, neg0 * 1.2), 2)
        proj["risk"] = _clamp(risk0 + 18)
        notes.append("⚠️ الوصول مرتفع → أثر سترايسند مرجّح: الحذف قد يضاعف الانتشار.")

    # confidence drops when the current state is already extreme/volatile
    confidence = round(max(0.3, model["base_prob"] - (0.2 if esc0 >= 70 else 0)), 2)

    return {
        "scenario": scenario, "label": model["label"],
        "baseline": {"neg_ratio": round(neg0, 2), "volume": vol0, "risk": risk0,
                     "escalation": esc0, "reputation": rep0},
        "projected": proj,
        "deltas": {"risk": proj["risk"] - risk0, "escalation": proj["escalation"] - esc0,
                   "reputation": proj["reputation"] - rep0},
        "probability": confidence,
        "rationale": " ".join(notes),
        "disclaimer": "تقدير احتمالي قائم على أنماط تاريخية — ليس تنبؤاً قاطعاً ويتطلّب حكماً بشرياً.",
    }


async def simulate_entity(entity_id: str, scenario: str) -> dict:
    """Build the entity twin, derive a baseline, and project the scenario."""
    from app.services import digital_twin
    twin = await digital_twin.build(entity_id)
    baseline = {
        "neg_ratio": twin["scores"]["political_risk"]["components"].get("negativity", 30) / 100,
        "volume": twin["media_exposure"]["mentions"] or 100,
        "reach": twin["media_exposure"]["reach"],
        "risk": twin["risk"]["score"],
        "escalation": twin["crisis"]["score"],
        "reputation": twin["reputation"]["score"],
    }
    out = simulate(baseline, scenario)
    out["entity_id"] = entity_id
    return out
