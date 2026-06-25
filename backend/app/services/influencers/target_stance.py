"""Target-aware stance — does a post SUPPORT or OPPOSE *a specific entity*,
judged by the stance words near that entity's mention (not the whole-post mood
applied to every entity). This is the accuracy fix: "أدعم الحلبوسي ضد السوداني"
correctly marks الحلبوسي=support, السوداني=oppose instead of tagging both the same.
"""
from app.services import entity_resolver
from app.services.stance import _LEX_NORM

_WINDOW = 45          # chars on each side of the entity mention to read for stance

_AMAP = None


def alias_map() -> dict:
    """entity_id -> {canonical, type, aliases:[normalized]}. Built once."""
    global _AMAP
    if _AMAP is None:
        m: dict = {}
        for alias_norm, e in entity_resolver._ALIAS_INDEX.items():
            if len(alias_norm) >= 4:
                m.setdefault(e["id"], {"canonical": e["canonical"], "type": e["type"], "aliases": []})
                m[e["id"]]["aliases"].append(alias_norm)
        _AMAP = m
    return _AMAP


_MAXDIST = 40          # max chars between a stance word and the entity it governs


def _entity_spans(norm: str) -> list[tuple]:
    """First occurrence span of each known entity: (eid, canonical, start)."""
    spans = []
    for eid, info in alias_map().items():
        best = -1
        for a in info["aliases"]:
            idx = norm.find(a)
            if idx >= 0 and (best < 0 or idx < best):
                best = idx
        if best >= 0:
            spans.append((eid, info["canonical"], best))
    return spans


def _governed_entity(pos: int, spans: list[tuple]):
    """The entity a stance word at `pos` refers to. Arabic is verb→object, so
    prefer the nearest entity that FOLLOWS the word; else the nearest preceding."""
    after = [s for s in spans if s[2] >= pos]
    if after:
        eid, canon, st = min(after, key=lambda s: s[2] - pos)
        if st - pos <= _MAXDIST:
            return eid, canon
    before = [s for s in spans if s[2] < pos]
    if before:
        eid, canon, st = min(before, key=lambda s: pos - s[2])
        if pos - st <= _MAXDIST:
            return eid, canon
    return None


def attribute(text: str) -> dict:
    """Target-aware stance: each stance word is attributed to the entity it
    governs (nearest following entity in Arabic verb→object order). Returns
    {entity_id: {canonical, sup, opp, net}} for entities with a real signal."""
    norm = entity_resolver.normalize_arabic(text or "")
    if not norm:
        return {}
    spans = _entity_spans(norm)
    if not spans:
        return {}
    acc: dict = {}
    for pol, words in (("sup", _LEX_NORM["support"]),
                       ("opp", _LEX_NORM["oppose"]), ("opp", _LEX_NORM["sarcastic"])):
        for w in words:
            start = 0
            while True:
                i = norm.find(w, start)
                if i < 0:
                    break
                tgt = _governed_entity(i, spans)
                if tgt:
                    eid, canon = tgt
                    a = acc.setdefault(eid, [canon, 0, 0])
                    a[1 if pol == "sup" else 2] += 1
                start = i + len(w)
    return {eid: {"canonical": c, "sup": s, "opp": o, "net": s - o}
            for eid, (c, s, o) in acc.items() if (s + o) > 0}
