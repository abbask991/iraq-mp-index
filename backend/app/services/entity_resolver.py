"""Entity alias resolution for Arabic / Iraq.

The same person appears as «محمد شياع السوداني», «السوداني», «رئيس الوزراء»,
«PM Sudani»… Resolving these to one canonical entity is essential for Share of
Voice, knowledge graph, and timelines. Normalization handles diacritics, alef /
hamza / ya / ta-marbuta variants, and tatweel.

A built-in seed registry covers major Iraqi figures/parties/bodies; the DB
`entity_aliases` table extends it at runtime without code changes.
"""
import re

# ---- Arabic normalization ----
_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")
_NONWORD = re.compile(r"[^\w\s]", re.U)
_WS = re.compile(r"\s+")
_TRANS = str.maketrans({
    "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ئ": "ي",
    "ؤ": "و", "ة": "ه", "ـ": "",
})


def normalize_arabic(text: str) -> str:
    """Diacritic-free, variant-folded, lowercased, punctuation-stripped form."""
    if not text:
        return ""
    t = _DIACRITICS.sub("", text)
    t = t.translate(_TRANS)
    t = _NONWORD.sub(" ", t)
    return _WS.sub(" ", t).strip().lower()


# ---- seed registry (canonical → aliases). Extend via the entity_aliases table. ----
SEED_ENTITIES = [
    {"id": "sudani", "type": "politician", "canonical": "محمد شياع السوداني",
     "aliases": ["السوداني", "محمد السوداني", "رئيس الوزراء", "رئيس مجلس الوزراء",
                 "رئيس الحكومة", "PM Sudani", "Al-Sudani", "Mohammed Al-Sudani"]},
    {"id": "maliki", "type": "politician", "canonical": "نوري المالكي",
     "aliases": ["المالكي", "نوري كامل المالكي", "Al-Maliki", "Nouri al-Maliki"]},
    {"id": "halbousi", "type": "politician", "canonical": "محمد الحلبوسي",
     "aliases": ["الحلبوسي", "رئيس البرلمان", "رئيس مجلس النواب", "Al-Halbousi"]},
    {"id": "sadr", "type": "politician", "canonical": "مقتدى الصدر",
     "aliases": ["الصدر", "السيد مقتدى", "مقتدى", "Muqtada al-Sadr", "Al-Sadr"]},
    {"id": "ameri", "type": "politician", "canonical": "هادي العامري",
     "aliases": ["العامري", "هادي الفرطوسي", "Al-Ameri", "Hadi al-Amiri"]},
    {"id": "kadhimi", "type": "politician", "canonical": "مصطفى الكاظمي",
     "aliases": ["الكاظمي", "Al-Kadhimi", "Mustafa al-Kadhimi"]},
    {"id": "khazali", "type": "politician", "canonical": "قيس الخزعلي",
     "aliases": ["الخزعلي", "Al-Khazali", "Qais al-Khazali"]},
    {"id": "state_of_law", "type": "party", "canonical": "ائتلاف دولة القانون",
     "aliases": ["دولة القانون", "State of Law"]},
    {"id": "coordination_framework", "type": "coalition", "canonical": "الإطار التنسيقي",
     "aliases": ["الاطار التنسيقي", "الاطار", "Coordination Framework"]},
    {"id": "pmf", "type": "body", "canonical": "هيئة الحشد الشعبي",
     "aliases": ["الحشد الشعبي", "الحشد", "PMF", "Hashd"]},
    {"id": "min_electricity", "type": "ministry", "canonical": "وزارة الكهرباء",
     "aliases": ["الكهرباء", "Ministry of Electricity"]},
    {"id": "min_oil", "type": "ministry", "canonical": "وزارة النفط",
     "aliases": ["النفط", "Ministry of Oil"]},
]

# precompute normalized alias → entity lookup
_ALIAS_INDEX: dict[str, dict] = {}
for _e in SEED_ENTITIES:
    for _a in [_e["canonical"], *_e["aliases"]]:
        _ALIAS_INDEX[normalize_arabic(_a)] = _e


def resolve_entity_alias(text: str) -> dict | None:
    """Resolve a name/alias to its canonical entity, or None."""
    norm = normalize_arabic(text)
    if not norm:
        return None
    if norm in _ALIAS_INDEX:
        e = _ALIAS_INDEX[norm]
        return {"id": e["id"], "canonical": e["canonical"], "type": e["type"], "matched": text}
    # containment fallback (e.g. "تصريح السوداني اليوم" → sudani)
    for alias_norm, e in _ALIAS_INDEX.items():
        if len(alias_norm) >= 4 and re.search(rf"(^|\s){re.escape(alias_norm)}(\s|$)", norm):
            return {"id": e["id"], "canonical": e["canonical"], "type": e["type"], "matched": alias_norm}
    return None


def extract_entities(text: str) -> list[dict]:
    """All distinct known entities mentioned in a piece of text."""
    norm = normalize_arabic(text)
    found = {}
    for alias_norm, e in _ALIAS_INDEX.items():
        if len(alias_norm) >= 4 and re.search(rf"(^|\s){re.escape(alias_norm)}(\s|$)", norm):
            found[e["id"]] = {"id": e["id"], "canonical": e["canonical"], "type": e["type"]}
    return list(found.values())


# ---- DB-backed extension + maintenance ----
async def load_db_aliases():
    """Merge entity_aliases rows into the in-memory index (best-effort)."""
    from app.services import db
    rows = await db.select("entity_aliases", "select=entity_id,alias,canonical,type&limit=5000")
    for r in rows:
        e = {"id": r.get("entity_id"), "canonical": r.get("canonical") or r.get("alias"),
             "type": r.get("type") or "entity"}
        _ALIAS_INDEX[normalize_arabic(r.get("alias", ""))] = e
    return len(rows)


async def merge_duplicate_entities():
    """Collapse entities whose normalized canonical names collide (best-effort)."""
    from app.services import db
    rows = await db.select("entities", "select=id,canonical&limit=5000")
    by_norm: dict[str, list] = {}
    for r in rows:
        by_norm.setdefault(normalize_arabic(r.get("canonical", "")), []).append(r)
    merged = 0
    for norm, group in by_norm.items():
        if len(group) > 1:
            keep = group[0]["id"]
            for dup in group[1:]:
                await db.update("entity_relationships", f"source_id=eq.{dup['id']}", {"source_id": keep})
                await db.update("entity_relationships", f"target_id=eq.{dup['id']}", {"target_id": keep})
                merged += 1
    return {"groups": sum(1 for g in by_norm.values() if len(g) > 1), "merged": merged}
