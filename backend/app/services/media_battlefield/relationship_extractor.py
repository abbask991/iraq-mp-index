"""Extract battlefield relationships from posts.

Maps each account to a ROLE toward the entity — attacker / supporter / neutral —
by combining stance language (support/oppose/sarcasm) with sentiment, plus its
amplification weight. Coordination/funding are never asserted as fact (handled
with probability language downstream).
"""
from collections import defaultdict

from app.services import network, stance, trends


def account_roles(tweets, users):
    agg = defaultdict(lambda: {"posts": 0, "eng": 0, "support": 0, "oppose": 0, "neg": 0, "pos": 0, "texts": []})
    for t in tweets:
        a = t.get("author_id")
        d = agg[a]
        d["posts"] += 1
        d["eng"] += int(t.get("engagement") or 0)
        st = stance.classify_stance(t.get("text", ""))["stance"]
        if st == "support":
            d["support"] += 1
        elif st in ("oppose", "sarcastic"):
            d["oppose"] += 1
        sent = t.get("sentiment")
        if sent == "سلبي":
            d["neg"] += 1
        elif sent == "إيجابي":
            d["pos"] += 1
        if len(d["texts"]) < 3 and t.get("text"):
            d["texts"].append(t["text"][:170])

    out = []
    for aid, d in agg.items():
        u = users.get(aid, {})
        sup = d["support"] + d["pos"] * 0.5
        att = d["oppose"] + d["neg"] * 0.5
        role = "support" if sup > att and sup > 0 else "attack" if att > sup and att > 0 else "neutral"
        out.append({
            "id": aid, "username": u.get("username") or aid, "name": u.get("name"),
            "role": role, "posts": d["posts"], "engagement": d["eng"],
            "influence": trends.influence_score(u), "bot": network.bot_score(u)[0] if u else 0,
            "confidence": round(abs(sup - att) / (d["posts"] or 1), 2),
            "followers": u.get("public_metrics", {}).get("followers_count", 0),
            "verified": u.get("verified", False), "evidence": d["texts"],
        })
    out.sort(key=lambda x: -(x["influence"] * 30 + x["engagement"] + x["posts"] * 5))
    return out


def split_sides(roles):
    attackers = [r for r in roles if r["role"] == "attack"]
    supporters = [r for r in roles if r["role"] == "support"]
    neutral = [r for r in roles if r["role"] == "neutral"]
    return attackers, supporters, neutral
