"""Filters to keep the radar on *Iraqi individuals* — drop media channels/orgs
and clearly non-Iraqi accounts."""
from app.services import entity_resolver

_norm = entity_resolver.normalize_arabic

# media / channel / organisation markers (normalized)
_CHANNEL = [_norm(w) for w in [
    "tv", "قناة", "اخبار", "أخبار", "news", "press", "media", "ميديا", "شبكة",
    "وكالة", "صحيفة", "راديو", "اذاعة", "إذاعة", "channel", "agency", "نيوز",
    "رياضة", "sport", "فيلجول", "filgoal", "بث", "broadcast", "تلفزيون", "فضائية",
]]
_IRAQ = [_norm(w) for w in [
    "عراق", "العراق", "بغداد", "البصرة", "النجف", "كربلاء", "الموصل", "كركوك",
    "ذي قار", "الانبار", "بابل", "ديالى", "واسط", "ميسان", "الديوانية", "نينوى",
    "صلاح الدين", "اربيل", "السليمانية", "دهوك", "المثنى", "iraq", "baghdad",
    "basra", "najaf", "karbala", "mosul", "kirkuk", "erbil",
]]
_FOREIGN = [_norm(w) for w in [
    "السعودية", "saudi", "ksa", "الرياض", "riyadh", "الامارات", "uae", "دبي", "dubai",
    "مصر", "egypt", "القاهرة", "قطر", "qatar", "الدوحة", "الكويت", "kuwait",
    "لبنان", "lebanon", "بيروت", "سوريا", "syria", "الاردن", "jordan", "عمان الاردن",
    "المغرب", "تونس", "الجزائر", "بحرين", "اليمن", "فلسطين", "تركيا", "turkey",
]]


def _blob(u: dict) -> str:
    return _norm(" ".join([u.get("name") or "", u.get("username") or "",
                           u.get("description") or "", u.get("location") or ""]))


def is_channel(u: dict) -> bool:
    blob = _blob(u)
    if any(k and k in blob for k in _CHANNEL):
        return True
    # very large verified org with no personal markers → treat as channel
    fol = u.get("public_metrics", {}).get("followers_count", 0)
    return bool(u.get("verified") and fol > 1_500_000)


def is_iraqi(u: dict) -> bool:
    return any(k and k in _blob(u) for k in _IRAQ)


def is_foreign(u: dict) -> bool:
    blob = _blob(u)
    return any(k and k in blob for k in _FOREIGN) and not is_iraqi(u)


def keep_influencer(u: dict) -> bool:
    """Keep Iraqi individuals; drop channels and clearly-foreign accounts."""
    return not is_channel(u) and not is_foreign(u)
