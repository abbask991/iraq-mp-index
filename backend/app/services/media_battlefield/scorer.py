"""Battlefield scoring — Attack Pressure, Support Strength, Battlefield Advantage.

All component inputs are normalized 0-100; the weighted formulas are exactly as
specified. Pure + testable.
"""


def _clamp(v):
    return max(0, min(100, round(v)))


def attack_pressure(*, neg_volume, campaign_threat, influencer_amplification,
                    narrative_consistency, coordination, velocity):
    return _clamp(0.30 * neg_volume + 0.20 * campaign_threat + 0.15 * influencer_amplification
                  + 0.15 * narrative_consistency + 0.10 * coordination + 0.10 * velocity)


def support_strength(*, pos_volume, supporter_influence, engagement,
                     narrative_alignment, cross_platform):
    return _clamp(0.30 * pos_volume + 0.20 * supporter_influence + 0.20 * engagement
                  + 0.15 * narrative_alignment + 0.15 * cross_platform)


def advantage(*, positive_support_volume, influencer_support, narrative_dominance,
              cross_platform, engagement_momentum, attack_pressure_score):
    return _clamp(0.25 * positive_support_volume + 0.20 * influencer_support
                  + 0.20 * narrative_dominance + 0.15 * cross_platform
                  + 0.10 * engagement_momentum - 0.10 * attack_pressure_score)


def verdict(adv, ap, ss):
    """Human-readable battlefield state."""
    if ap >= 60 and ap > ss + 15:
        return {"state": "تحت ضغط هجومي", "winning": "attackers", "en": "Under attack"}
    if ss >= 60 and ss > ap + 15:
        return {"state": "موقف دفاعي قوي", "winning": "supporters", "en": "Well defended"}
    if adv >= 55:
        return {"state": "متقدّم", "winning": "entity", "en": "Gaining advantage"}
    if adv <= 40:
        return {"state": "متراجع", "winning": "attackers", "en": "Losing ground"}
    return {"state": "متوازن / متنازع عليه", "winning": "contested", "en": "Contested"}
