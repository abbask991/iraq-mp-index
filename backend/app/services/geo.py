"""Geographic distribution across Iraq's 18 governorates.

Maps free-text account locations ("بغداد", "Baghdad, Iraq", "Erbil"…) to a
governorate, then counts activity per governorate for a heat/dot map. Each
governorate carries normalized (x,y) coords (≈ its real position) so the
frontend can plot a recognizable Iraq map without boundary SVG data.
"""
from app.services import entity_resolver

# id, Arabic name, x (west→east 0..1), y (north→south 0..1), match aliases
GOVERNORATES = [
    ("dohuk", "دهوك", 0.42, 0.06, ["دهوك", "duhok", "dohuk", "dahuk"]),
    ("nineveh", "نينوى", 0.30, 0.16, ["نينوى", "الموصل", "موصل", "nineveh", "ninawa", "mosul"]),
    ("erbil", "أربيل", 0.52, 0.13, ["اربيل", "أربيل", "هولير", "erbil", "arbil", "hawler"]),
    ("sulaymaniyah", "السليمانية", 0.66, 0.17, ["السليمانيه", "سليمانيه", "sulaymaniyah", "slemani", "sulaimania"]),
    ("kirkuk", "كركوك", 0.50, 0.25, ["كركوك", "kirkuk", "karkuk"]),
    ("salahuddin", "صلاح الدين", 0.45, 0.33, ["صلاح الدين", "تكريت", "سامراء", "salahuddin", "salah al-din", "tikrit", "samarra"]),
    ("diyala", "ديالى", 0.58, 0.39, ["ديالى", "بعقوبه", "diyala", "baquba"]),
    ("anbar", "الأنبار", 0.20, 0.42, ["الانبار", "أنبار", "الرمادي", "الفلوجه", "anbar", "ramadi", "fallujah"]),
    ("baghdad", "بغداد", 0.50, 0.42, ["بغداد", "baghdad", "bagdad"]),
    ("babil", "بابل", 0.47, 0.53, ["بابل", "الحله", "حله", "babil", "babylon", "hilla"]),
    ("karbala", "كربلاء", 0.39, 0.53, ["كربلاء", "karbala", "kerbala"]),
    ("wasit", "واسط", 0.62, 0.51, ["واسط", "الكوت", "كوت", "wasit", "kut"]),
    ("najaf", "النجف", 0.40, 0.63, ["النجف", "نجف", "najaf"]),
    ("qadisiyyah", "القادسية", 0.52, 0.61, ["القادسيه", "الديوانيه", "ديوانيه", "qadisiyyah", "diwaniyah"]),
    ("muthanna", "المثنى", 0.50, 0.73, ["المثنى", "السماوه", "سماوه", "muthanna", "samawah"]),
    ("dhiqar", "ذي قار", 0.62, 0.69, ["ذي قار", "ذيقار", "الناصريه", "ناصريه", "dhi qar", "nasiriyah", "thi qar"]),
    ("maysan", "ميسان", 0.72, 0.61, ["ميسان", "العماره", "عماره", "maysan", "amarah", "missan"]),
    ("basra", "البصرة", 0.74, 0.79, ["البصره", "بصره", "basra", "basrah", "basora"]),
]

_INDEX = []  # (alias_norm, gov_id, ar)
for gid, ar, x, y, aliases in GOVERNORATES:
    for a in aliases:
        _INDEX.append((entity_resolver.normalize_arabic(a), gid, ar))
# longer aliases first → "صلاح الدين" before short tokens
_INDEX.sort(key=lambda t: -len(t[0]))

_META = {gid: {"id": gid, "name": ar, "x": x, "y": y} for gid, ar, x, y, _ in GOVERNORATES}


def locate(location: str):
    """Map a free-text location to a governorate id (or None)."""
    norm = entity_resolver.normalize_arabic(location or "")
    if not norm:
        return None
    for alias_norm, gid, _ in _INDEX:
        if alias_norm and alias_norm in norm:
            return gid
    return None


def aggregate(users: dict) -> dict:
    """Count located accounts per governorate. `users` = {id: {location,...}}."""
    counts = {gid: 0 for gid, *_ in GOVERNORATES}
    located = 0
    for u in (users or {}).values():
        gid = locate(u.get("location", ""))
        if gid:
            counts[gid] += 1
            located += 1
    nodes = [{**_META[gid], "count": counts[gid]} for gid, *_ in GOVERNORATES]
    nodes.sort(key=lambda n: -n["count"])
    return {"governorates": nodes, "located": located, "total_accounts": len(users or {}),
            "top": [n for n in nodes if n["count"] > 0][:5]}
