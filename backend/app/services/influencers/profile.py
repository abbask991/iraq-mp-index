"""Influencer Profile — for one account: who they SUPPORT, who they're AGAINST,
who they work with / amplify (allies), which campaigns they push, plus who
supports vs attacks THEM externally, a relationship network, and an AI read of
their role. Uses the account's own posts (from:user) + posts about them (@user).

Probability language only — co-mention/alliance are signals, never asserted as
coordination fact.
"""
import re
from collections import Counter

from app.services import entity_resolver, network, stance, trends, x
from app.services.collection import smart_classify
from app.services.influencers import target_stance
from app.services.media_battlefield import battlefield_summary, graph_builder
from app.services.media_battlefield import relationship_extractor as rex

_HASH = re.compile(r"#[\w؀-ۿ_]+")


async def _ai_stance(handle, posts, candidates):
    """One AI pass for accurate target-aware stance: given the account's own posts
    + candidate entities, return {entity: support|oppose|neutral}. Returns {} on
    any failure so the caller keeps the rule-based result."""
    import json as _json

    from app.config import ANTHROPIC_API_KEY, CLASSIFY_MODEL
    from app.services import ai_cache
    if not (ANTHROPIC_API_KEY and posts and candidates):
        return {}
    listed = "\n".join(f"- {p[:160]}" for p in posts[:25])
    cand = "، ".join(candidates[:10])
    prompt = (
        f"حساب @{handle}. أدناه منشوراته. لكل كيان من القائمة، حدّد موقف هذا الحساب منه بناءً على منشوراته فقط: "
        '"support" (داعم/مؤيد) أو "oppose" (معارض/منتقد) أو "neutral" (محايد/إخباري). '
        "اعتمد على مَن يخصّه المديح أو الذم في كل جملة، لا على نبرة المنشور عموماً. "
        'أعد JSON فقط: {"الكيان":"support|oppose|neutral", ...}\n\n'
        f"الكيانات: {cand}\n\nالمنشورات:\n{listed}"
    )
    cached = await ai_cache.get(CLASSIFY_MODEL, prompt)
    if cached is not None:
        return cached
    try:
        import httpx
        async with httpx.AsyncClient() as c:
            r = await c.post("https://api.anthropic.com/v1/messages",
                             headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                                      "content-type": "application/json"},
                             json={"model": CLASSIFY_MODEL, "max_tokens": 400,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=45)
            txt = r.json()["content"][0]["text"]
            out = _json.loads(txt[txt.find("{"):txt.rfind("}") + 1])
            await ai_cache.put(CLASSIFY_MODEL, prompt, out)
            return out
    except Exception:
        return {}


def _fallback_summary(handle, stance_net, supports, against, allies, tier_label):
    pos = "داعم" if stance_net > 20 else "معارض" if stance_net < -20 else "متوازن/محايد"
    return {
        "summary": (
            f"@{handle} حساب {tier_label} يميل لموقف {pos} (مؤشر {stance_net:+d}). "
            f"يدعم غالباً: {'، '.join(supports[:3]) or '—'}. يعارض/ينتقد: {'، '.join(against[:3]) or '—'}. "
            f"يتفاعل ويضخّم مع: {'، '.join('@'+a for a in allies[:3]) or '—'}. "
            "(تقدير آلي — التحالف/التنسيق إشارات تتطلّب مراجعة بشرية.)"
        ),
        "recommended_actions": [],
        "fallback": True,
    }


async def build_profile(handle, rng="week", limit=150):
    handle = (handle or "").lstrip("@").strip()
    if not handle:
        return {"error": "missing handle"}

    own = await x.fetch_trend(f"from:{handle}", want=limit, range=rng)
    about = await x.fetch_trend(f"@{handle} -is:retweet", want=80, range=rng)
    own_tw = own.get("tweets", []) if "error" not in own else []
    about_tw = about.get("tweets", []) if "error" not in about else []
    about_users = about.get("users", {}) if "error" not in about else {}

    if own_tw:
        cls, _ = await smart_classify.classify_posts(own_tw)
        for t, c in zip(own_tw, cls):
            t["sentiment"] = c.get("sentiment", "محايد")

    supports, against, allies, hashtags = Counter(), Counter(), Counter(), Counter()
    targets_acc = Counter()
    ent_net = Counter()                       # canonical -> net stance (target-aware, rule-based)
    mentioned = Counter()                     # canonical -> mention count (for AI candidates)
    for t in own_tw:
        txt = t.get("text", "")
        for st in target_stance.attribute(txt).values():
            ent_net[st["canonical"]] += st["net"]
        for e in entity_resolver.extract_entities(txt):
            mentioned[e["canonical"]] += 1
        negative_post = t.get("sentiment") == "سلبي"
        for m in t.get("mentions", []):
            if m and m.lower() != handle.lower():
                (targets_acc if negative_post else allies)[m] += 1
        for h in _HASH.findall(txt):
            hashtags[h] += 1

    # rule-based classification (fallback)
    thr = 2 if any(abs(n) >= 2 for n in ent_net.values()) else 1
    for canon, net in ent_net.items():
        if net >= thr:
            supports[canon] = net
        elif net <= -thr:
            against[canon] = -net

    # AI refinement (accurate, target-aware) — overrides rules when available
    candidates = [c for c, _ in mentioned.most_common(10)]
    ai_verdicts = await _ai_stance(handle, [t.get("text", "") for t in own_tw], candidates)
    if ai_verdicts:
        supports, against = Counter(), Counter()
        for canon, verdict in ai_verdicts.items():
            cnt = mentioned.get(canon, 1)
            if str(verdict).lower().startswith("support") or verdict in ("داعم", "مؤيد"):
                supports[canon] = cnt
            elif str(verdict).lower().startswith("oppos") or verdict in ("معارض", "منتقد"):
                against[canon] = cnt

    stance_dist = stance.aggregate([t.get("text", "") for t in own_tw]) if own_tw else \
        {"net": 0, "pct": {}, "dominant": "neutral"}

    # who supports / attacks THEM externally
    ext_supporters, ext_attackers = [], []
    if about_tw:
        if not all("sentiment" in t for t in about_tw):
            acls, _ = await smart_classify.classify_posts(about_tw)
            for t, c in zip(about_tw, acls):
                t["sentiment"] = c.get("sentiment", "محايد")
        roles = rex.account_roles(about_tw, about_users)
        atts, sups, _ = rex.split_sides(roles)
        ext_attackers = [{"username": a["username"], "influence": a["influence"], "followers": a["followers"]} for a in atts[:6]]
        ext_supporters = [{"username": a["username"], "influence": a["influence"], "followers": a["followers"]} for a in sups[:6]]

    sup_list = [e for e, _ in supports.most_common(6)]
    ag_list = [e for e, _ in against.most_common(6)]
    ally_list = [a for a, _ in allies.most_common(8)]

    # relationship network: influencer centre → supports(green) / against(red) / allies(blue)
    center = "inf:" + handle
    nodes = [{"id": center, "name": "@" + handle, "type": "influencer", "is_center": True,
              "influence_score": 100, "risk_score": 0}]
    edges = []
    for e, c in supports.most_common(6):
        nid = "ent:" + e
        nodes.append({"id": nid, "name": e, "type": "entity", "sentiment_score": 1})
        edges.append({"id": "e%d" % len(edges), "source_id": center, "target_id": nid,
                      "relationship_type": "supports", "weight": round(c, 1), "confidence": "likely"})
    for e, c in against.most_common(6):
        nid = "ent:" + e
        if not any(n["id"] == nid for n in nodes):
            nodes.append({"id": nid, "name": e, "type": "entity", "sentiment_score": -1})
        edges.append({"id": "e%d" % len(edges), "source_id": center, "target_id": nid,
                      "relationship_type": "attacks", "weight": round(c, 1), "confidence": "likely"})
    for a, c in allies.most_common(6):
        nid = "acc:" + a
        nodes.append({"id": nid, "name": "@" + a, "type": "influencer", "influence_score": min(80, c * 15)})
        edges.append({"id": "e%d" % len(edges), "source_id": center, "target_id": nid,
                      "relationship_type": "amplifies", "weight": round(c, 1), "confidence": "signal"})
    pos = graph_builder.layout([n["id"] for n in nodes], [(e["source_id"], e["target_id"]) for e in edges]) if nodes else {}
    for n in nodes:
        p = pos.get(n["id"], [0.5, 0.5])
        n["x"], n["y"] = round(p[0], 3), round(p[1], 3)

    u0 = (own.get("users") or {})
    prof = next(iter(u0.values()), {}) if u0 else {}
    fol = prof.get("public_metrics", {}).get("followers_count", 0)
    from app.services.influencers.radar import tier as _tier
    tinfo = _tier(fol)

    facts = (
        f"المؤثّر: @{handle} (متابعون ~{fol}، تصنيف {tinfo['label']}). "
        f"موقفه الصافي {stance_dist['net']:+d} (داعم موجب/معارض سالب). "
        f"يدعم: {'، '.join(sup_list[:4]) or '—'}. يعارض/ينتقد: {'، '.join(ag_list[:4]) or '—'}. "
        f"يتفاعل/يضخّم مع: {'، '.join('@'+a for a in ally_list[:4]) or '—'}. "
        f"أبرز هاشتاغاته: {'، '.join(h for h, _ in hashtags.most_common(4)) or '—'}. "
        f"خارجياً: داعمون له {len(ext_supporters)}، مهاجمون {len(ext_attackers)}."
    )
    summ = await battlefield_summary.summarize(facts)
    if not summ.get("summary"):
        summ = _fallback_summary(handle, stance_dist["net"], sup_list, ag_list, ally_list, tinfo["label"])

    return {
        "influencer": {"username": handle, "name": prof.get("name"), "followers": fol,
                       "verified": prof.get("verified", False), "tier": tinfo,
                       "bot": network.bot_score(prof)[0] if prof else 0,
                       "influence": trends.influence_score(prof)},
        "period": rng,
        "stance": {"net": stance_dist["net"], "label": "داعم" if stance_dist["net"] > 20 else "معارض" if stance_dist["net"] < -20 else "محايد",
                   "distribution": stance_dist.get("pct", {})},
        "supports": [{"entity": e, "count": c} for e, c in supports.most_common(6)],
        "against": [{"entity": e, "count": c} for e, c in against.most_common(6)],
        "works_with": [{"username": a, "count": c} for a, c in allies.most_common(8)],
        "targets_accounts": [{"username": a, "count": c} for a, c in targets_acc.most_common(6)],
        "campaigns": [{"hashtag": h, "count": c} for h, c in hashtags.most_common(8)],
        "external_supporters": ext_supporters,
        "external_attackers": ext_attackers,
        "network": {"nodes": nodes, "edges": edges,
                    "edge_types": dict(Counter(e["relationship_type"] for e in edges))},
        "summary": summ.get("summary", ""),
        "own_posts": len(own_tw), "about_posts": len(about_tw),
        "disclaimer": "تحليل احتمالي آلي — «يعمل مع/يضخّم» إشارات تفاعل لا إثبات تنسيق، وتتطلّب مراجعة بشرية.",
    }
