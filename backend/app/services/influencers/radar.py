"""Influencer Radar — discover the big + relatively-big accounts driving the
conversation, with each one's influence tier, net stance (supporter/opponent),
the entities they engage, and the hashtags they push. National scan, classified
cheaply via cluster-before-AI.
"""
import re
from collections import Counter, defaultdict

from app.services import entity_resolver, network, stance, trends, x
from app.services.collection import smart_classify
from app.services.narratives.discovery import NATIONAL_SEED

_HASH = re.compile(r"#[\w؀-ۿ_]+")


def tier(followers: int) -> dict:
    if followers >= 100000:
        return {"key": "big", "label": "كبير"}
    if followers >= 20000:
        return {"key": "mid", "label": "كبير نسبياً"}
    return {"key": "rising", "label": "صاعد"}


async def scan(rng="day", limit=600, min_followers=5000):
    tw = await x.fetch_trend(NATIONAL_SEED, want=limit, range=rng)
    if "error" in tw:
        return {"error": tw["error"], "influencers": []}
    tweets, users = tw["tweets"], tw["users"]
    if not tweets:
        return {"influencers": [], "scanned": 0}
    cls, _ = await smart_classify.classify_posts(tweets)
    for t, c in zip(tweets, cls):
        t["sentiment"] = c.get("sentiment", "محايد")

    agg = defaultdict(lambda: {"posts": 0, "eng": 0, "texts": [], "sup": 0, "opp": 0,
                               "hashtags": Counter(), "entities": Counter()})
    for t in tweets:
        a = t.get("author_id")
        d = agg[a]
        d["posts"] += 1
        d["eng"] += int(t.get("engagement") or 0)
        st = stance.classify_stance(t.get("text", ""))["stance"]
        if st == "support":
            d["sup"] += 1
        elif st in ("oppose", "sarcastic"):
            d["opp"] += 1
        for h in _HASH.findall(t.get("text", "")):
            d["hashtags"][h] += 1
        for e in entity_resolver.extract_entities(t.get("text", "")):
            d["entities"][e["canonical"]] += 1
        if len(d["texts"]) < 3 and t.get("text"):
            d["texts"].append(t["text"][:150])

    out = []
    for aid, d in agg.items():
        u = users.get(aid, {})
        fol = u.get("public_metrics", {}).get("followers_count", 0)
        if fol < min_followers and d["eng"] < 500:        # only meaningful accounts
            continue
        net = round((d["sup"] - d["opp"]) / max(1, d["sup"] + d["opp"]) * 100)
        out.append({
            "username": u.get("username") or aid, "name": u.get("name"),
            "followers": fol, "verified": u.get("verified", False),
            "influence": trends.influence_score(u), "posts": d["posts"], "engagement": d["eng"],
            "bot": network.bot_score(u)[0] if u else 0,
            "tier": tier(fol), "net_stance": net,
            "stance_label": "داعم" if net > 20 else "معارض" if net < -20 else "محايد",
            "top_entities": [e for e, _ in d["entities"].most_common(4)],
            "top_hashtags": [h for h, _ in d["hashtags"].most_common(4)],
            "sample": d["texts"][:2],
        })
    out.sort(key=lambda x: -(x["influence"] * 40 + x["engagement"] + x["followers"] / 1000))
    return {"influencers": out[:40], "scanned": len(tweets), "accounts": len(users), "range": rng,
            "disclaimer": "تصنيف آلي للمؤثرين بحسب الانتشار والموقف اللغوي — يتطلّب مراجعة بشرية."}
