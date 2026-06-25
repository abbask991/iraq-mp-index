"""Collect supporting evidence (example posts) for the battlefield — paginated
so the frontend never loads everything at once."""


def collect(tweets, news_hits=None, page=0, size=12):
    items = []
    for t in tweets:
        items.append({"kind": "post", "platform": "x", "text": (t.get("text") or "")[:220],
                      "engagement": int(t.get("engagement") or 0), "sentiment": t.get("sentiment"),
                      "created_at": t.get("created_at")})
    for h in (news_hits or []):
        items.append({"kind": "article", "platform": "news", "text": h.get("title", ""),
                      "source": h.get("source"), "sentiment": h.get("sentiment"),
                      "link": h.get("link"), "created_at": h.get("date")})
    items.sort(key=lambda x: -(x.get("engagement") or 0))
    start = page * size
    return {"page": page, "total": len(items), "evidence": items[start:start + size]}
