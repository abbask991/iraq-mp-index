"""Evidence drill-down — the actual posts behind a number. Given a target + a
filter (oppose / support / negative / all), returns the real posts that drove it,
so analysts can click a score and SEE why. Target-aware AI classification for
accuracy; ranked by reach so the most influential evidence shows first.
"""
from app.services import network, x
from app.services.opinion import ai_opinion

FILTERS = {"oppose": "معارض", "support": "مؤيّد", "all": "الكل"}


async def get_evidence(target: str, filter: str = "oppose", rng: str = "week", limit: int = 120) -> dict:
    target = (target or "").strip()
    if not target:
        return {"error": "missing target"}
    f = filter if filter in FILTERS else "oppose"
    tw = await x.fetch_trend(target, want=limit, range=rng)
    tweets = tw.get("tweets", []) if "error" not in tw else []
    users = tw.get("users", {}) if "error" not in tw else {}
    if not tweets:
        return {"target": target, "filter": f, "count": 0, "posts": [], "error": tw.get("error")}

    verdicts = await ai_opinion.classify(target, [{"text": t.get("text", "")} for t in tweets])
    out = []
    for t, v in zip(tweets, verdicts):
        st = v.get("stance")
        if f != "all" and st != f:
            continue
        if f == "all" and st == "neutral":
            continue
        u = users.get(t.get("author_id"), {})
        out.append({
            "text": (t.get("text") or "")[:260], "author": u.get("username"),
            "name": u.get("name"), "verified": bool(u.get("verified")),
            "followers": u.get("public_metrics", {}).get("followers_count", 0),
            "engagement": t.get("engagement", 0),
            "bot": network.bot_score(u)[0] if u else 0,
            "stance": st, "stance_ar": "مؤيّد" if st == "support" else "معارض" if st == "oppose" else "محايد",
            "created_at": t.get("created_at"),
        })
    out.sort(key=lambda p: -(p["engagement"] + p["followers"] / 100))
    return {"target": target, "filter": f, "label": FILTERS[f],
            "count": len(out), "posts": out[:25], "scanned": len(tweets)}
