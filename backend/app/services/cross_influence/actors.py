"""Influence leaders (who drove an issue first) and receivers (who echoed it)."""
from collections import defaultdict
from datetime import datetime, timezone

from app.services.cross_influence.flow import _dt


def rank(posts, users, *, by_time=False, top=5, exclude=None):
    """Aggregate an issue's posts by account. Leaders rank by earliest+loudest;
    receivers rank by engagement. `exclude` drops cross-pool (pan-regional)
    accounts so a leader can't also appear as a receiver."""
    exclude = exclude or set()
    agg = defaultdict(lambda: {"eng": 0, "posts": 0, "first": None})
    for p in posts:
        uid = p.get("author_id")
        if not uid or uid in exclude:
            continue
        a = agg[uid]
        a["eng"] += int(p.get("engagement") or 0)
        a["posts"] += 1
        d = _dt(p)
        if d and (a["first"] is None or d < a["first"]):
            a["first"] = d
    items = []
    for uid, a in agg.items():
        u = users.get(uid, {})
        items.append({"username": u.get("username"), "engagement": a["eng"],
                      "posts": a["posts"], "first": a["first"]})
    items = [i for i in items if i["username"]]
    far = datetime.max.replace(tzinfo=timezone.utc)
    if by_time:
        items.sort(key=lambda x: (x["first"] or far, -x["engagement"]))
    else:
        items.sort(key=lambda x: -x["engagement"])
    return [{"username": i["username"], "engagement": i["engagement"], "posts": i["posts"]}
            for i in items[:top]]
