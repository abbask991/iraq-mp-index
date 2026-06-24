"""Campaign Threat Score weighting + alert banding + human-readable explanation."""

WEIGHTS = {
    "text_similarity": 0.20,
    "timing_sync": 0.15,
    "account_suspicion": 0.15,
    "network_amplification": 0.15,
    "link_repetition": 0.10,
    "hashtag_pattern": 0.10,
    "cross_platform": 0.05,
    "narrative_consistency": 0.05,
    "influencer_trigger": 0.05,
}

_DRIVER_LABEL = {
    "text_similarity": "تشابه نصّي عالٍ (تكرار/نسخ-لصق)",
    "timing_sync": "تزامن في توقيت النشر",
    "account_suspicion": "نسبة حسابات مشبوهة مرتفعة",
    "network_amplification": "تضخيم متبادل بين حسابات",
    "link_repetition": "تكرار رابط/دومين واحد",
    "hashtag_pattern": "نمط هاشتاغات مفتعل",
    "cross_platform": "انتشار عبر منصّات",
    "narrative_consistency": "تماسك سردية واحدة",
    "influencer_trigger": "تحريك من حسابات مؤثّرة",
}


def score(sub: dict) -> int:
    """Weighted 0-100 Campaign Threat Score from the sub-signals."""
    return round(sum(sub.get(k, 0) * w for k, w in WEIGHTS.items()))


def alert(score_value: int) -> dict:
    if score_value >= 85:
        return {"level": "highly", "label": "حملة منظّمة عالية الاحتمال", "en": "Highly Coordinated"}
    if score_value >= 70:
        return {"level": "strong", "label": "إشارة تنسيق قوية", "en": "Strong"}
    if score_value >= 50:
        return {"level": "possible", "label": "حملة منظّمة محتملة", "en": "Possible"}
    if score_value >= 30:
        return {"level": "weak", "label": "إشارة تنسيق ضعيفة", "en": "Weak"}
    return {"level": "organic", "label": "عضوي / طبيعي", "en": "Organic"}


def explanation(sub: dict, facts: dict) -> str:
    top = sorted(sub.items(), key=lambda kv: -kv[1])[:3]
    drivers = "، ".join(_DRIVER_LABEL[k] for k, v in top if v >= 35) or "إشارات ضعيفة"
    return (
        f"احتمال تنسيق مبني على: {drivers}. "
        f"نسبة المحتوى المكرّر ~{int(facts['dup']*100)}٪، وذروة النشر بـ15 دقيقة ~{int(facts['peak']*100)}٪، "
        f"وحسابات مشبوهة ~{int(facts['susp']*100)}٪. "
        "هذه مؤشرات احتمالية وليست اتهاماً قاطعاً — تتطلّب مراجعة بشرية قبل أي توصيف نهائي."
    )
