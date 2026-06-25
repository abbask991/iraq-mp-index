"""Suggested questions — context-aware prompts the executive can click to ask."""


def suggest(dg: dict) -> list[str]:
    qs = []
    camps = dg.get("active_campaigns", [])
    narrs = dg.get("rising_narratives", [])
    movers = dg.get("movers", [])
    top_risk = dg.get("top_risk", [])

    if camps:
        qs.append(f"من بدأ حملة #{camps[0].get('hashtag')}؟")
    if narrs:
        qs.append(f"من يستفيد من سردية «{narrs[0].get('narrative')}» اليوم؟")
    if top_risk:
        qs.append(f"من يهاجم {top_risk[0].get('name')}؟")
    if movers:
        worst = min(movers, key=lambda e: e.get("rep_delta", 0))
        if worst.get("rep_delta", 0) < 0:
            qs.append(f"لماذا تراجعت سمعة {worst.get('name')}؟")
    qs += [
        "ما أبرز مخاطر اليوم؟",
        "أي حملة الأسرع نمواً الآن؟",
        "قارن مزاج الإعلام اليوم بالأمس.",
        "ما المتوقّع غداً؟",
    ]
    # de-dupe, keep order
    seen, out = set(), []
    for q in qs:
        if q not in seen:
            seen.add(q)
            out.append(q)
    return out[:8]
