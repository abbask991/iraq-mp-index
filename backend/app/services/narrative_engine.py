"""Narrative engine — dominance scoring + evolution tracking (#3).

A "narrative" is a recurring framing of an issue (e.g. انقطاع الكهرباء → فشل حكومي
→ فساد → دعوات احتجاج). This engine clusters posts into narratives, scores how
dominant the leading narrative is, and reconstructs how narratives emerge, merge,
split, and fade across time windows.
"""
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone

from app.services import trends

_TOK = re.compile(r"[؀-ۿ]{4,}")


def _post_dt(p):
    raw = p.get("created_at") or p.get("date") or ""
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")) if len(raw) > 10 \
            else datetime.fromisoformat(raw).replace(tzinfo=timezone.utc)
    except Exception:
        return None


def narratives(posts):
    """Cluster posts into narratives by issue-type, labelled + keyworded."""
    by_type = defaultdict(list)
    for p in posts:
        t = p.get("type") or "عام"
        by_type[t].append(p)
    total = len(posts) or 1
    out = []
    for t, group in by_type.items():
        if t == "عام" and len(by_type) > 1:
            continue
        words = Counter()
        neg = 0
        for p in group:
            for w in _TOK.findall((p.get("title") or p.get("text") or "")):
                if w not in trends.AR_STOP:
                    words[w] += 1
            if p.get("sentiment") == "سلبي":
                neg += 1
        out.append({
            "narrative": trends.NARRATIVE_MAP.get(t, t),
            "type": t, "posts": len(group),
            "share": round(len(group) / total * 100),
            "neg_ratio": round(neg / len(group), 2) if group else 0,
            "keywords": [w for w, _ in words.most_common(6)],
        })
    out.sort(key=lambda n: -n["posts"])
    return out


def dominance_score(narrs):
    """0-100 how concentrated the conversation is around one narrative (HHI)."""
    if not narrs:
        return {"score": 0, "leader": None, "diversity": 0}
    shares = [n.get("share", 0) / 100 for n in narrs]
    hhi = sum(s * s for s in shares)                     # 0..1
    score = round(hhi * 100)
    return {"score": score, "leader": narrs[0].get("narrative"),
            "leader_share": narrs[0].get("share", 0), "narratives": len(narrs),
            "explain": "هيمنة السردية = مدى تركّز النقاش حول سردية واحدة (مؤشر هيرفندال)."}


def evolution(posts, window="day"):
    """Reconstruct narrative evolution across time windows: which narrative leads
    each window, what newly emerges, what fades, and the dominant-narrative chain."""
    fmt = "%Y-%m-%d" if window == "day" else "%Y-%m-%d %H"
    buckets = defaultdict(list)
    for p in posts:
        dt = _post_dt(p)
        if dt:
            buckets[dt.strftime(fmt)].append(p)

    stages = []
    prev_set = set()
    chain = []
    for key in sorted(buckets):
        narrs = narratives(buckets[key])
        cur_set = {n["narrative"] for n in narrs if n["share"] >= 15}
        dominant = narrs[0]["narrative"] if narrs else None
        stages.append({
            "window": key,
            "dominant": dominant,
            "narratives": [{"narrative": n["narrative"], "share": n["share"]} for n in narrs[:4]],
            "emerged": sorted(cur_set - prev_set),
            "faded": sorted(prev_set - cur_set),
        })
        if dominant and (not chain or chain[-1] != dominant):
            chain.append(dominant)
        prev_set = cur_set

    return {"window": window, "stages": stages, "chain": chain,
            "shifts": max(0, len(chain) - 1),
            "explain": "تطوّر السردية: السردية المهيمنة بكل فترة + ما ظهر وما اختفى + سلسلة التحوّل."}
