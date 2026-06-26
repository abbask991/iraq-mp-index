"""Classify HOW an issue crossed the border: media-driven, political, coordinated,
or organic — inferred from the leading accounts' profiles."""
from app.services import network

_MEDIA = ["news", "press", "tv", "media", "channel", "agency", "قناه", "وكاله", "اخبار", "صحيفه", "اعلام", "press"]
_POL = ["نائب", "وزير", "حزب", "سياسي", "رئاسه", "كتله", "برلمان", "حكومه", "minister", "mp", "party"]


def _has(u, words):
    blob = ((u.get("username") or "") + " " + (u.get("description") or "")).lower()
    return any(w in blob for w in words)


def classify(leader_posts, users) -> dict:
    profiles = []
    for p in leader_posts:
        u = users.get(p.get("author_id"))
        if u:
            profiles.append(u)
    if not profiles:
        return {"type": "غير محدّد", "reason": "حسابات غير معروفة"}
    n = len(profiles)
    media = sum(1 for u in profiles if _has(u, _MEDIA))
    pol = sum(1 for u in profiles if _has(u, _POL))
    bots = sum(1 for u in profiles if network.bot_score(u)[0] >= 55)

    if bots / n >= 0.4:
        return {"type": "منسّق", "reason": f"{bots}/{n} حسابات بإشارات آلية", "color": "#f43f5e"}
    if media / n >= 0.34:
        return {"type": "إعلامي", "reason": f"{media}/{n} منافذ إعلامية", "color": "#a855f7"}
    if pol / n >= 0.34:
        return {"type": "سياسي", "reason": f"{pol}/{n} حسابات سياسية", "color": "#fb923c"}
    return {"type": "عضوي", "reason": "حسابات متنوّعة طبيعية", "color": "#22c55e"}
